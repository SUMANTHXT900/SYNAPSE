import { db, generateId } from '../db.js';
import { setState } from '../state.js';

export async function getPendingGoals() {
  const goals = await db.goals
    .where('status')
    .equals('pending')
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
  let reusedGoal = false;

  if (newSubject) {
    const existingGoal = await db.goals.where('subject').equals(newSubject).first();
    if (existingGoal) {
      targetGoalId = existingGoal.id;
      reusedGoal = true;
    } else {
      targetGoalId = generateId();
      await db.goals.add({
        id: targetGoalId,
        subject: newSubject,
        status: 'pending'
      });
    }
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

  return { sessionId, reusedGoal, goalSubject: newSubject };
}

let _stoppingStudy = false;

export async function stopStudySession(sessionId, goalAction, focusQuality) {
  if (_stoppingStudy) return;
  _stoppingStudy = true;
  try {
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
  } finally {
    _stoppingStudy = false;
  }
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
  if (!goalId) throw new Error('deleteGoal: invalid goalId');
  return db.transaction('rw', db.goals, db.study_sessions, db.active_sessions, async () => {
    await db.study_sessions.where('goal_id').equals(goalId).delete();
    await db.active_sessions.where('goal_id').equals(goalId).delete();
    await db.goals.delete(goalId);
  });
}

export async function mergeDuplicateGoals() {
  const goals = await db.goals.toArray();
  const nameMap = {};
  goals.forEach(g => {
    if (!nameMap[g.subject]) nameMap[g.subject] = [];
    nameMap[g.subject].push(g);
  });

  let mergedCount = 0;
  for (const [subject, dupes] of Object.entries(nameMap)) {
    if (dupes.length <= 1) continue;
    const canonical = dupes[0];
    for (const dup of dupes.slice(1)) {
      const sessions = await db.study_sessions.where('goal_id').equals(dup.id).toArray();
      for (const s of sessions) {
        await db.study_sessions.update(s.id, { goal_id: canonical.id });
      }
      const active = await db.active_sessions.where('goal_id').equals(dup.id).toArray();
      for (const a of active) {
        await db.active_sessions.update(a.id, { goal_id: canonical.id });
      }
      await db.goals.delete(dup.id);
      mergedCount++;
    }
  }
  return mergedCount;
}
