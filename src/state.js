// Synapse Central State Management
// Built using a lightweight, reactive Proxy pattern

const state = {
  currentDate: new Date().toLocaleDateString('en-CA'),
  userName: null,
  currentView: 'home',
  activeStudySession: null,
  activeGoalName: null,
  activeWorkoutSession: null,
  dailyWaterScore: 0,
  analysisDateRange: '7days',
  updateAvailable: false,
  isCheckingForUpdates: false,
  updateStatusText: 'Running the latest version of Synapse',
  appVersion: '0.4.0',
  versionNote: 'PWA-Ready milestone: rich install manifest, app icons, screenshots, apple touch icon',
  updateLogs: []
};

// Set of subscriber callbacks
const subscribers = new Set();

/**
 * Get a read-only snapshot of the current state
 * @returns {Readonly<Object>}
 */
export function getState() {
  return Object.freeze({ ...state });
}

/**
 * Merge updates into the global state
 * @param {Object} updates 
 */
export function setState(updates) {
  let hasChanges = false;
  const changedKeys = [];

  for (const key in updates) {
    if (key in state) {
      if (state[key] !== updates[key]) {
        state[key] = updates[key];
        hasChanges = true;
        changedKeys.push(key);
      }
    } else {
      console.warn(`[State] Attempted to set unknown key: ${key}`);
    }
  }

  if (hasChanges) {
    subscribers.forEach(callback => callback(getState(), changedKeys));
  }
}

/**
 * Subscribe to state updates. Returns an unsubscribe function.
 * @param {Function} callback - Invoked as callback(state, changedKeys)
 * @returns {Function} Unsubscribe function
 */
export function subscribe(callback) {
  if (typeof callback !== 'function') {
    throw new Error('❌ [State Manager] Subscriber must be a function');
  }
  
  subscribers.add(callback);
  
  // Call immediately with current state for initial bootstrap
  try {
    callback(getState(), null);
  } catch (err) {
    console.error('❌ [State Manager] Error in initial subscriber callback:', err);
  }
  
  // Return cleanup function
  return () => {
    subscribers.delete(callback);
  };
}
