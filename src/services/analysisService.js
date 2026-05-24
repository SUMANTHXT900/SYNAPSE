import { db } from '../db.js';

function getDateBounds(range) {
  const now = Date.now();
  const end = now;
  let start;
  switch (range) {
    case '7days':
      start = now - 7 * 24 * 60 * 60 * 1000;
      break;
    case '30days':
      start = now - 30 * 24 * 60 * 60 * 1000;
      break;
    case 'month': {
      const d = new Date();
      start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      break;
    }
    default:
      start = 0;
  }
  return { start, end };
}

function toDateStr(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-CA');
}

function toDayLabel(dateStr) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date(dateStr + 'T00:00:00').getDay()];
}

function formatBarLabel(dateStr, dateRange) {
  if (dateRange === '7days') return toDayLabel(dateStr);
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(totalMs) {
  const totalSeconds = Math.floor(totalMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getDayName(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
}

function getTimePeriod(timestamp) {
  const h = new Date(timestamp).getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  if (h < 21) return 'Evening';
  return 'Night';
}

export async function getAnalyticsData(dateRange = '7days') {
  const bounds = getDateBounds(dateRange);

  const [allSessions, allLogs, allGoals] = await Promise.all([
    db.study_sessions.toArray(),
    db.water_logs.toArray(),
    db.goals.toArray()
  ]);

  const sessions = allSessions.filter(s => s.start_time >= bounds.start && s.start_time <= bounds.end);
  const logs = allLogs.filter(l => l.timestamp >= bounds.start && l.timestamp <= bounds.end);
  const goalIdsInRange = new Set(sessions.map(s => s.goal_id));
  const goals = allGoals.filter(g => goalIdsInRange.has(g.id));

  const hasData = sessions.length > 0 || logs.length > 0;

  return {
    dateRange,
    hasData,
    study: {
      summary: getStudySummary(sessions),
      weeklyTrend: getWeeklyTrend(sessions, dateRange),
      focusDistribution: getFocusDistribution(sessions),
      goalPerformance: getGoalPerformance(goals, sessions),
      streak: getStudyStreak(allSessions),
      productiveDay: getMostProductiveDay(sessions),
      bestTime: getBestTimeOfDay(sessions),
      perGoalDetail: getPerGoalDetail(goals, sessions)
    },
    hydration: {
      summary: getHydrationSummary(logs),
      weeklyTrend: getHydrationTrend(logs, dateRange),
      typeBreakdown: getHydrationTypeBreakdown(logs)
    }
  };
}

function getStudySummary(sessions) {
  const completed = sessions.filter(s => s.end_time != null);
  const totalMs = completed.reduce((sum, s) => sum + (s.end_time - s.start_time), 0);
  const totalSessions = completed.length;
  const avgMs = totalSessions > 0 ? totalMs / totalSessions : 0;
  const todayStr = toDateStr(Date.now());
  const todaySessions = completed.filter(s => toDateStr(s.start_time) === todayStr);
  const todayMs = todaySessions.reduce((sum, s) => sum + (s.end_time - s.start_time), 0);
  return {
    totalSessions,
    totalTime: totalMs,
    totalTimeLabel: formatDuration(totalMs),
    avgSessionTime: avgMs,
    avgSessionLabel: formatDuration(avgMs),
    todayMinutes: Math.round(todayMs / 60000),
    todayLabel: formatDuration(todayMs),
    periodLabel: formatDuration(totalMs)
  };
}

function getTrendDays(sessions, dateRange) {
  if (dateRange === '7days') return 7;
  if (dateRange === '30days') return 30;
  if (dateRange === 'month') {
    const now = new Date();
    return now.getDate();
  }
  // 'all' — compute from oldest session, cap at 365
  const oldest = sessions.reduce((min, s) => Math.min(min, s.start_time || s.timestamp || Infinity), Date.now());
  const diff = Math.ceil((Date.now() - oldest) / 86400000);
  return Math.min(Math.max(diff, 1), 365);
}

function getWeeklyTrend(sessions, dateRange) {
  const days = getTrendDays(sessions, dateRange);
  const map = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = toDateStr(d.getTime());
    map[key] = 0;
  }
  sessions.filter(s => s.end_time != null).forEach(s => {
    const key = toDateStr(s.start_time);
    if (key in map) {
      map[key] += (s.end_time - s.start_time);
    }
  });
  const entries = Object.entries(map);
  const maxVal = Math.max(...entries.map(([, v]) => v), 1);
  return entries.map(([date, ms]) => ({
    date,
    label: formatBarLabel(date, dateRange),
    minutes: Math.round(ms / 60000),
    pct: Math.round((ms / maxVal) * 100)
  }));
}

function getFocusDistribution(sessions) {
  const completed = sessions.filter(s => s.end_time != null && s.focus_quality != null);
  const counts = { deep: 0, okay: 0, distracted: 0 };
  completed.forEach(s => {
    if (counts[s.focus_quality] != null) counts[s.focus_quality]++;
  });
  const total = completed.length || 1;
  return {
    deep: { count: counts.deep, pct: Math.round((counts.deep / total) * 100) },
    okay: { count: counts.okay, pct: Math.round((counts.okay / total) * 100) },
    distracted: { count: counts.distracted, pct: Math.round((counts.distracted / total) * 100) },
    total: completed.length || 1
  };
}

function getGoalPerformance(goals, sessions) {
  const total = goals.length;
  const completed = goals.filter(g => g.status === 'completed').length;
  const abandoned = goals.filter(g => g.status === 'abandoned').length;
  const pending = total - completed - abandoned;

  return {
    total,
    completed,
    abandoned,
    pending,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
  };
}

function getPerGoalDetail(goals, sessions) {
  return goals.map(g => {
    const gSessions = sessions.filter(s => s.goal_id === g.id && s.end_time != null);
    const totalMs = gSessions.reduce((sum, s) => sum + (s.end_time - s.start_time), 0);
    return {
      id: g.id,
      subject: g.subject,
      status: g.status,
      totalTime: formatDuration(totalMs),
      totalMs,
      sessions: gSessions.length
    };
  }).sort((a, b) => b.totalMs - a.totalMs);
}

function getStudyStreak(allSessions) {
  const completed = allSessions.filter(s => s.end_time != null);
  const dateSet = new Set(completed.map(s => toDateStr(s.start_time)));
  const dates = Array.from(dateSet).sort();

  let current = 0;
  const today = toDateStr(Date.now());
  const yesterday = toDateStr(Date.now() - 86400000);

  if (!dateSet.has(today) && !dateSet.has(yesterday)) {
    current = 0;
  } else {
    const checkDate = dateSet.has(today) ? today : yesterday;
    let cursor = new Date(checkDate + 'T00:00:00');
    while (dateSet.has(toDateStr(cursor.getTime()))) {
      current++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  let longest = 0;
  let streak = 0;
  for (let i = 0; i < dates.length; i++) {
    if (i === 0) { streak = 1; continue; }
    const prev = new Date(dates[i - 1] + 'T00:00:00');
    const curr = new Date(dates[i] + 'T00:00:00');
    const diff = (curr - prev) / 86400000;
    if (diff === 1) {
      streak++;
    } else {
      longest = Math.max(longest, streak);
      streak = 1;
    }
  }
  longest = Math.max(longest, streak);

  return { current, longest };
}

function getMostProductiveDay(sessions) {
  const completed = sessions.filter(s => s.end_time != null);
  if (completed.length === 0) return null;
  const dayMap = {};
  completed.forEach(s => {
    const day = getDayName(toDateStr(s.start_time));
    if (!dayMap[day]) dayMap[day] = { totalMs: 0, count: 0 };
    dayMap[day].totalMs += (s.end_time - s.start_time);
    dayMap[day].count++;
  });
  let best = null;
  let bestAvg = 0;
  Object.entries(dayMap).forEach(([day, data]) => {
    const avg = data.totalMs / data.count;
    if (avg > bestAvg) {
      bestAvg = avg;
      best = { dayOfWeek: day, avgMinutes: Math.round(avg / 60000), totalSessions: data.count };
    }
  });
  return best;
}

function getBestTimeOfDay(sessions) {
  const completed = sessions.filter(s => s.end_time != null);
  if (completed.length === 0) return null;
  const periodMap = {};
  completed.forEach(s => {
    const period = getTimePeriod(s.start_time);
    if (!periodMap[period]) periodMap[period] = { totalMs: 0, count: 0 };
    periodMap[period].totalMs += (s.end_time - s.start_time);
    periodMap[period].count++;
  });
  let best = null;
  let bestAvg = 0;
  Object.entries(periodMap).forEach(([period, data]) => {
    const avg = data.totalMs / data.count;
    if (avg > bestAvg) {
      bestAvg = avg;
      best = { period, avgMinutes: Math.round(avg / 60000), sessions: data.count };
    }
  });
  return best;
}

function getHydrationSummary(logs) {
  const totalScore = logs.reduce((sum, l) => sum + l.score, 0);
  const totalLogs = logs.length;
  const today = toDateStr(Date.now());
  const todayLogs = logs.filter(l => toDateStr(l.timestamp) === today);
  const todayScore = todayLogs.reduce((sum, l) => sum + l.score, 0);
  const weekStart = Date.now() - 7 * 86400000;
  const weekLogs = logs.filter(l => l.timestamp >= weekStart);
  const weekScore = weekLogs.reduce((sum, l) => sum + l.score, 0);

  const uniqueDays = new Set(logs.map(l => toDateStr(l.timestamp)));
  const avgDaily = uniqueDays.size > 0 ? Math.round(totalScore / uniqueDays.size) : 0;

  let bestDay = null;
  let bestScore = 0;
  const dayScores = {};
  logs.forEach(l => {
    const d = toDateStr(l.timestamp);
    dayScores[d] = (dayScores[d] || 0) + l.score;
  });
  Object.entries(dayScores).forEach(([d, score]) => {
    if (score > bestScore) { bestScore = score; bestDay = d; }
  });

  return {
    todayScore,
    weekScore,
    totalScore,
    avgDaily,
    totalLogs,
    bestDay: bestDay ? `${getDayName(bestDay)} (${bestScore} pts)` : null
  };
}

function getHydrationTrend(logs, dateRange) {
  const days = getTrendDays(logs, dateRange);
  const map = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    map[toDateStr(d.getTime())] = 0;
  }
  logs.forEach(l => {
    const key = toDateStr(l.timestamp);
    if (key in map) map[key] += l.score;
  });
  const entries = Object.entries(map);
  const maxVal = Math.max(...entries.map(([, v]) => v), 1);
  return entries.map(([date, score]) => ({
    date,
    label: formatBarLabel(date, dateRange),
    score,
    pct: Math.round((score / maxVal) * 100)
  }));
}

function getHydrationTypeBreakdown(logs) {
  if (logs.length === 0) return [];
  const map = {};
  logs.forEach(l => {
    if (!map[l.type]) map[l.type] = { count: 0, score: 0 };
    map[l.type].count++;
    map[l.type].score += l.score;
  });
  const totalLogs = logs.length;
  const entries = Object.entries(map)
    .map(([type, data]) => ({
      type,
      count: data.count,
      score: data.score,
      pct: Math.round((data.count / totalLogs) * 100)
    }))
    .sort((a, b) => b.count - a.count);
  return entries;
}
