/* ============================================================
   FocusBoard — utils.js
   Common utility functions (loaded on all pages)
   ============================================================ */

/**
 * Returns the current ISO week number in "2025-W12" format
 * @returns {string}
 */
function getCurrentWeekLabel() {
  const now   = new Date();
  const year  = now.getFullYear();
  const start = new Date(year, 0, 1);
  const week  = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * "2025-W12" → returns a Date object for Monday of that week
 * @param {string} label
 * @returns {Date}
 */
function weekLabelToMonday(label) {
  const [year, w] = label.split('-W').map(Number);
  const jan1      = new Date(year, 0, 1);
  const days      = (w - 1) * 7 - jan1.getDay() + 1;
  return new Date(year, 0, 1 + days);
}

/**
 * Returns a Date as a "YYYY-MM-DD" string
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * status value → returns mapping of display label, emoji, and CSS classes
 * @param {string} status  "on_track" | "at_risk" | "blocked" | ""
 * @returns {{ emoji: string, label: string, badgeClass: string, cardClass: string }}
 */
function getStatusMeta(status) {
  switch (status) {
    case 'on_track':
      return { emoji: '🟢', label: 'On Track', badgeClass: 'badge--green',  cardClass: 'card--on-track' };
    case 'at_risk':
      return { emoji: '🟡', label: 'At Risk',  badgeClass: 'badge--yellow', cardClass: 'card--at-risk'  };
    case 'blocked':
      return { emoji: '🔴', label: 'Blocked',  badgeClass: 'badge--red',    cardClass: 'card--blocked'  };
    case 'no_update':
      return { emoji: '🔘', label: 'No Update', badgeClass: 'badge--gray',  cardClass: 'card--no-update' };
    default:
      return { emoji: '⬜', label: 'Pending',   badgeClass: 'badge--gray',   cardClass: 'card--pending'  };
  }
}

/**
 * Returns the status priority (for sorting)
 * 🔴(0) → 🟡(1) → 🟢(2) → Pending(3)
 * @param {string} status
 * @returns {number}
 */
function getStatusPriority(status) {
  const order = { blocked: 0, at_risk: 1, on_track: 2, no_update: 3 };
  return status in order ? order[status] : 4;
}

/**
 * Generic helper to fetch and return a JSON file
 * @param {string} path
 * @returns {Promise<any>}
 */
async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json();
}
