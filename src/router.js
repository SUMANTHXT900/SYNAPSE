import { getState } from './state.js';

function escapeHTML(str) {
  if (typeof str !== 'string') return str ?? '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatLongDate(dateStr) {
  if (!dateStr) return 'Unknown Date';
  const [year, month, day] = dateStr.split('-');
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatElapsedTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMin = String(minutes).padStart(2, '0');
  const paddedSec = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${paddedMin}:${paddedSec}`;
  }
  return `${paddedMin}:${paddedSec}`;
}

function formatDuration(totalMs) {
  if (totalMs == null || isNaN(totalMs)) return '0s';
  const totalSeconds = Math.floor(totalMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0 && secs > 0) return `${minutes}m ${secs}s`;
  return `${minutes}m`;
}

export function renderGoalCard(goal) {
  const statusColors = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    active: 'bg-blue-100 text-blue-700 border-blue-200',
    partial: 'bg-orange-100 text-orange-700 border-orange-200',
    completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    abandoned: 'bg-red-100 text-red-700 border-red-200'
  };

  const statusLabel = goal.status.charAt(0).toUpperCase() + goal.status.slice(1);
  const statusClass = statusColors[goal.status] || 'bg-gray-100 text-gray-700 border-gray-200';
  const sessionCount = goal.sessions ? goal.sessions.filter(s => s.end_time != null).length : 0;
  const timeStr = goal.totalTimeMs > 0 ? formatDuration(goal.totalTimeMs) : 'No time logged';

  const hasProgress = goal.totalTimeMs > 0 || sessionCount > 0;
  const displayStatus = (goal.status === 'pending' && hasProgress) ? 'Paused' : statusLabel;
  const displayStatusClass = (goal.status === 'pending' && hasProgress) ? 'bg-purple-100 text-purple-700 border-purple-200' : statusClass;

  return `
    <div data-goal-id="${goal.id}" class="goal-card bg-white rounded-3xl p-5 shadow-sm border border-gray-100 transition-all hover:shadow-md">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex-1 min-w-0">
          <h4 class="text-base font-bold text-gray-900 truncate">${escapeHTML(goal.subject)}</h4>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${displayStatusClass}">${displayStatus}</span>
            <span class="text-xs text-gray-400 font-medium">${sessionCount} sessions · ${timeStr}</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2 pt-3 border-t border-gray-100">
        <button data-action="edit" data-goal-id="${goal.id}" class="goal-action-btn flex-1 flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-gray-50 hover:bg-purple-50 text-gray-600 hover:text-purple-700 font-semibold text-sm transition-all active:scale-[0.98]">
          <span class="text-base">✏️</span>
          Edit
        </button>
        <button data-action="history" data-goal-id="${goal.id}" class="goal-action-btn flex-1 flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-700 font-semibold text-sm transition-all active:scale-[0.98]">
          <span class="text-base">📜</span>
          History
        </button>
        <button data-action="delete" data-goal-id="${goal.id}" class="goal-action-btn flex-1 flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-700 font-semibold text-sm transition-all active:scale-[0.98]">
          <span class="text-base">🗑️</span>
          Delete
        </button>
      </div>
    </div>
  `;
}

export function renderHome(container, callbacks) {
  const state = getState();
  const greeting = state.userName ? `Hey ${escapeHTML(state.userName)}, let's get to work` : 'Hey there, let\'s get to work';

  container.innerHTML = `
    <header class="md:hidden w-full bg-[#F2F2F7]/90 backdrop-blur-md sticky top-0 z-40 px-4 py-4 flex items-center justify-between border-b border-gray-200/50">
      <div class="flex items-center gap-2">
        <div class="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-sm">S</div>
        <span class="font-outfit font-bold text-lg tracking-tight text-gray-900">SYNAPSE</span>
      </div>
      <div id="db-status-mobile" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold tracking-widest uppercase">
        <span id="db-dot-mobile" class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span id="db-label-mobile">Connected</span>
      </div>
    </header>

    <div class="max-w-5xl mx-auto w-full p-4 md:p-8 pb-10">
      <div class="flex items-end justify-between mb-6 md:mb-8 px-1">
        <div>
          <h2 class="text-2xl md:text-4xl font-outfit font-extrabold text-gray-900 tracking-tight">${greeting}</h2>
          <p class="text-sm md:text-base text-gray-500 mt-1 font-medium" id="header-date">${formatLongDate(state.currentDate)}</p>
        </div>
        <div id="db-status-desktop" class="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold tracking-widest uppercase shadow-sm">
          <span id="db-dot-desktop" class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span id="db-label-desktop">Local Live</span>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <div id="water-card" class="bg-white rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[300px] md:min-h-[340px] border border-gray-100">
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <div class="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-xl">💧</div>
              <span class="text-[10px] font-bold text-blue-500 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-lg">Hydration</span>
            </div>
            <h3 class="text-xl font-outfit font-bold text-gray-900 mt-2">Daily Intake</h3>
            <p class="text-sm text-gray-500 font-medium">Keep your mental acuity sharp. Stay hydrated, stay sharp.</p>
          </div>
          <div class="my-4 flex items-end gap-2 border-l-4 border-blue-500 pl-4 py-1">
            <span id="hydration-placeholder" class="text-5xl font-outfit font-black text-gray-900 tracking-tight">${state.dailyWaterScore}</span>
            <span class="text-sm text-gray-400 font-bold mb-1">points today</span>
          </div>
          <button id="btn-log-water" class="w-full min-h-[56px] rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-base transition-colors flex items-center justify-center gap-2">
            Log Water
          </button>
        </div>

        <div id="study-card" class="bg-white rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[300px] md:min-h-[340px] border border-gray-100 transition-colors duration-300">
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <div class="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-xl">📚</div>
              <span class="text-[10px] font-bold text-purple-600 uppercase tracking-widest bg-purple-50 px-2 py-1 rounded-lg">Focus</span>
            </div>
            <h3 class="text-xl font-outfit font-bold text-gray-900 mt-2">Study Session</h3>
            <p class="text-sm text-gray-500 font-medium">Your desk is waiting. Tap below to focus.</p>
          </div>
          <div class="my-4" id="study-status">
            <div class="flex items-center gap-2 border-l-4 border-gray-200 pl-4 py-3">
              <span class="text-lg font-semibold text-gray-400">No active session</span>
            </div>
          </div>
          <button id="btn-start-study" class="w-full min-h-[56px] rounded-2xl bg-gray-900 hover:bg-black text-white font-bold text-base transition-colors shadow-sm flex items-center justify-center gap-2">
            Start Session
          </button>
        </div>

        <div class="bg-white rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[300px] md:min-h-[340px] border border-gray-100">
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <div class="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-xl">⚡</div>
              <span class="text-[10px] font-bold text-orange-600 uppercase tracking-widest bg-orange-50 px-2 py-1 rounded-lg">Activity</span>
            </div>
            <h3 class="text-xl font-outfit font-bold text-gray-900 mt-2">Today's Progress</h3>
            <p class="text-sm text-gray-500 font-medium">Your daily performance at a glance.</p>
          </div>
          <div class="my-4">
            <div class="space-y-3">
              <div class="flex items-center justify-between border-l-4 border-purple-500 pl-3 py-1">
                <span class="text-sm text-gray-500 font-medium">Study Time</span>
                <span id="today-study-time" class="text-lg font-outfit font-bold text-gray-900">0m</span>
              </div>
              <div class="flex items-center justify-between border-l-4 border-blue-500 pl-3 py-1">
                <span class="text-sm text-gray-500 font-medium">Water Score</span>
                <span class="text-lg font-outfit font-bold text-gray-900"><span id="today-water-score">0</span> pts</span>
              </div>
              <div class="flex items-center justify-between border-l-4 border-emerald-500 pl-3 py-1">
                <span class="text-sm text-gray-500 font-medium">Goals Active</span>
                <span id="today-goals-count" class="text-lg font-outfit font-bold text-gray-900">0</span>
              </div>
            </div>
          </div>
          <button id="btn-today-goals" class="w-full min-h-[56px] rounded-2xl bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-base transition-colors flex items-center justify-center gap-2">
            View Goals
          </button>
        </div>
      </div>
    </div>
  `;

  if (callbacks && callbacks.onHomeMounted) {
    callbacks.onHomeMounted();
  }
}

export function renderAnalysis(container, callbacks) {
  const state = getState();
  const activeRange = state.analysisDateRange || '7days';
  const ranges = [
    { key: '7days', label: '7D' },
    { key: '30days', label: '30D' },
    { key: 'month', label: 'Month' },
    { key: 'all', label: 'All' }
  ];

  container.innerHTML = `
    <header class="md:hidden w-full bg-[#F2F2F7]/90 backdrop-blur-md sticky top-0 z-40 px-4 py-4 flex items-center justify-between border-b border-gray-200/50">
      <div class="flex items-center gap-2">
        <div class="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-sm">S</div>
        <span class="font-outfit font-bold text-lg tracking-tight text-gray-900">SYNAPSE</span>
      </div>
      <div id="db-status-mobile-analysis" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold tracking-widest uppercase">
        <span id="db-dot-mobile-analysis" class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span id="db-label-mobile-analysis">Connected</span>
      </div>
    </header>

    <div class="max-w-5xl mx-auto w-full p-4 md:p-8 pb-10">

      <!-- Title + Desktop DB Badge -->
      <div class="flex items-end justify-between mb-6 md:mb-8 px-1">
        <div>
          <h2 class="text-2xl md:text-4xl font-outfit font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            Analysis
            <span class="text-2xl md:text-3xl">📊</span>
          </h2>
          <p class="text-sm md:text-base text-gray-500 mt-1 font-medium">Deep insights into your focus and hydration patterns.</p>
        </div>
        <div id="db-status-desktop-analysis" class="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold tracking-widest uppercase shadow-sm">
          <span id="db-dot-desktop-analysis" class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span id="db-label-desktop-analysis">Local Live</span>
        </div>
      </div>

      <!-- Date Range Selector (iOS-style Segmented Control) -->
      <div class="bg-white/80 backdrop-blur-sm rounded-2xl p-1.5 shadow-sm border border-gray-100/80 mb-6 md:mb-8 inline-flex w-full max-w-sm mx-auto md:mx-0" id="analysis-date-range">
        ${ranges.map(r => `
          <button data-range="${r.key}" class="range-tab flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${r.key === activeRange ? 'active' : 'text-gray-500 hover:text-gray-900'}">${r.label}</button>
        `).join('')}
      </div>

      <!-- Content area: either empty state or full dashboard -->
      <div id="analysis-content">

        <!-- Empty State (shown when no data, hidden by default) -->
        <div id="analysis-empty-state" class="hidden flex-col items-center justify-center min-h-[400px] text-center px-6">
          <div class="text-6xl mb-6 animate-gentle-pulse">📊</div>
          <h3 class="text-2xl font-outfit font-bold text-gray-800 mb-2">No data yet</h3>
          <p class="text-gray-400 font-medium max-w-sm">Start a study session or log some water to unlock rich analytics and insights about your performance.</p>
        </div>

        <!-- Full Dashboard (hidden by default) -->
        <div id="analysis-dashboard" class="hidden flex-col gap-6">

          <!-- Hero Stats Row -->
          <div id="analysis-hero" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            ${[0,1,2].map(() => '<div class="shimmer-card !h-[130px]"></div>').join('')}
          </div>

          <!-- Weekly Study Trend -->
          <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100/80" id="analysis-trend-section">
            <div class="shimmer-card !h-[260px]"></div>
          </div>

          <!-- Focus + Goals Row -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100/80" id="analysis-focus-section">
              <div class="shimmer-card !h-[300px]"></div>
            </div>
            <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100/80" id="analysis-goals-section">
              <div class="shimmer-card !h-[300px]"></div>
            </div>
          </div>

          <!-- Insights Row -->
          <div id="analysis-insights" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            ${[0,1,2].map(() => '<div class="shimmer-card !h-[120px]"></div>').join('')}
          </div>

          <!-- Hydration Section -->
          <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100/80" id="analysis-hydration-section">
            <div class="shimmer-card !h-[260px]"></div>
          </div>

          <!-- Hydration Type Breakdown -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100/80" id="analysis-hydration-types">
              <div class="shimmer-card !h-[200px]"></div>
            </div>
            <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100/80" id="analysis-hydration-stats">
              <div class="shimmer-card !h-[200px]"></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  if (callbacks && callbacks.onAnalysisMounted) {
    callbacks.onAnalysisMounted();
  }
}

export function renderStudy(container, callbacks) {
  const state = getState();

  container.innerHTML = `
    <header class="md:hidden w-full bg-[#F2F2F7]/90 backdrop-blur-md sticky top-0 z-40 px-4 py-4 flex items-center justify-between border-b border-gray-200/50">
      <div class="flex items-center gap-2">
        <div class="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-sm">S</div>
        <span class="font-outfit font-bold text-lg tracking-tight text-gray-900">SYNAPSE</span>
      </div>
      <div id="db-status-mobile-study" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold tracking-widest uppercase">
        <span id="db-dot-mobile-study" class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span id="db-label-mobile-study">Connected</span>
      </div>
    </header>

    <div class="max-w-5xl mx-auto w-full p-4 md:p-8 pb-10">
      <div class="flex items-end justify-between mb-6 md:mb-8 px-1">
        <div>
          <h2 class="text-2xl md:text-4xl font-outfit font-extrabold text-gray-900 tracking-tight">Study</h2>
          <p class="text-sm md:text-base text-gray-500 mt-1 font-medium">Your command center. Manage goals, track progress.</p>
        </div>
      </div>

      <div id="goals-active-section" class="mb-8">
        <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 px-1">Active & Pending</h3>
        <div id="goals-active-list" class="flex flex-col gap-3">
          <div class="text-center py-12 text-gray-400 font-medium">Loading goals...</div>
        </div>
      </div>

      <div id="goals-archive-section">
        <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 px-1">Completed & Archived</h3>
        <div id="goals-archive-list" class="flex flex-col gap-3">
          <div class="text-center py-8 text-gray-400 font-medium">No archived goals</div>
        </div>
      </div>
    </div>
  `;

  if (callbacks && callbacks.onStudyMounted) {
    callbacks.onStudyMounted();
  }
}

export function renderSettings(container, callbacks) {
  const state = getState();
  const displayName = escapeHTML(state.userName) || 'Guest';

  container.innerHTML = `
    <header class="md:hidden w-full bg-[#F2F2F7]/90 backdrop-blur-md sticky top-0 z-40 px-4 py-4 flex items-center justify-between border-b border-gray-200/50">
      <div class="flex items-center gap-2">
        <div class="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-sm">S</div>
        <span class="font-outfit font-bold text-lg tracking-tight text-gray-900">SYNAPSE</span>
      </div>
      <div id="db-status-mobile-settings" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold tracking-widest uppercase">
        <span id="db-dot-mobile-settings" class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span id="db-label-mobile-settings">Connected</span>
      </div>
    </header>

    <div class="max-w-5xl mx-auto w-full p-4 md:p-8 pb-10">
      <div class="flex items-end justify-between mb-6 md:mb-8 px-1">
        <div>
          <h2 class="text-2xl md:text-4xl font-outfit font-extrabold text-gray-900 tracking-tight">Settings</h2>
          <p class="text-sm md:text-base text-gray-500 mt-1 font-medium">Manage your profile and app data.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div class="flex items-center gap-4 mb-6">
            <div class="w-16 h-16 rounded-3xl bg-blue-600 flex items-center justify-center text-white font-bold text-2xl shadow-sm">${state.userName ? displayName.charAt(0).toUpperCase() : '👤'}</div>
            <div>
              <h3 class="text-xl font-outfit font-bold text-gray-900">${displayName}</h3>
              <p class="text-sm text-gray-500 font-medium">Synapse User</p>
            </div>
          </div>
          <button id="btn-edit-name" class="w-full min-h-[56px] rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-base transition-colors flex items-center justify-center gap-2">
            Edit Name
          </button>
        </div>

        <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-outfit font-bold text-gray-900">About Synapse</h3>
            <div class="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-xl">🧠</div>
          </div>
          <div class="flex flex-col gap-3 text-sm text-gray-500 font-medium">
            <div class="flex items-center justify-between py-2 border-b border-gray-100">
              <span>Version</span>
              <span class="font-bold text-gray-900">v${state.appVersion}</span>
            </div>
            <div class="flex items-center justify-between py-2 border-b border-gray-100">
              <span>Storage</span>
              <span class="font-bold text-emerald-600">Offline (IndexedDB)</span>
            </div>
            <div class="flex items-center justify-between py-2 border-b border-gray-100">
              <span>Built with</span>
              <span class="font-bold text-gray-900">Vanilla JS + Dexie</span>
            </div>
            ${state.versionNote ? `
            <div class="pt-2 mt-1 border-t border-dashed border-gray-200">
              <p class="text-[10px] text-gray-400 leading-relaxed">${escapeHTML(state.versionNote)}</p>
            </div>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- App Update Center -->
      <div class="mt-6">
        <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-outfit font-bold text-gray-900">System Update</h3>
            <div class="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-xl">🔄</div>
          </div>
          <p id="pwa-status-text" class="text-xs text-gray-400 font-medium mb-4">${state.updateStatusText}</p>
          <div class="flex flex-col gap-2" id="pwa-actions-container">
            <button id="btn-check-updates" class="w-full min-h-[50px] rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-sm transition-colors flex items-center justify-center gap-2">
              Check for Updates
            </button>
            ${state.updateAvailable ? `
              <button id="btn-install-update" class="w-full min-h-[50px] rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/20">
                ✨ Install Update & Relaunch
              </button>
            ` : ''}
          </div>

          <div id="pwa-terminal" aria-live="polite" class="mt-4 bg-slate-950 text-emerald-400 font-mono text-[10px] sm:text-xs p-4 rounded-xl h-32 overflow-y-auto flex-col gap-1 shadow-inner hidden border border-slate-800">> </div>
        </div>
      </div>

      <div class="mt-6">
        <div class="bg-red-50 border border-red-200 rounded-3xl p-6 shadow-sm">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center text-lg">⚠️</div>
            <div>
              <h3 class="text-lg font-outfit font-bold text-red-900">Danger Zone</h3>
              <p class="text-sm text-red-600 font-medium">Irreversible actions that wipe your data.</p>
            </div>
          </div>
          <button id="btn-delete-all-data" class="w-full min-h-[56px] rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-base transition-colors shadow-sm flex items-center justify-center gap-2">
            Delete All Data
          </button>
        </div>
      </div>
    </div>
  `;

  if (callbacks && callbacks.onSettingsMounted) {
    callbacks.onSettingsMounted();
  }
}
