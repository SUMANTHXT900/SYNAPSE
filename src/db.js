import Dexie from 'dexie';

// Safe UUID generator: crypto.randomUUID() requires Secure Context (HTTPS).
// When accessing from mobile via LAN (HTTP), it throws. Fallback ensures
// DB writes work everywhere, including non-HTTPS dev-server access.
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Initialize the Synapse Database
export const db = new Dexie('SynapseDatabase');

// Define database schema strictly using custom UUID string keys (no auto-increment '++')
// to prevent collisions when exporting or importing offline data.
db.version(1).stores({
  goals: 'id, subject, status, priority, category',
  study_sessions: 'id, goal_id, start_time, end_time, result',
  water_logs: 'id, timestamp, score, type',
  exercises: 'id, name, muscle_group',
  workout_sessions: 'id, exercise_id, date, total_volume',
  active_sessions: 'id, session_type'
});

// Upgrade to remove priority and category from goals indexes
db.version(2).stores({
  goals: 'id, subject, status'
});

// Upgrade to add user_profile store for persistent user identity
db.version(3).stores({
  user_profile: 'id'
});

// Upgrade to goal-centric study_sessions schema
db.version(4).stores({
  study_sessions: 'id, goal_id, start_time, end_time, goal_status_after, focus_quality'
});

// Upgrade to add date index for cross-day analysis queries
db.version(5).stores({
  study_sessions: 'id, goal_id, date, start_time, end_time, goal_status_after, focus_quality'
});

// Exported DB health check — verifies IndexedDB is operational
export async function checkDbHealth() {
  try {
    await db.open(); // ensure connection is open
    await db.goals.count();
    return { ok: true, message: 'Connected' };
  } catch (err) {
    console.error('❌ [DB Health] IndexedDB check failed:', err);
    return { ok: false, message: err.message || 'DB unavailable' };
  }
}

console.log('⚡ [Synapse Database] Dexie IndexedDB initialized with offline-resilient UUID schemas.');
