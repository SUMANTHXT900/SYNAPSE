import './style.css';

import { getState, setState, subscribe } from './state.js';
import { showModal } from './modal.js';
import { getPendingGoals, startStudySession, stopStudySession, getActiveStudySession, getAllGoalsWithHistory, updateGoal, deleteGoal } from './services/studyService.js';
import { getTodayWaterScore, logWater } from './services/waterService.js';
import { renderHome, renderStudy, renderAnalysis, renderSettings, renderGoalCard } from './router.js';
import { db, checkDbHealth } from './db.js';
import { getAnalyticsData } from './services/analysisService.js';
import { registerSW } from 'virtual:pwa-register';

let swRegistration = null;
let pwaUpdateSW = null;

const updateSW = registerSW({
  onNeedRefresh() {
    setState({
      updateAvailable: true,
      updateStatusText: 'New version available!'
    });
  },
  onOfflineReady() {
    console.log('Synapse assets successfully cached for offline use.');
  }
});
pwaUpdateSW = updateSW;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(reg => {
    swRegistration = reg;
  });
}

window.__pwaCheckForUpdates = async (isManualClick = false) => {
  console.log("🚀 [PWA Engine] __pwaCheckForUpdates triggered! Manual:", isManualClick);
  const pushLog = (msg) => {
    const currentLogs = getState().updateLogs;
    setState({ updateLogs: [...currentLogs, msg] });
  };

  if (isManualClick) {
    setState({ isCheckingForUpdates: true, updateStatusText: 'Initializing diagnostic...', updateLogs: [] });
    pushLog('System: Initiating OTA update sequence...');
    await new Promise(r => setTimeout(r, 300));
  }

  if (!navigator.onLine) {
    if (isManualClick) {
      pushLog('Error: No network connection detected.');
      setState({ updateStatusText: 'You are offline. Connection required.', isCheckingForUpdates: false });
    }
    return;
  }

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isLocalIP = hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.') || hostname.endsWith('.local');
  const isSecure = window.isSecureContext;

  if (isLocalhost || (isLocalIP && !isSecure)) {
    if (isManualClick) {
      pushLog('System: Analyzing environment signature...');
      await new Promise(r => setTimeout(r, 400));
      if (isLocalIP) {
        pushLog('Warning: LAN IP connection detected over HTTP.');
        pushLog('Security: Mobile browsers disable PWAs on unsecure origins.');
        pushLog('Notice: OTA testing requires an HTTPS server deployment.');
      } else {
        pushLog('Warning: Localhost environment detected.');
        pushLog('System: Bypassing Cloudflare Edge network check.');
      }
      setState({
        isCheckingForUpdates: false,
        updateStatusText: isLocalIP ? 'OTA disabled over local HTTP connection.' : 'Running locally. OTA updates disabled.'
      });
    }
    return;
  }

  if (!('serviceWorker' in navigator)) {
    if (isManualClick) {
      pushLog('Error: Service Workers are not supported or are blocked.');
      setState({ isCheckingForUpdates: false, updateStatusText: 'PWA features unsupported.' });
    }
    return;
  }

  try {
    const activeReg = await navigator.serviceWorker.getRegistration();

    if (activeReg) {
      if (isManualClick) {
        pushLog('Network: Contacting Cloudflare Pages Edge Server...');
        await new Promise(r => setTimeout(r, 500));
      }

      await activeReg.update();

      if (isManualClick) {
        pushLog('System: Verifying byte hashes and service worker integrity...');
        setTimeout(() => {
          const state = getState();
          if (!state.updateAvailable) {
            pushLog('Result: Hashes match. System is up to date.');
            setState({ isCheckingForUpdates: false, updateStatusText: 'Synapse is completely up to date!' });
          } else {
            pushLog('Result: New version manifest downloaded successfully.');
            pushLog('Action: Update payload ready for installation.');
            setState({ isCheckingForUpdates: false });
          }
        }, 800);
      }
    } else {
      if (isManualClick) {
        pushLog('Status: Service worker container active, but no registration found.');
        pushLog('Action: Clear browser storage data or wait for app initialization.');
        setState({ isCheckingForUpdates: false, updateStatusText: 'Registration slot initializing.' });
      }
    }
  } catch (err) {
    if (isManualClick) {
      pushLog(`Error: Connection failed -> ${err.message}`);
      setState({ isCheckingForUpdates: false, updateStatusText: 'Check failed. Try again.' });
    }
  }
};

window.__pwaApplyUpdate = () => {
  if (pwaUpdateSW) pwaUpdateSW(true);
};

// Android Chrome touch fix: fire click on touchend for buttons
let _touchHandled = false;
document.addEventListener('touchend', (e) => {
  const btn = e.target.closest('button, [role="button"], .nav-btn');
  if (btn && !_touchHandled) {
    _touchHandled = true;
    e.preventDefault();
    btn.click();
    setTimeout(() => { _touchHandled = false; }, 500);
  }
}, { passive: false });

const viewContainer = document.getElementById('view-container');
const navButtons = document.querySelectorAll('.nav-btn');

let studyTimerInterval = null;

function formatElapsedTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.min(Math.floor(totalSeconds / 3600), 99);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMin = String(minutes).padStart(2, '0');
  const paddedSec = String(seconds).padStart(2, '0');
  return `${String(hours).padStart(2, '0')}:${paddedMin}:${paddedSec}`;
}

function updateNavActiveState(viewName) {
  navButtons.forEach(btn => {
    const btnView = btn.getAttribute('data-view');
    const isActive = btnView === viewName;

    btn.classList.toggle('text-blue-600', isActive);
    btn.classList.toggle('text-gray-400', !isActive);
    btn.classList.toggle('md:bg-blue-50', isActive);
    btn.classList.toggle('md:hover:bg-gray-100', !isActive);
  });
}

function clearStudyTimer() {
  if (studyTimerInterval) {
    clearInterval(studyTimerInterval);
    studyTimerInterval = null;
  }
}

function bindStudyTimerToNewDOM() {
  const state = getState();
  if (!state.activeStudySession) return;

  const timerDisplay = document.getElementById('study-timer-display');
  if (!timerDisplay) return;

  const startTime = state.activeStudySession.start_time;

  const updateTimer = () => {
    if (timerDisplay) {
      timerDisplay.textContent = formatElapsedTime(Date.now() - startTime);
    }
  };
  updateTimer();
  studyTimerInterval = setInterval(updateTimer, 1000);
}

function initWaterCardListeners() {
  const btnLogWater = document.getElementById('btn-log-water');
  if (!btnLogWater) return;

  btnLogWater.addEventListener('click', () => {
    const bodyContainer = document.createElement('div');
    bodyContainer.className = 'flex flex-col gap-4 text-gray-700 mt-2';

    const gridHtml = `
      <div id="water-presets" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button data-type="Just a Sip" class="preset-btn bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-2xl flex flex-col items-center justify-center min-h-[72px] transition-all active:scale-95 shadow-sm">
          <span class="text-2xl">💧</span>
          <span class="text-[10px] font-bold tracking-wider text-blue-700 mt-1 uppercase">Just a Sip</span>
        </button>
        <button data-type="Few Sips" class="preset-btn bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-2xl flex flex-col items-center justify-center min-h-[72px] transition-all active:scale-95 shadow-sm">
          <span class="text-2xl">💧💧</span>
          <span class="text-[10px] font-bold tracking-wider text-blue-700 mt-1 uppercase">Few Sips</span>
        </button>
        <button data-type="Small Amount" class="preset-btn bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-2xl flex flex-col items-center justify-center min-h-[72px] transition-all active:scale-95 shadow-sm">
          <span class="text-2xl">🥛</span>
          <span class="text-[10px] font-bold tracking-wider text-blue-700 mt-1 uppercase">Small Amount</span>
        </button>
        <button data-type="Medium Amount" class="preset-btn bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-2xl flex flex-col items-center justify-center min-h-[72px] transition-all active:scale-95 shadow-sm">
          <span class="text-2xl">🥤</span>
          <span class="text-[10px] font-bold tracking-wider text-blue-700 mt-1 uppercase">Medium</span>
        </button>
        <button data-type="Large Amount" class="preset-btn bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-2xl flex flex-col items-center justify-center min-h-[72px] transition-all active:scale-95 shadow-sm">
          <span class="text-2xl">🍺</span>
          <span class="text-[10px] font-bold tracking-wider text-blue-700 mt-1 uppercase">Large Amount</span>
        </button>
        <button data-type="Full Bottle" class="preset-btn bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-2xl flex flex-col items-center justify-center min-h-[72px] transition-all active:scale-95 shadow-sm">
          <span class="text-2xl">🍾</span>
          <span class="text-[10px] font-bold tracking-wider text-blue-700 mt-1 uppercase">Full Bottle</span>
        </button>
      </div>
      
      <div class="flex items-center gap-4 py-2">
        <div class="h-px bg-gray-200 flex-1"></div>
        <span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">OR</span>
        <div class="h-px bg-gray-200 flex-1"></div>
      </div>
      
      <button id="btn-custom-sips" class="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl py-3.5 text-sm font-bold text-gray-600 transition-all shadow-sm">
        Enter Custom Sips
      </button>
      
      <div id="custom-sips-container" class="hidden flex gap-3">
        <input type="number" id="custom-sips-input" min="1" placeholder="Score (e.g. 8)" class="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-gray-900 font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-inner" />
        <button id="btn-log-custom" class="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-8 font-bold shadow-md transition-all active:scale-95">Log</button>
      </div>
    `;

    bodyContainer.innerHTML = gridHtml;

    const modal = showModal({
      title: 'How much did you drink?',
      body: bodyContainer,
      buttons: []
    });

    bodyContainer.addEventListener('click', async (e) => {
      const presetBtn = e.target.closest('.preset-btn');
      if (presetBtn) {
        const type = presetBtn.getAttribute('data-type');
        await logWater(type);
        modal.close();
        showWaterUndoToast();
        return;
      }

      const customSipsBtn = e.target.closest('#btn-custom-sips');
      if (customSipsBtn) {
        customSipsBtn.classList.add('hidden');
        const presets = document.getElementById('water-presets');
        if (presets) presets.classList.add('opacity-40', 'pointer-events-none');
        const container = document.getElementById('custom-sips-container');
        if (container) container.classList.remove('hidden');
        const input = document.getElementById('custom-sips-input');
        if (input) input.focus();
        return;
      }

      const logCustomBtn = e.target.closest('#btn-log-custom');
      if (logCustomBtn) {
        const input = document.getElementById('custom-sips-input');
        const val = input ? input.value : '';
        if (val && Number(val) > 0) {
          await logWater('Custom Sips', val);
          modal.close();
          showWaterUndoToast();
        }
      }
    });
  });
}

function showWaterUndoToast() {
  let toast = document.getElementById('water-undo-toast');
  if (toast) {
    toast.remove();
    clearTimeout(toast._timer);
  }

  toast = document.createElement('div');
  toast.id = 'water-undo-toast';
  toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-950/95 backdrop-blur-md text-white rounded-2xl px-4 py-3.5 shadow-xl flex items-center gap-3 transition-all duration-300 text-xs font-semibold font-sans opacity-0 translate-y-4';
  toast.innerHTML = `
    <span>💧 Water logged!</span>
    <button id="water-undo-btn" class="bg-red-500 hover:bg-red-600 text-white font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95">Undo</button>
  `;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('opacity-0', 'translate-y-4');
  });

  const handleUndo = async () => {
    const now = Date.now();
    const startOfDay = new Date().setHours(0, 0, 0, 0);
    const logs = await db.water_logs.where('timestamp').between(startOfDay, now, true, true).toArray();
    const lastLog = logs[logs.length - 1];
    if (lastLog) {
      await db.water_logs.delete(lastLog.id);
      const todayScore = await getTodayWaterScore();
      setState({ dailyWaterScore: todayScore });
    }
    toast.classList.add('opacity-0', 'translate-y-4');
    setTimeout(() => toast.remove(), 300);
  };

  toast.addEventListener('click', (e) => {
    if (e.target.id === 'water-undo-btn') {
      handleUndo();
    }
  });

  toast._timer = setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-4');
    setTimeout(() => {
      if (toast && toast.parentNode) toast.remove();
    }, 300);
  }, 5000);
}

function formatDuration(totalMs) {
  const totalSeconds = Math.floor(totalMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function initStudyCardListeners() {
  const btnStartStudy = document.getElementById('btn-start-study');
  if (!btnStartStudy) return;

  btnStartStudy.addEventListener('click', async () => {
    const currentSession = getState().activeStudySession;

    if (currentSession) {
      const bodyContainer = document.createElement('div');
      bodyContainer.className = 'flex flex-col gap-6 text-gray-700 mt-2';

      let selectedGoalStatus = null;
      let selectedFocusQuality = null;

      const goalStatusButtons = [
        { value: 'completed', label: 'Goal Completed', emoji: '✅', desc: 'Mark this goal as done' },
        { value: 'pause', label: 'Pause for Later', emoji: '⏸️', desc: 'Keep goal pending, resume anytime' },
        { value: 'abandoned', label: 'Abandon', emoji: '🛑', desc: 'Give up on this goal' }
      ];

      const focusButtons = [
        { value: 'deep', label: 'Deep Focus', emoji: '🧘', desc: 'Fully immersed, no distractions' },
        { value: 'okay', label: 'Okay', emoji: '😐', desc: 'Moderate concentration' },
        { value: 'distracted', label: 'Distracted', emoji: '😵', desc: 'Hard to stay on task' }
      ];

      bodyContainer.innerHTML = `
        <div>
          <label class="font-bold text-purple-600 text-[10px] tracking-widest uppercase mb-3 block">Goal Status</label>
          <div id="goal-status-group" class="grid grid-cols-1 gap-2">
            ${goalStatusButtons.map(b => `
              <button data-value="${b.value}" class="status-btn flex items-center gap-3 w-full bg-gray-50 hover:bg-purple-50 border border-gray-200 rounded-2xl p-4 text-left transition-all active:scale-[0.98]">
                <span class="text-xl">${b.emoji}</span>
                <div class="flex flex-col">
                  <span class="text-sm font-bold text-gray-900">${b.label}</span>
                  <span class="text-[10px] text-gray-500 font-medium">${b.desc}</span>
                </div>
              </button>
            `).join('')}
          </div>
        </div>

        <div id="focus-section">
          <label class="font-bold text-blue-600 text-[10px] tracking-widest uppercase mb-3 block">Focus Quality</label>
          <div id="focus-quality-group" class="grid grid-cols-1 gap-2">
            ${focusButtons.map(b => `
              <button data-value="${b.value}" class="focus-btn flex items-center gap-3 w-full bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-2xl p-4 text-left transition-all active:scale-[0.98]">
                <span class="text-xl">${b.emoji}</span>
                <div class="flex flex-col">
                  <span class="text-sm font-bold text-gray-900">${b.label}</span>
                  <span class="text-[10px] text-gray-500 font-medium">${b.desc}</span>
                </div>
              </button>
            `).join('')}
          </div>
        </div>

        <p id="end-session-error" role="alert" class="text-red-600 text-sm font-bold mt-2 min-h-[20px]"></p>
      `;

      const modal = showModal({
        title: 'End Study Session',
        body: bodyContainer,
        buttons: [
          {
            text: 'Cancel',
            type: 'secondary',
            onClick: (m) => m.close()
          },
          {
            text: 'End Session',
            type: 'primary',
            onClick: async (m) => {
              const errorEl = bodyContainer.querySelector('#end-session-error');
              if (!selectedGoalStatus) {
                if (errorEl) errorEl.textContent = 'Please select a goal status.';
                return;
              }
              if (selectedGoalStatus !== 'abandoned' && !selectedFocusQuality) {
                if (errorEl) errorEl.textContent = 'Please select a focus quality.';
                return;
              }
              if (errorEl) errorEl.textContent = '';
              await stopStudySession(
                currentSession.id,
                selectedGoalStatus,
                selectedGoalStatus === 'abandoned' ? null : selectedFocusQuality
              );
              m.close();
            }
          }
        ]
      });

      const statusGroup = bodyContainer.querySelector('#goal-status-group');
      const focusSection = bodyContainer.querySelector('#focus-section');
      const focusGroup = bodyContainer.querySelector('#focus-quality-group');

      statusGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.status-btn');
        if (!btn) return;
        statusGroup.querySelectorAll('.status-btn').forEach(b => {
          b.classList.remove('bg-purple-100', 'border-purple-400');
          b.classList.add('bg-gray-50', 'border-gray-200');
        });
        btn.classList.remove('bg-gray-50', 'border-gray-200');
        btn.classList.add('bg-purple-100', 'border-purple-400');
        selectedGoalStatus = btn.getAttribute('data-value');

        if (selectedGoalStatus === 'abandoned') {
          focusSection.classList.add('hidden');
          selectedFocusQuality = null;
        } else {
          focusSection.classList.remove('hidden');
        }
      });

      focusGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.focus-btn');
        if (!btn) return;
        focusGroup.querySelectorAll('.focus-btn').forEach(b => {
          b.classList.remove('bg-blue-100', 'border-blue-400');
          b.classList.add('bg-gray-50', 'border-gray-200');
        });
        btn.classList.remove('bg-gray-50', 'border-gray-200');
        btn.classList.add('bg-blue-100', 'border-blue-400');
        selectedFocusQuality = btn.getAttribute('data-value');
      });

    } else {
      const pendingGoals = await getPendingGoals();

      const bodyContainer = document.createElement('div');
      bodyContainer.className = 'flex flex-col gap-6 text-gray-700 text-sm mt-2';

      let optionsHtml = '';

      if (pendingGoals.length > 0) {
        const goalOptions = pendingGoals.map(g => {
          const timeStr = g.totalTimeMs > 0 ? ` (${formatDuration(g.totalTimeMs)} spent)` : '';
          return `<option value="${g.id}">${g.subject}${timeStr}</option>`;
        }).join('');

        optionsHtml += `
          <div class="flex flex-col gap-2">
            <label class="font-bold text-purple-600 text-[10px] tracking-widest uppercase">Continue Existing Goal</label>
            <select id="select-goal" class="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-gray-900 font-semibold focus:ring-2 focus:ring-purple-500 outline-none transition-colors shadow-sm">
              <option value="">-- Select a Goal --</option>
              ${goalOptions}
            </select>
          </div>
          <div class="flex items-center gap-4 py-2">
            <div class="h-px bg-gray-200 flex-1"></div>
            <span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">OR</span>
            <div class="h-px bg-gray-200 flex-1"></div>
          </div>
        `;
      }

      optionsHtml += `
        <div class="flex flex-col gap-2">
          <label class="font-bold text-purple-600 text-[10px] tracking-widest uppercase">Create New Goal</label>
          <input type="text" id="new-goal-subject" placeholder="What are you studying? (e.g. Linear Algebra)" class="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-gray-900 font-semibold focus:ring-2 focus:ring-purple-500 outline-none transition-colors shadow-sm" />
        </div>
      `;

      bodyContainer.innerHTML = optionsHtml + '<p id="start-session-error" role="alert" class="text-red-600 text-sm font-bold mt-2 min-h-[20px]"></p>';

      showModal({
        title: 'Start Study Session',
        body: bodyContainer,
        buttons: [
          {
            text: 'Cancel',
            type: 'secondary',
            onClick: (m) => m.close()
          },
          {
            text: 'Start Timer',
            type: 'primary',
            onClick: async (m) => {
              const selectEl = document.getElementById('select-goal');
              const subjectInput = document.getElementById('new-goal-subject');
              const selectedGoalId = selectEl ? selectEl.value : null;
              const newSubject = subjectInput ? subjectInput.value.trim() : '';

              if (!selectedGoalId && !newSubject) {
                const errorEl = bodyContainer.querySelector('#start-session-error');
                if (errorEl) errorEl.textContent = 'Please select an existing goal or enter a new subject.';
                return;
              }
              if (errorEl) errorEl.textContent = '';

              await startStudySession(selectedGoalId || null, newSubject || null);
              m.close();
            }
          }
        ]
      });
    }
  });
}

function applyStudySessionUI(session) {
  const studyStatusEl = document.getElementById('study-status');
  const btnStartStudy = document.getElementById('btn-start-study') || document.getElementById('btn-start-study-study-view');
  const studyCard = document.getElementById('study-card');

  if (!studyStatusEl) return;

  if (session) {
    const goalName = session.goal_name || 'Untitled Goal';
    studyStatusEl.innerHTML = `
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-sm"></span>
          <span class="text-[10px] sm:text-xs text-red-600 font-bold uppercase tracking-widest">Active Study</span>
        </div>
        <div class="text-sm font-bold text-gray-700 truncate">Focusing on: ${goalName}</div>
        <div class="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3 shadow-sm">
          <span class="text-xs text-red-700 font-semibold uppercase tracking-wider">Elapsed Time</span>
          <span id="study-timer-display" aria-live="polite" aria-atomic="true" class="font-mono text-xl font-bold text-red-600 tracking-tight">
            00:00
          </span>
        </div>
      </div>
    `;

    if (btnStartStudy) {
      btnStartStudy.innerHTML = '⏹ Stop Session';
      btnStartStudy.className = 'w-full min-h-[56px] rounded-2xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-base transition-colors shadow-sm flex items-center justify-center gap-2';
    }

    if (studyCard) {
      studyCard.classList.add('border-red-400', 'bg-red-50/30');
      studyCard.classList.remove('border-gray-100', 'bg-white');
    }

    bindStudyTimerToNewDOM();
  } else {
    studyStatusEl.innerHTML = `
      <div class="flex items-center gap-2 border-l-4 border-gray-200 pl-4 py-3">
        <span class="text-lg font-semibold text-gray-400">No active session</span>
      </div>
    `;

    if (btnStartStudy) {
      btnStartStudy.innerHTML = 'Start Session';
      btnStartStudy.className = 'w-full min-h-[56px] rounded-2xl bg-gray-900 hover:bg-black text-white font-bold text-base transition-colors shadow-sm flex items-center justify-center gap-2';
    }

    if (studyCard) {
      studyCard.classList.remove('border-red-400', 'bg-red-50/30');
      studyCard.classList.add('border-gray-100', 'bg-white');
    }
  }
}

function updateTodayActivityCard() {
  const todayEl = document.getElementById('today-study-time');
  const waterEl = document.getElementById('today-water-score');
  const goalsEl = document.getElementById('today-goals-count');
  if (!todayEl) return;

  const state = getState();

  // Calculate today's study time
  const today = new Date().toLocaleDateString('en-CA');
  db.study_sessions.where('date').equals(today).toArray().then(sessions => {
    let totalMs = 0;
    let count = 0;
    sessions.forEach(s => {
      if (s.end_time) {
        totalMs += s.end_time - s.start_time;
        count++;
      }
    });
    const mins = Math.round(totalMs / 60000);
    todayEl.textContent = mins > 0 ? `${mins}m` : '0m';
  });

  if (waterEl) waterEl.textContent = state.dailyWaterScore.toString();

  if (goalsEl) {
    db.goals.where('status').anyOf('pending', 'active', 'partial').count().then(c => {
      goalsEl.textContent = c.toString();
    });
  }

  // Wire up the "View Goals" button
  const btnTodayGoals = document.getElementById('btn-today-goals');
  if (btnTodayGoals) {
    btnTodayGoals.removeEventListener('click', updateTodayActivityCard._navHandler);
    updateTodayActivityCard._navHandler = () => setState({ currentView: 'study' });
    btnTodayGoals.addEventListener('click', updateTodayActivityCard._navHandler);
  }
}

function renderCurrentView() {
  const state = getState();

  const container = document.getElementById('view-container');

  const callbacks = {
    onHomeMounted: () => {
      initWaterCardListeners();
      initStudyCardListeners();
      applyStudySessionUI(state.activeStudySession);
      updateTodayActivityCard();
    },
    onAnalysisMounted: async () => {
      const range = getState().analysisDateRange || '7days';
      const data = await getAnalyticsData(range);

      const emptyState = document.getElementById('analysis-empty-state');
      const dashboard = document.getElementById('analysis-dashboard');

      if (!data.hasData) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (dashboard) dashboard.classList.add('hidden');
        return;
      }

      if (emptyState) emptyState.classList.add('hidden');
      if (dashboard) dashboard.classList.remove('hidden');

      renderAnalysisHero(data);
      renderStudyTrendChart(data);
      renderFocusDonut(data);
      renderGoalPerformance(data);
      renderInsights(data);
      renderHydrationSection(data);
      triggerAnalysisAnimations();

      // Date range switcher
      const rangeContainer = document.getElementById('analysis-date-range');
      if (rangeContainer) {
        rangeContainer.querySelectorAll('.range-tab').forEach(btn => {
          btn.addEventListener('click', () => {
            const range = btn.getAttribute('data-range');
            setState({ analysisDateRange: range });
          });
        });
      }
    },
    onStudyMounted: async () => {
      const goals = await getAllGoalsWithHistory();
      const activeList = document.getElementById('goals-active-list');
      const archiveList = document.getElementById('goals-archive-list');

      const activeGoals = goals.filter(g => ['pending', 'active', 'partial'].includes(g.status));
      const archivedGoals = goals.filter(g => ['completed', 'abandoned'].includes(g.status));

      if (activeList) {
        if (activeGoals.length === 0) {
          activeList.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-center px-6"><span class="text-4xl mb-3">📋</span><p class="text-gray-400 font-semibold text-sm">No active goals yet</p><p class="text-gray-300 text-xs mt-1 max-w-xs">Head to the Home tab and tap <strong>Start Session</strong> to create your first goal!</p></div>';
        } else {
          activeList.innerHTML = activeGoals.map(g => renderGoalCard(g)).join('');
        }
      }

      if (archiveList) {
        if (archivedGoals.length === 0) {
          archiveList.innerHTML = '<div class="flex flex-col items-center justify-center py-12 text-center px-6"><span class="text-3xl mb-2">🏁</span><p class="text-gray-400 font-semibold text-sm">No archived goals</p><p class="text-gray-300 text-xs mt-0.5">Complete or abandon a goal and it will appear here.</p></div>';
        } else {
          archiveList.innerHTML = archivedGoals.map(g => renderGoalCard(g)).join('');
        }
      }

      const goalsContainer = document.getElementById('goals-active-list') || document.getElementById('goals-archive-list');
      if (goalsContainer) {
        goalsContainer.closest('.max-w-5xl').addEventListener('click', async (e) => {
          const actionBtn = e.target.closest('[data-action]');
          if (!actionBtn) return;

          const action = actionBtn.getAttribute('data-action');
          const goalId = actionBtn.getAttribute('data-goal-id');

          if (action === 'edit') {
            const goal = goals.find(g => g.id === goalId);
            if (!goal) return;
            const bodyContainer = document.createElement('div');
            bodyContainer.className = 'flex flex-col gap-4 text-gray-700 mt-2';
            bodyContainer.innerHTML = `
              <input type="text" id="edit-goal-subject" value="${goal.subject}" class="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-gray-900 font-bold text-lg focus:ring-2 focus:ring-purple-500 outline-none shadow-sm" />
            `;
            showModal({
              title: 'Edit Goal',
              body: bodyContainer,
              buttons: [
                { text: 'Cancel', type: 'secondary', onClick: (m) => m.close() },
                {
                  text: 'Save',
                  type: 'primary',
                  onClick: async (m) => {
                    const input = document.getElementById('edit-goal-subject');
                    const newSubject = input ? input.value.trim() : '';
                    if (newSubject) {
                      await updateGoal(goalId, newSubject);
                      renderCurrentView();
                    }
                    m.close();
                  }
                }
              ]
            });
          }

          if (action === 'history') {
            const goal = goals.find(g => g.id === goalId);
            if (!goal || !goal.sessions) return;
            const completedSessions = goal.sessions.filter(s => s.end_time != null);
            const bodyContainer = document.createElement('div');
            bodyContainer.className = 'flex flex-col gap-3 text-gray-700 mt-2 max-h-[50vh] overflow-y-auto';

            if (completedSessions.length === 0) {
              bodyContainer.innerHTML = '<p class="text-center text-gray-400 font-medium py-6">No completed sessions yet.</p>';
            } else {
              bodyContainer.innerHTML = completedSessions.map(s => {
                const date = new Date(s.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const time = new Date(s.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
                const duration = formatDuration(s.end_time - s.start_time);
                const qualityLabels = { deep: '🧘 Deep Focus', okay: '😐 Okay', distracted: '😵 Distracted' };
                const quality = s.focus_quality ? (qualityLabels[s.focus_quality] || s.focus_quality) : '—';
                return `
                  <div class="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-sm font-bold text-gray-900">${date} · ${time}</span>
                      <span class="text-sm font-bold text-purple-600">${duration}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 font-medium">Focus: ${quality}</span>
                      ${s.goal_status_after ? `<span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">${s.goal_status_after}</span>` : ''}
                    </div>
                  </div>
                `;
              }).join('');
            }

            showModal({ title: `History: ${goal.subject}`, body: bodyContainer, buttons: [] });
          }

          if (action === 'delete') {
            const goal = goals.find(g => g.id === goalId);
            if (!goal) return;
            const bodyContainer = document.createElement('div');
            bodyContainer.className = 'flex flex-col gap-4 text-gray-700 mt-2';
            bodyContainer.innerHTML = `
              <div class="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
                <span class="text-2xl">⚠️</span>
                <p class="text-sm font-medium text-red-800">Delete "<strong>${goal.subject}</strong>" and all its ${goal.sessions ? goal.sessions.length : 0} sessions? This cannot be undone.</p>
              </div>
            `;
            showModal({
              title: 'Delete Goal?',
              body: bodyContainer,
              buttons: [
                { text: 'Cancel', type: 'secondary', onClick: (m) => m.close() },
                {
                  text: 'Delete',
                  type: 'danger',
                  onClick: async (m) => {
                    await deleteGoal(goalId);
                    renderCurrentView();
                    m.close();
                  }
                }
              ]
            });
          }
        });
      }
    },
    onSettingsMounted: () => {
      const btnEditName = document.getElementById('btn-edit-name');
      if (btnEditName) {
        btnEditName.addEventListener('click', () => {
          const bodyContainer = document.createElement('div');
          bodyContainer.className = 'flex flex-col gap-4 text-gray-700 mt-2';
          bodyContainer.innerHTML = `
            <input type="text" id="new-name-input" placeholder="Enter your name" value="${state.userName || ''}" class="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-gray-900 font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
          `;

          showModal({
            title: 'What should we call you?',
            body: bodyContainer,
            buttons: [
              {
                text: 'Cancel',
                type: 'secondary',
                onClick: (m) => m.close()
              },
              {
                text: 'Save',
                type: 'primary',
                onClick: async (m) => {
                  const input = document.getElementById('new-name-input');
                  const newName = input ? input.value.trim() : '';
                  if (newName) {
                    await db.user_profile.put({ id: 'default', name: newName, updatedAt: Date.now() });
                    setState({ userName: newName });
                  }
                  m.close();
                }
              }
            ]
          });
        });
      }

      const btnDeleteData = document.getElementById('btn-delete-all-data');
      if (btnDeleteData) {
        btnDeleteData.addEventListener('click', () => {
          const confirmContainer = document.createElement('div');
          confirmContainer.className = 'flex flex-col gap-4 text-gray-700 mt-2';
          confirmContainer.innerHTML = `
            <div class="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
              <span class="text-2xl">⚠️</span>
              <p class="text-sm font-medium text-red-800">This will permanently erase all your goals, sessions, water logs, and settings. This cannot be undone.</p>
            </div>
          `;

          showModal({
            title: 'Delete All Data?',
            body: confirmContainer,
            buttons: [
              {
                text: 'Cancel',
                type: 'secondary',
                onClick: (m) => m.close()
              },
              {
                text: 'Delete Everything',
                type: 'danger',
                onClick: async (m) => {
                  clearStudyTimer();
                  await Promise.all([
                    db.goals.clear(),
                    db.study_sessions.clear(),
                    db.water_logs.clear(),
                    db.exercises.clear(),
                    db.workout_sessions.clear(),
                    db.active_sessions.clear(),
                    db.user_profile.clear()
                  ]);
                  setState({
                    userName: null,
                    activeStudySession: null,
                    dailyWaterScore: 0,
                    currentView: 'home'
                  });
                  m.close();
                }
              }
            ]
          });
        });
      }

      const btnCheckUpdates = document.getElementById('btn-check-updates');
      if (btnCheckUpdates) {
        btnCheckUpdates.addEventListener('click', (e) => {
          e.preventDefault();
          console.log("👆 [UI] Check Updates button clicked directly!");
          window.__pwaCheckForUpdates(true);
        });
      }

      const btnInstallUpdate = document.getElementById('btn-install-update');
      if (btnInstallUpdate) {
        btnInstallUpdate.addEventListener('click', (e) => {
          e.preventDefault();
          console.log("👆 [UI] Install Update button clicked!");
          window.__pwaApplyUpdate();
        });
      }
    }
  };

  switch (state.currentView) {
    case 'home':
      renderHome(viewContainer, callbacks);
      break;
    case 'study':
      renderStudy(viewContainer, callbacks);
      break;
    case 'analysis':
      renderAnalysis(viewContainer, callbacks);
      break;
    case 'settings':
      renderSettings(viewContainer, callbacks);
      break;
    default:
      renderHome(viewContainer, callbacks);
  }

  requestAnimationFrame(() => {
    viewContainer.classList.remove('view-enter');
    void viewContainer.offsetWidth;
    viewContainer.classList.add('view-enter');
  });
}

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const viewName = btn.getAttribute('data-view');
    setState({ currentView: viewName });
  });
});

subscribe((state, changedKeys) => {
  const hasChanged = (k) => !changedKeys || changedKeys.includes(k);

  if (hasChanged('currentView')) {
    updateNavActiveState(state.currentView);
    renderCurrentView();
    return;
  }

  if (hasChanged('analysisDateRange') && state.currentView === 'analysis') {
    renderCurrentView();
    return;
  }

  if (hasChanged('activeStudySession')) {
    clearStudyTimer();
    if (state.currentView === 'home' || state.currentView === 'analysis') {
      applyStudySessionUI(state.activeStudySession);
    }
  }

  if (hasChanged('dailyWaterScore')) {
    const el = document.getElementById('hydration-placeholder');
    if (el) el.textContent = `You've earned ${state.dailyWaterScore} hydration points today.`;
  }

  if (hasChanged('currentDate')) {
    const headerDateEl = document.getElementById('header-date');
    if (headerDateEl) {
      const [year, month, day] = state.currentDate.split('-');
      const date = new Date(year, month - 1, day);
      headerDateEl.textContent = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  }

  if (hasChanged('updateAvailable')) {
    renderUpdateToast(state.updateAvailable);
  }

  if (hasChanged('updateStatusText') || hasChanged('isCheckingForUpdates')) {
    const statusEl = document.getElementById('pwa-status-text');
    if (statusEl) statusEl.textContent = state.updateStatusText;
    const checkBtn = document.getElementById('btn-check-updates');
    if (checkBtn) checkBtn.disabled = state.isCheckingForUpdates;
  }

  if (hasChanged('updateLogs')) {
    const terminal = document.getElementById('pwa-terminal');
    if (terminal) {
      if (state.updateLogs.length > 0) {
        terminal.classList.remove('hidden');
        terminal.classList.add('flex');
      }
      terminal.innerHTML = state.updateLogs.map(log =>
        `<div><span class="text-slate-600">[${new Date().toLocaleTimeString('en-US', {hour12: false})}]</span> ${log}</div>`
      ).join('');
      terminal.scrollTop = terminal.scrollHeight;
    }
  }
});

function renderUpdateToast(show) {
  let toast = document.getElementById('pwa-update-toast');
  if (show) {
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pwa-update-toast';
      toast.setAttribute('role', 'alert');
      toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-950/95 backdrop-blur-md text-white rounded-2xl px-4 py-3.5 shadow-xl flex items-center gap-3 transition-all duration-300 text-xs font-semibold font-sans opacity-0 translate-y-4';
      toast.innerHTML = `
        <span>✨ Update live!</span>
        <button id="toast-update-btn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95">Relaunch</button>
      `;
      document.body.appendChild(toast);
      requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-4');
      });
      toast.addEventListener('click', (e) => {
        if (e.target.id === 'toast-update-btn') {
          window.__pwaApplyUpdate();
        }
      });
    }
  } else {
    if (toast) {
      toast.classList.add('opacity-0', 'translate-y-4');
      setTimeout(() => toast.remove(), 300);
    }
  }
}

function updateDbStatusBadges(status) {
  const ids = [
    ['db-dot-mobile', 'db-label-mobile', 'db-status-mobile'],
    ['db-dot-desktop', 'db-label-desktop', 'db-status-desktop'],
    ['db-dot-mobile-analysis', 'db-label-mobile-analysis', 'db-status-mobile-analysis'],
    ['db-dot-desktop-analysis', 'db-label-desktop-analysis', 'db-status-desktop-analysis'],
    ['db-dot-mobile-settings', 'db-label-mobile-settings', 'db-status-mobile-settings'],
    ['db-dot-mobile-study', 'db-label-mobile-study', 'db-status-mobile-study']
  ];
  const isOk = status.ok;
  const bgClass = isOk ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
  const dotClass = isOk ? 'bg-emerald-500' : 'bg-red-500';

  ids.forEach(([dotId, labelId, containerId]) => {
    const dot = document.getElementById(dotId);
    const label = document.getElementById(labelId);
    const container = document.getElementById(containerId);
    if (dot) dot.className = `w-1.5 h-1.5 rounded-full ${dotClass}`;
    if (label) label.textContent = status.message;
    if (container) {
      const cls = container.className;
      container.className = cls.replace(/bg-\w+-\d+ text-\w+-\d+/g, bgClass);
    }
  });
}

// ===== Analysis View Rendering Helpers =====

function triggerAnalysisAnimations() {
  document.querySelectorAll('#analysis-hero > .stat-card').forEach((el, i) => {
    el.style.animationDelay = `${i * 120}ms`;
    el.classList.add('animate-fade-slide-up');
  });
  document.querySelectorAll('.trend-bar').forEach((el, i) => {
    setTimeout(() => el.classList.add('grown'), 400 + i * 60);
  });
  document.querySelectorAll('#analysis-focus-section .animate-in, #analysis-goals-section .animate-in').forEach((el, i) => {
    el.style.animationDelay = `${i * 100}ms`;
    el.classList.add('animate-fade-slide-up');
  });
  document.querySelectorAll('#analysis-insights .insight-card').forEach((el, i) => {
    el.style.animationDelay = `${i * 100}ms`;
    el.classList.add('animate-fade-slide-up');
  });
  document.querySelectorAll('#analysis-hydration-section .animate-in, #analysis-hydration-types .animate-in, #analysis-hydration-stats .animate-in').forEach((el, i) => {
    el.style.animationDelay = `${i * 80}ms`;
    el.classList.add('animate-fade-slide-up');
  });
  document.querySelectorAll('.h-bar').forEach((el, i) => {
    setTimeout(() => {
      const w = el.getAttribute('data-width');
      if (w) el.style.width = w + '%';
    }, 600 + i * 100);
  });
  document.querySelectorAll('.donut-segment').forEach((el) => {
    setTimeout(() => {
      el.classList.add('animate-donut');
    }, 500);
  });
}

function renderAnalysisHero(data) {
  const hero = document.getElementById('analysis-hero');
  if (!hero) return;
  const s = data.study.summary;
  const hyd = data.hydration.summary;
  hero.innerHTML = `
    <div class="stat-card bg-white rounded-3xl p-5 shadow-sm border border-gray-100/80 flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Total Study</span>
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm shadow-sm">⏱️</div>
      </div>
      <span class="text-3xl font-outfit font-extrabold text-gray-900 mt-1">${s.totalTimeLabel}</span>
      <span class="text-xs text-gray-400 font-medium">${s.totalSessions} sessions · avg ${s.avgSessionLabel}</span>
    </div>
    <div class="stat-card bg-white rounded-3xl p-5 shadow-sm border border-gray-100/80 flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Streak</span>
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-red-400 flex items-center justify-center text-sm shadow-sm">🔥</div>
      </div>
      <span class="text-3xl font-outfit font-extrabold text-gray-900 mt-1">${data.study.streak.current} ${data.study.streak.current === 1 ? 'day' : 'days'}</span>
      <span class="text-xs text-gray-400 font-medium">Best: ${data.study.streak.longest} days</span>
    </div>
    <div class="stat-card bg-white rounded-3xl p-5 shadow-sm border border-gray-100/80 flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Hydration Today</span>
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-sm shadow-sm">💧</div>
      </div>
      <span class="text-3xl font-outfit font-extrabold text-gray-900 mt-1">${hyd.todayScore} pts</span>
      <span class="text-xs text-gray-400 font-medium">${hyd.weekScore} pts this week · avg ${hyd.avgDaily}/day</span>
    </div>
  `;
}

function renderStudyTrendChart(data) {
  const section = document.getElementById('analysis-trend-section');
  if (!section) return;
  const trend = data.study.weeklyTrend;
  section.innerHTML = `
    <div class="animate-in">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-lg shadow-sm">📈</div>
          <div>
            <h3 class="text-lg font-outfit font-bold text-gray-900">Weekly Focus</h3>
            <p class="text-xs text-gray-400 font-medium">Study time per day</p>
          </div>
        </div>
        <span class="text-sm font-bold text-gray-700">${data.study.summary.weekLabel}</span>
      </div>
      <div class="bar-chart mt-6">
        ${trend.map(b => `
          <div class="flex flex-col items-center gap-1.5 flex-1">
            <div class="trend-bar bar" style="height: ${Math.max(b.pct, 4)}%; background: linear-gradient(to top, #AF52DE, #FF2D55); border-radius: 6px 6px 3px 3px; width: 100%;">
              <div class="bar-tooltip">${b.minutes}m</div>
            </div>
            <span class="text-[10px] font-bold text-gray-400 uppercase">${b.label}</span>
            <span class="text-[9px] text-gray-300 font-semibold">${b.minutes}m</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderFocusDonut(data) {
  const section = document.getElementById('analysis-focus-section');
  if (!section) return;
  const fd = data.study.focusDistribution;
  const total = fd.total;
  const segments = [
    { key: 'deep', label: 'Deep Focus', color: '#5856D6', bg: '#EEEAFF', ...fd.deep },
    { key: 'okay', label: 'Okay', color: '#007AFF', bg: '#E8F2FF', ...fd.okay },
    { key: 'distracted', label: 'Distracted', color: '#FF3B30', bg: '#FFEBEA', ...fd.distracted }
  ];
  const R = 34, C = 2 * Math.PI * R;
  let offset = 0;
  const segHtml = segments.map(s => {
    const segLen = (s.count / total) * C;
    const dash = `${segLen} ${C - segLen}`;
    const dashOffset = -offset;
    offset += segLen;
    return `<circle class="donut-segment" cx="40" cy="40" r="${R}" fill="none" stroke="${s.color}" stroke-width="10" stroke-dasharray="${dash}" stroke-dashoffset="${C}" style="--circumference: ${C}; --target-offset: ${dashOffset}; transform: rotate(-90deg); transform-origin: 40px 40px;" stroke-linecap="round" />`;
  }).join('');

  section.innerHTML = `
    <div class="animate-in flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-lg shadow-sm">🧘</div>
        <div>
          <h3 class="text-lg font-outfit font-bold text-gray-900">Focus Quality</h3>
          <p class="text-xs text-gray-400 font-medium">${total} completed session${total !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <div class="flex flex-col sm:flex-row items-center gap-6">
        <div class="relative w-[120px] h-[120px] shrink-0">
          <svg viewBox="0 0 80 80" class="w-full h-full">
            ${segHtml}
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="text-2xl font-outfit font-extrabold text-gray-900">${total}</span>
          </div>
        </div>
        <div class="flex flex-col gap-2.5 w-full">
          ${segments.map(s => `
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full" style="background: ${s.color}"></span>
                <span class="text-sm font-semibold text-gray-700">${s.label}</span>
              </div>
              <span class="text-sm font-bold text-gray-900">${s.count} <span class="text-gray-400 font-medium">(${s.pct}%)</span></span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderGoalPerformance(data) {
  const section = document.getElementById('analysis-goals-section');
  if (!section) return;
  const gp = data.study.goalPerformance;
  const R = 34, C = 2 * Math.PI * R;
  const filled = (gp.completionRate / 100) * C;
  const dash = `${filled} ${C - filled}`;

  const perGoal = data.study.perGoalDetail;
  const topGoals = perGoal.slice(0, 5);
  const statusColors = { completed: 'bg-green-500', abandoned: 'bg-red-400', pending: 'bg-amber-400', active: 'bg-blue-500', partial: 'bg-orange-400' };

  section.innerHTML = `
    <div class="animate-in flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-lg shadow-sm">✅</div>
        <div>
          <h3 class="text-lg font-outfit font-bold text-gray-900">Goal Performance</h3>
          <p class="text-xs text-gray-400 font-medium">${gp.total} goal${gp.total !== 1 ? 's' : ''} created</p>
        </div>
      </div>
      <div class="flex flex-col sm:flex-row items-center gap-6">
        <div class="relative w-[110px] h-[110px] shrink-0">
          <svg viewBox="0 0 80 80" class="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r="${R}" fill="none" stroke="#E5E7EB" stroke-width="8" />
            <circle cx="40" cy="40" r="${R}" fill="none" stroke="#34C759" stroke-width="8" stroke-dasharray="${dash}" stroke-dashoffset="0" stroke-linecap="round" class="donut-segment" style="--circumference: ${C}; --target-offset: 0;" />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center flex-col">
            <span class="text-xl font-outfit font-extrabold text-gray-900">${gp.completionRate}%</span>
            <span class="text-[9px] text-gray-400 font-bold">complete</span>
          </div>
        </div>
        <div class="flex flex-col gap-2 w-full">
          <div class="flex items-center justify-between text-sm">
            <span class="font-semibold text-gray-600">Completed</span>
            <span class="font-bold text-green-600">${gp.completed}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="font-semibold text-gray-600">Abandoned</span>
            <span class="font-bold text-red-400">${gp.abandoned}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="font-semibold text-gray-600">Pending</span>
            <span class="font-bold text-amber-500">${gp.pending}</span>
          </div>
        </div>
      </div>
      ${topGoals.length > 0 ? `
        <div class="border-t border-gray-100 pt-3 mt-1">
          <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Top Goals</span>
          <div class="flex flex-col gap-2 mt-2">
            ${topGoals.map(g => `
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-2 h-2 rounded-full shrink-0 ${statusColors[g.status] || 'bg-gray-300'}"></span>
                  <span class="text-sm font-semibold text-gray-700 truncate">${g.subject}</span>
                </div>
                <span class="text-xs font-bold text-gray-500 shrink-0 ml-2">${g.totalTime}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderInsights(data) {
  const section = document.getElementById('analysis-insights');
  if (!section) return;
  const pd = data.study.productiveDay;
  const bt = data.study.bestTime;
  const streak = data.study.streak;

  const insights = [];
  if (pd) insights.push({ icon: '🏆', label: 'Best Day', value: pd.dayOfWeek, sub: `${pd.avgMinutes} min avg · ${pd.totalSessions} sessions` });
  if (bt) insights.push({ icon: '⏰', label: 'Best Time', value: bt.period, sub: `${bt.avgMinutes} min avg · ${bt.sessions} sessions` });
  if (streak.longest > 0) insights.push({ icon: '🔥', label: 'Longest Streak', value: `${streak.longest} days`, sub: `Current: ${streak.current} days` });

  section.innerHTML = insights.map((ins, i) => `
    <div class="insight-card bg-white rounded-3xl p-5 shadow-sm border border-gray-100/80 flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${ins.label}</span>
        <span class="text-xl">${ins.icon}</span>
      </div>
      <span class="text-xl font-outfit font-extrabold text-gray-900">${ins.value}</span>
      <span class="text-xs text-gray-400 font-medium">${ins.sub}</span>
    </div>
  `).join('');
}

function renderHydrationSection(data) {
  const trend = data.hydration.weeklyTrend;
  const types = data.hydration.typeBreakdown;
  const summary = data.hydration.summary;

  // Trend chart
  const trendSection = document.getElementById('analysis-hydration-section');
  if (trendSection) {
    trendSection.innerHTML = `
      <div class="animate-in">
        <div class="flex items-center justify-between mb-5">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-lg shadow-sm">💧</div>
            <div>
              <h3 class="text-lg font-outfit font-bold text-gray-900">Hydration Trend</h3>
              <p class="text-xs text-gray-400 font-medium">Water score per day</p>
            </div>
          </div>
          <span class="text-sm font-bold text-gray-700">${summary.weekScore} pts</span>
        </div>
        <div class="bar-chart mt-6">
          ${trend.map(b => `
            <div class="flex flex-col items-center gap-1.5 flex-1">
              <div class="trend-bar bar" style="height: ${Math.max(b.pct, 4)}%; background: linear-gradient(to top, #5AC8FA, #007AFF); border-radius: 6px 6px 3px 3px; width: 100%;">
                <div class="bar-tooltip">${b.score} pts</div>
              </div>
              <span class="text-[10px] font-bold text-gray-400 uppercase">${b.label}</span>
              <span class="text-[9px] text-gray-300 font-semibold">${b.score}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Type breakdown
  const typesSection = document.getElementById('analysis-hydration-types');
  if (typesSection) {
    const colorMap = {
      'Just a Sip': '#5AC8FA',
      'Few Sips': '#007AFF',
      'Small Amount': '#5856D6',
      'Medium Amount': '#AF52DE',
      'Large Amount': '#FF2D55',
      'Full Bottle': '#FF9500',
      'Custom Sips': '#34C759'
    };
    typesSection.innerHTML = `
      <div class="animate-in flex flex-col gap-4 h-full">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-lg shadow-sm">📋</div>
          <div>
            <h3 class="text-lg font-outfit font-bold text-gray-900">Type Breakdown</h3>
            <p class="text-xs text-gray-400 font-medium">${summary.totalLogs} total log${summary.totalLogs !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div class="flex flex-col gap-3 flex-1 justify-center">
          ${types.length > 0 ? types.map(t => `
            <div class="flex items-center gap-3">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background: ${colorMap[t.type] || '#8E8E93'}"></span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-semibold text-gray-700 truncate">${t.type}</span>
                  <span class="text-xs font-bold text-gray-900">${t.count} <span class="text-gray-400 font-medium">(${t.pct}%)</span></span>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div class="h-bar h-full rounded-full" style="background: ${colorMap[t.type] || '#8E8E93'}; width: 0%;" data-width="${t.pct}"></div>
                </div>
              </div>
            </div>
          `).join('') : '<div class="text-sm text-gray-400 font-medium text-center py-4">No logs in this period</div>'}
        </div>
      </div>
    `;
  }

  // Stats
  const statsSection = document.getElementById('analysis-hydration-stats');
  if (statsSection) {
    statsSection.innerHTML = `
      <div class="animate-in flex flex-col gap-4 h-full">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-lg shadow-sm">🏅</div>
          <div>
            <h3 class="text-lg font-outfit font-bold text-gray-900">Hydration Stats</h3>
            <p class="text-xs text-gray-400 font-medium">All-time summary</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4 flex-1 items-center">
          <div class="flex flex-col items-center gap-1 p-4 bg-blue-50/50 rounded-2xl">
            <span class="text-2xl font-outfit font-extrabold text-blue-600">${summary.avgDaily}</span>
            <span class="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Avg Daily</span>
          </div>
          <div class="flex flex-col items-center gap-1 p-4 bg-purple-50/50 rounded-2xl">
            <span class="text-2xl font-outfit font-extrabold text-purple-600">${summary.totalScore}</span>
            <span class="text-[10px] font-bold text-purple-500 uppercase tracking-widest">Total Pts</span>
          </div>
          <div class="flex flex-col items-center gap-1 p-4 bg-orange-50/50 rounded-2xl col-span-2">
            <span class="text-sm font-outfit font-extrabold text-orange-600 text-center">${summary.bestDay || 'No data'}</span>
            <span class="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Best Day</span>
          </div>
        </div>
      </div>
    `;
  }
}

async function initializeApp() {
  const health = await checkDbHealth();
  updateDbStatusBadges(health);

  const userProfile = await db.user_profile.get('default');
  if (userProfile && userProfile.name) {
    setState({ userName: userProfile.name });
  } else {
    const bodyContainer = document.createElement('div');
    bodyContainer.className = 'flex flex-col gap-4 text-gray-700 mt-2';
    bodyContainer.innerHTML = `
      <p class="text-sm text-gray-500 font-medium">Let's personalize your experience. What should we call you?</p>
      <input type="text" id="new-name-input" placeholder="Your name (e.g. Alex)" class="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-gray-900 font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
    `;

    showModal({
      title: 'Welcome to Synapse',
      body: bodyContainer,
      buttons: [
        {
          text: 'Skip for now',
          type: 'secondary',
          onClick: (modal) => modal.close()
        },
        {
          text: 'Let\'s go',
          type: 'primary',
          onClick: async (modal) => {
            const input = document.getElementById('new-name-input');
            const name = input ? input.value.trim() : '';
            if (name) {
              await db.user_profile.put({ id: 'default', name, createdAt: Date.now() });
              setState({ userName: name });
            }
            modal.close();
          }
        }
      ]
    });
  }

  const activeStudy = await getActiveStudySession();
  if (activeStudy) {
    setState({ activeStudySession: activeStudy });
  }

  const todayWaterScore = await getTodayWaterScore();
  setState({ dailyWaterScore: todayWaterScore });

  // Silent PWA update check 3 seconds after paint
  setTimeout(() => {
    window.__pwaCheckForUpdates(false);
  }, 3000);
}

initializeApp();
