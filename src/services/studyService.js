import { db, generateId } from '../db.js';
import { setState } from '../state.js';

export async function getPendingGoals() {
  const goals = await db.goals
    .where('status')
    .anyOf('pending', 'active', 'partial')
    .toArray();

  const goalsWithTime = await Promise.all(goals.map(async (goal) => {
    const sessions = await db.study_sessions
      .where('goal_id')
      .equals(goal.id)
      .toArray();

    const totalTimeMs = sessions
      .filter(s => s.end_time != null)
      .reduce((sum, s) => sum + (s.end_time - s.start_time), 0);

    return { ...goal, totalTimeMs };
  }));

  return goalsWithTime;
}

export async function startStudySession(goalId, newSubject = null) {
  let targetGoalId = goalId;

  if (newSubject) {
    targetGoalId = generateId();
    await db.goals.add({
      id: targetGoalId,
      subject: newSubject,
      status: 'pending'
    });
  }

  const sessionId = generateId();
  const startTime = Date.now();

  await db.study_sessions.add({
    id: sessionId,
    goal_id: targetGoalId,
    date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD for cross-day queries
    start_time: startTime,
    end_time: null,
    goal_status_after: null,
    focus_quality: null
  });

  const activeSessionId = generateId();
  await db.active_sessions.put({
    id: activeSessionId,
    session_type: 'study',
    session_id: sessionId,
    goal_id: targetGoalId,
    start_time: startTime
  });

  const goal = await db.goals.get(targetGoalId);

  setState({
    activeStudySession: {
      id: sessionId,
      goal_id: targetGoalId,
      goal_name: goal ? goal.subject : 'Untitled Goal',
      start_time: startTime,
      active_record_id: activeSessionId
    }
  });

  return sessionId;
}

export async function stopStudySession(sessionId, goalAction, focusQuality) {
  const endTime = Date.now();

  const updates = { end_time: endTime, goal_status_after: goalAction };
  if (focusQuality != null) {
    updates.focus_quality = focusQuality;
  }

  await db.study_sessions.update(sessionId, updates);

  const session = await db.study_sessions.get(sessionId);

  if (session && session.goal_id) {
    let goalStatus = 'pending';
    if (goalAction === 'completed') goalStatus = 'completed';
    else if (goalAction === 'abandoned') goalStatus = 'abandoned';

    await db.goals.update(session.goal_id, { status: goalStatus });
  }

  const activeRecords = await db.active_sessions.where({ session_type: 'study' }).toArray();
  for (const record of activeRecords) {
    await db.active_sessions.delete(record.id);
  }

  setState({ activeStudySession: null });
}

export async function getActiveStudySession() {
  const activeRecords = await db.active_sessions.where({ session_type: 'study' }).toArray();

  if (activeRecords.length > 0) {
    const activeRecord = activeRecords[0];
    const goal = await db.goals.get(activeRecord.goal_id);

    return {
      id: activeRecord.session_id,
      goal_id: activeRecord.goal_id,
      goal_name: goal ? goal.subject : 'Unknown Goal',
      start_time: activeRecord.start_time,
      active_record_id: activeRecord.id
    };
  }
  return null;
}

export async function getAllGoalsWithHistory() {
  const goals = await db.goals.toArray();

  const goalsWithHistory = await Promise.all(goals.map(async (goal) => {
    const sessions = await db.study_sessions
      .where('goal_id')
      .equals(goal.id)
      .toArray();

    const totalTimeMs = sessions
      .filter(s => s.end_time != null)
      .reduce((sum, s) => sum + (s.end_time - s.start_time), 0);

    return { ...goal, sessions, totalTimeMs };
  }));

  return goalsWithHistory;
}

export async function updateGoal(goalId, newSubject) {
  await db.goals.update(goalId, { subject: newSubject });
}

export async function deleteGoal(goalId) {
  const sessions = await db.study_sessions
    .where('goal_id')
    .equals(goalId)
    .toArray();

  for (const session of sessions) {
    await db.study_sessions.delete(session.id);
  }

  await db.goals.delete(goalId);
}
