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
  analysisDateRange: '7days'
};

// Set of subscriber callbacks
const subscribers = new Set();

// Reactive Proxy handler to intercept state edits and dispatch events
const stateProxy = new Proxy(state, {
  set(target, property, value) {
    if (target[property] === value) return true;
    
    const oldValue = target[property];
    target[property] = value;
    
    // Notify all subscribers of the state change
    subscribers.forEach(callback => {
      try {
        callback({ ...target }, property, value, oldValue);
      } catch (err) {
        console.error('❌ [State Manager] Error in subscriber callback:', err);
      }
    });
    
    return true;
  },
  get(target, property) {
    // Return a shallow copy of objects or nested states to prevent accidental direct mutation
    return target[property];
  }
});

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
  Object.keys(updates).forEach(key => {
    if (key in state) {
      stateProxy[key] = updates[key];
    } else {
      console.warn(`⚠️ [State Manager] Attempted to set unregistered state property: "${key}"`);
    }
  });
}

/**
 * Subscribe to state updates. Returns an unsubscribe function.
 * @param {Function} callback - Invoked as callback(state, changedKey, newValue, oldValue)
 * @returns {Function} Unsubscribe function
 */
export function subscribe(callback) {
  if (typeof callback !== 'function') {
    throw new Error('❌ [State Manager] Subscriber must be a function');
  }
  
  subscribers.add(callback);
  
  // Call immediately with current state for initial bootstrap
  try {
    callback({ ...state }, null, null, null);
  } catch (err) {
    console.error('❌ [State Manager] Error in initial subscriber callback:', err);
  }
  
  // Return cleanup function
  return () => {
    subscribers.delete(callback);
  };
}
