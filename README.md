# Synapse 🧠

> A premium, offline-first Progressive Web App for exam productivity, hydration tracking, and habit management — built with vanilla JavaScript.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Architecture](#-architecture)
- [Database Schema](#-database-schema)
- [State Management](#-state-management)
- [Routing & Views](#-routing--views)
- [Services](#-services)
- [Analytics](#-analytics)
- [Progressive Web App](#-progressive-web-app)
- [Accessibility](#-accessibility)
- [Mobile & Android](#-mobile--android)
- [Scripts](#-scripts)
- [Design Philosophy](#-design-philosophy)
- [Version History](#-version-history)

---

## 🌟 Overview

Synapse is a **local-first Progressive Web App (PWA)** designed for students preparing for competitive exams. It helps you track study sessions, manage goals, log hydration, and gain deep insights into your productivity patterns — all without needing an internet connection or a backend server.

Every piece of data lives in your browser's IndexedDB. No accounts, no APIs, no cloud sync. Your data stays yours.

Synapse is **installable** on your phone's home screen with a rich manifest, custom icons, and app-store-style installation screenshots.

---

## ✨ Features

### 📚 Study Command Center
- **Start/Pause/Stop** study sessions with a single tap
- **Goal management** — create, edit, archive, and delete study goals
- **Goal-centric sessions** — link each session to a specific subject/goal
- **End-session feedback** — record goal status (completed / paused / abandoned) and focus quality (deep / okay / distracted)
- **Inline validation** — error messages appear inside modals instead of browser `alert()` dialogs
- **Smart status labels** — paused goals show a purple **"Paused"** badge instead of amber **"Pending"**, making progress visible at a glance
- **Live timer** — real-time elapsed time display during active sessions

### 💧 Hydration Tracker
- **6 preset water amounts** — from "Just a Sip" to "Full Bottle"
- **Custom scoring** — enter any number for personalized logging
- **Daily score** — running total of hydration points for today
- **Undo support** — each logged entry shows a 5-second undo toast
- **Type breakdown** — see which water types you log most

### 📊 Deep Analytics
- **Date range selector** — 7D / 30D / Month / All Time
- **Hero stats** — total study time, study streak, today's hydration
- **Weekly study trend** — animated bar chart showing daily focus time
- **Focus quality donut** — SVG donut chart with percentages and counts
- **Goal performance** — completion rate ring + per-goal breakdown
- **Smart insights** — best day of week, best time of day, longest streak
- **Hydration trends** — weekly bar chart + type distribution + all-time stats
- **Empty state** — clear call-to-action when no data exists yet

### 🏠 Home Dashboard
- **Water card** — log hydration, see today's score
- **Study card** — start/stop sessions, live timer, active session indicators
- **Today's Progress card** — at-a-glance stats for today's study time, water score, and active goal count; tap to jump to Study view

### ⚙️ Settings
- **Personalize** — set your display name (avatar shows 👤 when no name is set)
- **App Update Center** — live terminal output showing PWA update diagnostics with LAN / localhost detection
- **Version notes** — latest changes displayed in the About section
- **Data management** — delete all data with a single confirmation action
- **Reactive DB health badge** — green "Connected" or red error state

### 📱 Mobile-First Design
- **Responsive layout** — bottom nav on mobile, sidebar on desktop
- **View transitions** — fade-slide-up animation on every navigation swap
- **Android touch fix** — proper touch event routing for Chrome
- **Safe area support** — handles notches and home indicators
- **Dynamic DB health badge** — consistent reactive indicator across all 4 views

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Language** | Vanilla JavaScript (ES Modules) |
| **Bundler** | Vite 8 |
| **Styling** | Tailwind CSS 3.4 + custom CSS |
| **Database** | IndexedDB via Dexie.js 4.4 |
| **PWA** | vite-plugin-pwa (Service Worker + manifest) |
| **Build** | PostCSS + Autoprefixer |
| **Fonts** | Outfit (headings) + Inter (body) via Google Fonts |

**Zero frameworks. Zero runtime dependencies. PWA via build plugin only.**

---

## 📁 Project Structure

```
SYNAPSE/
├── index.html                    # App shell + nav + viewport meta + apple-touch-icon
├── package.json                  # Dependencies + scripts
├── vite.config.js                # Vite + PWA plugin config with manifest + screenshots
├── tailwind.config.js            # Tailwind config with font extensions
├── postcss.config.js             # PostCSS + Tailwind + Autoprefixer
├── .gitignore                    # Git ignore rules
│
├── public/
│   ├── favicon.svg               # Tab favicon
│   ├── pwa-192x192.png           # PWA icon (192px)
│   ├── pwa-512x512.png           # PWA icon (512px, also maskable)
│   ├── apple-touch-icon.png      # iOS home screen icon
│   ├── screenshot-mobile.png     # Install prompt screenshot (1080×2400)
│   └── screenshot-desktop.png    # Install prompt screenshot (1920×1080)
│
└── src/
    ├── main.js                   # App entry: state subscription, event binding, PWA updater, view rendering
    ├── state.js                  # Publish/subscribe state management with batched changedKeys
    ├── db.js                     # Dexie IndexedDB schema + UUID helper + health check
    ├── router.js                 # View renderers: Home, Study, Analysis, Settings
    ├── modal.js                  # Reusable modal system (backdrop, animations, keyboard close)
    ├── style.css                 # Tailwind imports + custom animations + utilities + focus-visible
    │
    ├── services/
    │   ├── studyService.js       # Session CRUD, goal operations, active session tracking
    │   ├── waterService.js       # Water logging, daily score calculation
    │   └── analysisService.js    # Analytics engine: trends, distributions, insights
    │
    └── assets/                   # Reserved for images/icons
        ├── hero.png
        ├── javascript.svg
        └── vite.svg
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ (for Vite)
- **Modern browser** with IndexedDB support (Chrome 92+, Firefox 90+, Safari 15+)

### Install & Run

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

### PWA Testing

Service Workers require HTTPS or localhost. For full PWA testing:
- **Localhost** works out of the box with `npm run dev`
- **LAN access** (e.g., `http://192.168.x.x:5173`) — PWA features are disabled; the update engine gracefully detects this and logs the reason
- **Production** — deploy to Cloudflare Pages or any HTTPS host for the complete PWA experience

---

## 🏗 Architecture

### Data Flow

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   User UI   │────▶│  main.js     │────▶│   Services    │
│  (buttons)  │     │  (events)    │     │  (business)   │
└─────────────┘     └──────┬───────┘     └───────┬───────┘
                           │                     │
                    ┌──────▼───────┐     ┌───────▼───────┐
                    │    State     │◀────│   IndexedDB   │
                    │ (pub/sub)    │     │   (Dexie)     │
                    └──────┬───────┘     └───────────────┘
                           │
                    ┌──────▼───────┐
                    │  Subscribe   │
                    │  (render)    │
                    └──────────────┘
```

1. **User interacts** with the UI (clicks a button)
2. **main.js** captures the event via event listener
3. **Service** performs the business logic (e.g., `logWater()`)
4. **Service** writes to **IndexedDB** via Dexie
5. **State** is updated via `setState()` with batch-changed-keys tracking
6. **Subscribe** callback fires, checking `hasChanged()` for specific keys
7. **Router** updates the DOM with new data (with view transition animation)

### Key Design Decisions

| Decision | Reason |
|----------|--------|
| **No framework** | Minimal bundle, full control, faster load on slow networks |
| **IndexedDB** | Persistent, large storage (~50MB+), works offline |
| **Dexie.js** | Clean API over raw IndexedDB, handles migrations |
| **Publish/Subscribe** | Lightweight state management, batched changedKeys to avoid double-firing |
| **innerHTML rendering** | Simple, fast, no virtual DOM needed for this scale |
| **UUIDs (not auto-increment)** | Collision-free for future export/import feature |
| **vite-plugin-pwa** | Zero-config Service Worker generation with workbox caching |

---

## 🗄 Database Schema

Synapse uses **5 Dexie database versions** with automatic schema migrations:

### Stores

| Store | Indexes | Purpose |
|-------|---------|---------|
| `goals` | `id`, `subject`, `status` | Study goals with lifecycle tracking |
| `study_sessions` | `id`, `goal_id`, `date`, `start_time`, `end_time`, `goal_status_after`, `focus_quality` | Individual study sessions linked to goals |
| `water_logs` | `id`, `timestamp`, `score`, `type` | Hydration intake records |
| `exercises` | `id`, `name`, `muscle_group` | Reserved for workout feature |
| `workout_sessions` | `id`, `exercise_id`, `date`, `total_volume` | Reserved for workout feature |
| `active_sessions` | `id`, `session_type` | Tracks currently running sessions |
| `user_profile` | `id` | User name and preferences |

### Version History

| Version | Change |
|---------|--------|
| v1 | Initial schema with all stores |
| v2 | Removed `priority` and `category` indexes from goals |
| v3 | Added `user_profile` store |
| v4 | Added `goal_status_after` and `focus_quality` to study_sessions |
| v5 | Added `date` index to study_sessions for cross-day analysis |

---

## 🔄 State Management

Synapse uses a **lightweight publish/subscribe pattern** in `src/state.js`:

```javascript
// State shape
const state = {
  currentDate: '2026-05-21',
  userName: null,
  currentView: 'home',
  activeStudySession: null,
  dailyWaterScore: 0,
  analysisDateRange: '7days',
  updateAvailable: false,
  isCheckingForUpdates: false,
  updateStatusText: 'Running the latest version of Synapse',
  appVersion: '0.4.0',
  versionNote: '...',
  updateLogs: []
};
```

### API

| Function | Purpose |
|----------|---------|
| `getState()` | Returns a frozen snapshot of current state |
| `setState({ key: value })` | Merges updates, collects changed keys, notifies subscribers once |
| `subscribe(callback)` | Registers a listener; fires immediately with `(state, null)` for bootstrap |

### How It Works

```javascript
export function setState(updates) {
  let hasChanges = false;
  const changedKeys = [];

  for (const key in updates) {
    if (key in state && state[key] !== updates[key]) {
      state[key] = updates[key];
      hasChanges = true;
      changedKeys.push(key);
    }
  }

  if (hasChanges) {
    subscribers.forEach(cb => cb(getState(), changedKeys));
  }
}
```

When `setState()` is called, all changed keys are collected into an array and subscribers fire **once** with the full batch. The main subscriber in `main.js` uses a `hasChanged(key)` helper to selectively react:

```javascript
subscribe((state, changedKeys) => {
  const hasChanged = (k) => !changedKeys || changedKeys.includes(k);

  if (hasChanged('currentView')) {
    updateNavActiveState(state.currentView);
    renderCurrentView();
  }
  if (hasChanged('dailyWaterScore')) {
    // update hydration display
  }
  // ... etc
});
```

This prevents the double-firing issue that occurs when multiple state keys are updated in a single call.

---

## 🗺 Routing & Views

Synapse uses a **state-driven view router** — no URL-based routing, just React-style state-to-view mapping:

| View | Component | Description |
|------|-----------|-------------|
| `home` | `renderHome()` | Dashboard with water, study, and today's progress cards |
| `study` | `renderStudy()` | Goal list with edit/history/delete actions |
| `analysis` | `renderAnalysis()` | Analytics dashboard with charts and insights |
| `settings` | `renderSettings()` | Profile, app info, update center, and data management |

### View Lifecycle

1. `setState({ currentView: 'study' })` triggers state change
2. Subscribe callback picks up `hasChanged('currentView')` and calls `renderCurrentView()`
3. `renderCurrentView()` applies a `view-enter` CSS animation class for smooth transitions
4. The appropriate `render*()` function sets `container.innerHTML` and calls `callbacks.on*Mounted()`
5. `on*Mounted()` fetches data from Dexie and populates the view

---

## 📦 Services

### `studyService.js`

| Function | Description |
|----------|-------------|
| `getPendingGoals()` | Returns goals with status: pending, active, partial (with computed total time) |
| `startStudySession(goalId, newSubject)` | Creates a new session, updates active_sessions tracking |
| `stopStudySession(sessionId, goalAction, focusQuality)` | Ends session, updates goal status (completed/paused/abandoned) |
| `getActiveStudySession()` | Returns the currently running session (if any) — picks up orphaned sessions on page reload |
| `getAllGoalsWithHistory()` | Returns all goals with their sessions and computed total time |
| `updateGoal(goalId, newSubject)` | Updates a goal's subject |
| `deleteGoal(goalId)` | Atomic transaction: deletes goal + all related sessions + active records |

### `waterService.js`

| Function | Description |
|----------|-------------|
| `logWater(type, customAmount)` | Records a water intake event with score from hydration mapping |
| `getTodayWaterScore()` | Calculates total hydration points for today via timestamp range query |

### `analysisService.js`

| Function | Description |
|----------|-------------|
| `getAnalyticsData(dateRange)` | Master function — returns all computed analytics in one object |
| `getDateBounds(range)` | Converts range string (7days/30days/month/all) to timestamp bounds |
| `getStudySummary()` | Total sessions, time, averages, today/this week labels |
| `getWeeklyTrend()` | Daily study minutes for the selected range |
| `getFocusDistribution()` | Deep/okay/distracted counts and percentages |
| `getGoalPerformance()` | Completion rate ring data + per-goal detail |
| `getStudyStreak()` | Current and longest consecutive study days |
| `getMostProductiveDay()` | Best day of week by average study time |
| `getBestTimeOfDay()` | Morning/afternoon/night performance comparison |
| `getHydrationSummary()` | Today, week, all-time hydration stats |
| `getHydrationTrend()` | Daily water scores for the selected range |
| `getHydrationTypeBreakdown()` | Water type distribution with percentages and colors |

---

## 📊 Analytics

The Analysis tab provides a **comprehensive dashboard** with:

### Study Metrics
- **Total study time** across all sessions
- **Session count** and average duration
- **Weekly trend** — CSS bar chart (purple→pink gradient) with hover tooltips
- **Focus quality** — SVG donut chart (indigo/blue/red segments)
- **Goal completion rate** — SVG green ring chart
- **Per-goal breakdown** — top 5 goals by time spent
- **Study streak** — current and longest consecutive days
- **Best day** — which day of week you study most
- **Best time** — morning/afternoon/night performance

### Hydration Metrics
- **Today's score** — running total of hydration points
- **Weekly trend** — animated bar chart (blue gradient)
- **Type distribution** — horizontal bars with color-coded types
- **All-time stats** — average daily, total points, best day

### Date Ranges
All analytics support **4 time ranges**:
- **7D** — Last 7 days
- **30D** — Last 30 days
- **Month** — Current calendar month (dynamic)
- **All** — All-time data (epoch-based)

### Animations
- Cards: staggered fade + slide up with spring easing
- Bar charts: bars grow from 0 with spring animation
- Donut chart: segments fill with stroke-dashoffset animation
- Horizontal bars: width animates from 0 to target
- Hover: tooltips on bars, scale effect on cards

---

## 📱 Progressive Web App

Synapse is a fully installable PWA with the following features:

### Service Worker
- **Auto-caching** — all app assets (JS, CSS, HTML, images) precached via workbox
- **Google Fonts caching** — runtime cache for font files with 1-year expiration
- **Offline support** — the app works completely offline after the initial visit

### Update Manager
- **Silent launch check** — automatic update check 3 seconds after app startup
- **Manual check** — "Check for Updates" button in Settings
- **Live terminal output** — real-time logging of network diagnostics
- **Environment detection** — identifies localhost, LAN IP, and secure context
  - Localhost: bypasses update check, shows "Running locally"
  - LAN HTTP: warns that mobile browsers disable PWAs on unsecure origins
- **Toast notification** — floating "Update live!" toast with one-tap relaunch

### Install Manifest
- **Name:** Synapse — Focus & Resilience
- **Display:** standalone (full-screen, no browser chrome)
- **Icons:** 192×192, 512×512 (with maskable purpose for adaptive icons)
- **Screenshots:** mobile (1080×2400) and desktop (1920×1080) for install prompts
- **Theme color:** `#007AFF`
- **Background color:** `#F2F2F7`

### iOS
- **Apple Touch Icon** — 180×180 PNG for iOS home screen
- **Viewport-fit** — `cover` for notched devices

---

## ♿ Accessibility

| Feature | Implementation |
|---------|---------------|
| **Focus indicators** | `focus-visible` outline on all buttons, nav items, range tabs, and goal actions |
| **ARIA live regions** | Timer (`aria-live="polite"`), terminal logs (`aria-live="polite"`), toast (`role="alert"`) |
| **Form validation** | Inline error messages with `role="alert"` instead of `alert()` dialogs |
| **Touch targets** | All buttons ≥ 44×44px (min-h-[44px] or min-h-[56px]) |
| **Keyboard modals** | Escape key closes modals; Enter/Space activates buttons |
| **Reduced motion** | All animations use CSS transitions/animations that respect `prefers-reduced-motion` |
| **Color contrast** | WCAG AA-compliant text colors; emerald-700, red-700, blue-700 for status labels |

---

## 📱 Mobile & Android

### Touch Event Fix

Android Chrome has a known issue where `overflow-y: auto` on a scroll container intercepts touch events before they reach buttons. Synapse addresses this with:

1. **Layout fix** — `html` has `overflow-hidden`, `body` uses `h-full` (no `position: fixed`)
2. **Touch action** — `touch-manipulation` on the scroll container eliminates 300ms delay
3. **Overscroll** — `overscroll-contain` prevents pull-to-refresh interference
4. **Debounced fallback** — global `touchend` listener fires `click` on buttons with 500ms debounce

### UUID Generation

`crypto.randomUUID()` requires a Secure Context (HTTPS). On mobile LAN access (HTTP), Synapse uses a **fallback UUID generator**:

```javascript
export function generateId() {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
```

### DB Health Check

On app startup, Synapse verifies IndexedDB is operational and updates status badges across all views:
- **Green "Connected"** — DB is working
- **Red error message** — DB unavailable

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Build optimized production bundle to `dist/` |
| `npm run preview` | Serve the production build locally |

---

## 🎨 Design Philosophy

### Apple-Inspired Aesthetic
- **Bright, colorful gradients** — purple→pink, blue→cyan, orange→red, green→emerald
- **Generous whitespace** — cards have ample padding and spacing
- **Rounded corners** — `rounded-3xl` (24px) on all cards
- **Soft shadows** — `shadow-sm` for subtle depth
- **Glass effects** — `backdrop-blur` on sticky headers

### Typography
- **Headings**: Outfit, extrabold (800), tight tracking
- **Body**: Inter, regular (400), medium (500)
- **Labels**: 10px, uppercase, wide tracking for section headers
- **Values**: Outfit, extrabold, large sizes for hero stats

### Color System
| Color | Hex | Use |
|-------|-----|-----|
| Apple Blue | `#007AFF` | Primary actions, hydration |
| Apple Purple | `#AF52DE` | Study, focus |
| Apple Pink | `#FF2D55` | Highlights, streak |
| Apple Green | `#34C759` | Success, completion |
| Apple Orange | `#FF9500` | Energy, warnings |
| Apple Indigo | `#5856D6` | Deep focus |
| Apple Teal | `#5AC8FA` | Accent, charts |
| Apple Red | `#FF3B30` | Abandoned, danger |
| Background | `#F2F2F7` | App background |

### Interaction Design
- **Active feedback** — `active:scale-[0.98]` on all buttons
- **Hover states** — color shifts on cards and buttons
- **Smooth transitions** — `cubic-bezier(0.16, 1, 0.3, 1)` for spring-like easing
- **Staggered animations** — elements enter sequentially, not all at once
- **Tactile touch** — minimum 44px touch targets, `touch-action: manipulation`

---

## 🏷 Version History

| Version | Milestone | Changes |
|---------|-----------|---------|
| 0.4.0 | PWA-Ready | Rich install manifest with screenshots, app icons, apple touch icon, SW update manager with terminal output, LAN/localhost environment detection |
| 0.3.x | UX Perfection | Water undo toast, goal paused state, guest avatar, view transitions, focus-visible rings, inline validation, reactive DB badges across all views, today's activity card, aria-live regions |
| 0.2.x | Analytics Launch | Full data-driven analysis dashboard with date range selector, hero stats, weekly bar charts, SVG focus donut, goal completion ring, smart insights, hydration trends, type breakdown |
| 0.1.x | Foundation | Study sessions with timer, goal CRUD, water logging, PWA shell, mobile touch fixes, schema migrations v1-v5 |
