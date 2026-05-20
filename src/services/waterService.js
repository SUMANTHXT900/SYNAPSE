import { db, generateId } from '../db.js';
import { getState, setState } from '../state.js';

// Internal Scoring Dictionary
const hydrationMapping = {
  "Just a Sip": 1,
  "Few Sips": 2,
  "Small Amount": 3,
  "Medium Amount": 5,
  "Large Amount": 7,
  "Full Bottle": 10
};

/**
 * Logs a water intake event.
 * @param {string} type - Preset type or 'Custom Sips'
 * @param {number|null} customAmount - Direct score if type is Custom
 */
export async function logWater(type, customAmount = null) {
  let score = 0;
  if (type === 'Custom Sips' && customAmount !== null) {
    score = Number(customAmount);
  } else {
    score = hydrationMapping[type] || 0;
  }

  // Insert record
  await db.water_logs.add({
    id: generateId(),
    timestamp: Date.now(),
    score: score,
    type: type
  });

  // Update global state immediately by recalculating
  const todayScore = await getTodayWaterScore();
  setState({ dailyWaterScore: todayScore });
}

/**
 * Calculates total hydration score for today (local time).
 * @returns {Promise<number>} Total score
 */
export async function getTodayWaterScore() {
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const endOfDay = new Date().setHours(23, 59, 59, 999);

  // Note: we can't easily query by timestamp range unless it's indexed, 
  // but since we only have index on 'id, timestamp, score, type',
  // we can use Dexie's where().between() if timestamp is indexed.
  // Wait, db schema: 'id, timestamp, score, type'. So timestamp is indexed!
  const logs = await db.water_logs
    .where('timestamp')
    .between(startOfDay, endOfDay, true, true)
    .toArray();

  const totalScore = logs.reduce((sum, log) => sum + log.score, 0);
  return totalScore;
}
