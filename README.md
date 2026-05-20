# Synapse 🧠

> A premium, offline-first exam productivity, hydration, and habit-tracking dashboard — built with vanilla JavaScript.

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
- [Mobile & Android](#-mobile--android)
- [Scripts](#-scripts)
- [Design Philosophy](#-design-philosophy)

---

## 🌟 Overview

Synapse is a **local-first Progressive Web App (PWA)** designed for students preparing for competitive exams. It helps you track study sessions, manage goals, log hydration, and gain deep insights into your productivity patterns — all without needing an internet connection or a backend server.

Every piece of data lives in your browser's IndexedDB. No accounts, no APIs, no cloud sync. Your data stays yours.

---

## ✨ Features

### 📚 Study Command Center
- **Start/Pause/Stop** study sessions with a single tap
- **Goal management** — create, edit, archive, and delete study goals
- **Goal-centric sessions** — link each session to a specific subject/goal
- **End-session feedback** — record goal status (completed / paused / abandoned) and focus quality (deep / okay / distracted)
- **Live timer** — real-time elapsed time display during active sessions

### 💧 Hydration Tracker
- **6 preset water amounts** — from "Just a Sip" to "Full Bottle"
- **Custom scoring** — enter any number for personalized logging
- **Daily score** — running total of hydration points for today
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

### ⚙️ Settings
- **Personalize** — set your display name
- **Data management** — delete all data with a single action
- **App info** — version, storage type, tech stack

### 📱 Mobile-First Design
- **Responsive layout** — bottom nav on mobile, sidebar on desktop
- **Android touch fix** — proper touch event routing for Chrome
- **Safe area support** — handles notches and home indicators
- **Offline badge** — dynamic DB health indicator

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Language** | Vanilla JavaScript (ES Modules) |
| **Bundler** | Vite 8 |
| **Styling** | Tailwind CSS 3.4 + custom CSS |
| **Database** | IndexedDB via Dexie.js 4.4 |
| **Build** | PostCSS + Autoprefixer |
| **Fonts** | Outfit (headings) + Inter (body) via Google Fonts |

**Zero frameworks. Zero dependencies beyond bundler + database.**

---

## 📁 Project Structure

```
SYNAPSE/
├── index.html                    # App shell + nav + viewport meta
├── package.json                  # Dependencies + scripts
├── tailwind.config.js            # Tailwind config with font extensions
├── postcss.config.js             # PostCSS + Tailwind + Autoprefixer
├── .gitignore                    # Git ignore rules
│
├── public/
│   ├── favicon.svg               # App icon
│   └── icons.svg                 # SVG sprite (unused, reserved)
│
└── src/
    ├── main.js                   # App entry: state subscription, event binding, init
    ├── state.js                  # Reactive Proxy-based state management
    ├── db.js                     # Dexie IndexedDB schema + UUID helper + health check
    ├── router.js                 # View renderers: Home, Study, Analysis, Settings
    ├── modal.js                  # Reusable modal system (backdrop, focus trap, animations)
    ├── style.css                 # Tailwind imports + custom animations + utilities
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

### Accessing from Mobile

When running `npm run dev`, Vite serves on your local network. Access from your phone via:
```
http://<your-computer-ip>:5173
```

> ⚠️ **Note:** `crypto.randomUUID()` requires HTTPS. Synapse includes a fallback UUID generator that works over HTTP, so mobile LAN access works without issues.

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
                    │   (Proxy)    │     │   (Dexie)     │
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
5. **State** is updated via `setState()`
6. **Subscribe** callback fires, triggering **re-render** of affected views
7. **Router** updates the DOM with new data

### Key Design Decisions

| Decision | Reason |
|----------|--------|
| **No framework** | Minimal bundle, full control, faster load on slow networks |
| **IndexedDB** | Persistent, large storage (~50MB+), works offline |
| **Dexie.js** | Clean API over raw IndexedDB, handles migrations |
| **Reactive Proxy** | Lightweight state management, no overhead |
| **innerHTML rendering** | Simple, fast, no virtual DOM needed for this scale |
| **UUIDs (not auto-increment)** | Collision-free for future export/import feature |

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

Synapse uses a **lightweight reactive Proxy** pattern in `src/state.js`:

```javascript
// State shape
const state = {
  currentDate: '2025-01-15',
  userName: null,
  currentView: 'home',
  activeStudySession: null,
  activeGoalName: null,
  activeWorkoutSession: null,
  dailyWaterScore: 0,
  analysisDateRange: '7days'
};
```

### API

| Function | Purpose |
|----------|---------|
| `getState()` | Returns a frozen snapshot of current state |
| `setState({ key: value })` | Merges updates, triggers all subscribers |
| `subscribe(callback)` | Registers a listener; fires immediately with current state |

### How It Works

```javascript
// The Proxy intercepts all property assignments
const stateProxy = new Proxy(state, {
  set(target, property, value) {
    target[property] = value;
    subscribers.forEach(cb => cb({ ...target }, property));
    return true;
  }
});
```

When `setState()` is called, every subscriber callback runs. The main subscriber in `main.js` checks which key changed and re-renders only the affected parts.

---

## 🗺 Routing & Views

Synapse uses a **simple view router** — no URL-based routing, just state-driven view switching:

| View | Component | Description |
|------|-----------|-------------|
| `home` | `renderHome()` | Dashboard with water, study, and workout cards |
| `study` | `renderStudy()` | Goal list with edit/history/delete actions |
| `analysis` | `renderAnalysis()` | Analytics dashboard with charts and insights |
| `settings` | `renderSettings()` | Profile, app info, and data management |

### View Lifecycle

1. `setState({ currentView: 'study' })` triggers state change
2. Subscribe callback calls `renderCurrentView()`
3. `renderCurrentView()` calls the appropriate `render*()` function
4. `render*()` sets `container.innerHTML` and calls `callbacks.on*Mounted()`
5. `on*Mounted()` fetches data and populates the view

---

## 📦 Services

### `studyService.js`

| Function | Description |
|----------|-------------|
| `getPendingGoals()` | Returns goals with status: pending, active, partial |
| `startStudySession(goalId, newSubject)` | Creates a new session, updates active_sessions |
| `stopStudySession(sessionId, goalAction, focusQuality)` | Ends session, updates goal status |
| `getActiveStudySession()` | Returns the currently running session (if any) |
| `getAllGoalsWithHistory()` | Returns all goals with their sessions attached |
| `updateGoal(goalId, newSubject)` | Updates a goal's subject |
| `deleteGoal(goalId)` | Deletes a goal and all its sessions |

### `waterService.js`

| Function | Description |
|----------|-------------|
| `logWater(type, customAmount)` | Records a water intake event |
| `getTodayWaterScore()` | Calculates total hydration points for today |

### `analysisService.js`

| Function | Description |
|----------|-------------|
| `getAnalyticsData(dateRange)` | Master function — returns all computed analytics |
| `getStudySummary()` | Total sessions, time, averages |
| `getWeeklyTrend()` | Daily study minutes for the selected range |
| `getFocusDistribution()` | Deep/okay/distracted counts and percentages |
| `getGoalPerformance()` | Completion rate, per-goal stats |
| `getStudyStreak()` | Current and longest consecutive study days |
| `getMostProductiveDay()` | Best day of week by average study time |
| `getBestTimeOfDay()` | Morning/afternoon/night performance |
| `getHydrationSummary()` | Today, week, all-time hydration stats |
| `getHydrationTrend()` | Daily water scores for the selected range |
| `getHydrationTypeBreakdown()` | Water type distribution with percentages |

---

## 📊 Analytics

The Analysis tab provides a **comprehensive dashboard** with:

### Study Metrics
- **Total study time** across all sessions
- **Session count** and average duration
- **Weekly trend** — animated bar chart (purple→pink gradient)
- **Focus quality** — SVG donut chart (indigo/blue/red segments)
- **Goal completion rate** — green ring chart
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
- **Month** — Current calendar month
- **All** — All-time data

### Animations
- Cards: staggered fade + slide up (spring easing)
- Bar charts: bars grow from 0 with spring animation
- Donut chart: segments fill with stroke-dashoffset animation
- Horizontal bars: width animates from 0 to target
- Hover: tooltips on bars, scale effect on cards

---

## 📱 Mobile & Android

### Touch Event Fix

Android Chrome has a known issue where `overflow-y: auto` on a scroll container intercepts touch events before they reach buttons. Synapse addresses this with:

1. **Layout fix** — `html` has `overflow-hidden`, `body` uses `h-full` (no `position: fixed`)
2. **Touch action** — `touch-manipulation` on the scroll container eliminates 300ms delay
3. **Overscroll** — `overscroll-contain` prevents pull-to-refresh interference
4. **Fallback handler** — global `touchend` listener fires `click` on buttons as a safety net

### UUID Generation

`crypto.randomUUID()` requires a Secure Context (HTTPS). On mobile LAN access (HTTP), Synapse uses a **fallback UUID generator** based on `Math.random()`:

```javascript
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
```

### DB Health Check

On app startup, Synapse verifies IndexedDB is operational and updates the status badge:
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


