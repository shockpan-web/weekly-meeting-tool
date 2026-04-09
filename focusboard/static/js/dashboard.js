/* ============================================================
   FocusBoard — dashboard.js
   Dashboard: data loading, card generation, timeline
   ============================================================ */

const DEV_MODE    = new URLSearchParams(window.location.search).get('dev') === 'true';
const EXCEL_URL    = './weekly.xlsx';
const ANNOUNCE_URL = './announcements.xlsx';

// localStorage keys (sync with admin.js)
const LS_PROJECTS        = 'focusboard_projects';
const LS_MEMBERS         = 'focusboard_members';
const LS_TEAM_MILESTONES = 'focusboard_team_milestones';
const LS_DEACTIVATED_ANN = 'focusboard_deactivated_announce_ids';

// --------------------------------------------------------
// Data loading
// --------------------------------------------------------
// --------------------------------------------------------
// Data loading (v5.0: Firestore)
// --------------------------------------------------------
async function loadWeeklyData() {
  if (DEV_MODE) {
    return fetchJSON('./data/mock/weekly.json');
  }
  try {
    const snapshot = await db.collection('weekly').get();
    const rows = [];
    snapshot.forEach(doc => {
      rows.push(doc.data());
    });
    return rows;
  } catch (error) {
    console.error("Error loading Firebase data:", error);
    return [];
  }
}

async function loadMeta() {
  if (DEV_MODE) {
    const [members, projects, announcements] = await Promise.all([
      fetchJSON('./data/mock/members.json'),
      fetchJSON('./data/mock/projects.json'),
      fetchJSON('./data/mock/announcements.json').catch(() => []),
    ]);
    return { members, projects, announcements };
  }

  // Production: localStorage-first pattern (sync with admin.js)

  // Members: localStorage-first
  const lsMem = localStorage.getItem(LS_MEMBERS);
  const membersRaw = lsMem
    ? { members: JSON.parse(lsMem) }
    : await fetchJSON('./data/members.json');

  // Projects & team_milestones: localStorage-first
  const lsProj = localStorage.getItem(LS_PROJECTS);
  const lsTm   = localStorage.getItem(LS_TEAM_MILESTONES);

  let projectsJsonData = null;
  if (!lsProj || !lsTm) {
    // Fetch projects.json only if needed (at most once)
    try { projectsJsonData = await fetchJSON('./data/projects.json'); } catch {}
  }

  const projectsArr = lsProj ? JSON.parse(lsProj) : (projectsJsonData?.projects       || []);
  const teamMsArr   = lsTm   ? JSON.parse(lsTm)   : (projectsJsonData?.team_milestones || []);
  const projectsData = { projects: projectsArr, team_milestones: teamMsArr };

  // Announcements from Firestore
  let announcements = [];
  try {
    const snapshot = await db.collection('announcements')
      .where('active', '==', true)
      .get();
    
    snapshot.forEach(doc => {
      const r = doc.data();
      announcements.push({
        id:             doc.id,
        body:           r.text || r.body,
        level:          r.level,
        target_project: r.target === 'all' ? '' : r.target,
        start_date:     r.start_date,
        end_date:       r.end_date,
        active:         true,
      });
    });
  } catch (err) {
    console.warn("Announcements could not be loaded from Firebase:", err);
  }

  return { members: membersRaw, projects: projectsData, announcements };
}

// --------------------------------------------------------
// Initialization
// --------------------------------------------------------
async function init() {
  document.getElementById('week-label').textContent = getCurrentWeekLabel();

  const params   = new URLSearchParams(window.location.search);
  const memberId = params.get('member');

  try {
    const [weeklyRaw, { members: membersData, projects: projectsData, announcements }] = await Promise.all([
      loadWeeklyData(),
      loadMeta(),
    ]);

    // Announcement banner
    renderAnnouncement(memberId, membersData.members, announcements);

    // Admin link control
    if (memberId) {
      const me = membersData.members.find(m => m.id === memberId);
      if (me && me.role === 'manager') {
        const btn = document.getElementById('btn-admin');
        btn.style.display = '';
        btn.href = `admin.html?member=${memberId}`;
      }
    }

    // Extract this week's data only
    const currentWeek = getCurrentWeekLabel();
    const weekly = weeklyRaw.filter(r => r.week === currentWeek);

    // Card generation (passes projects for 🚨 badge)
    renderCards(weekly, membersData.members, projectsData.projects || []);

    // Summary bar
    renderSummary(weekly, membersData.members);

    // Milestone timeline (v4.0: past 2 weeks → 3 months, project colors)
    renderTimeline(projectsData);

    // Health score
    await renderHealthScore(weekly, membersData.members);

    // Focus Mode event
    bindFocusMode();

  } catch (err) {
    document.getElementById('card-grid').innerHTML =
      `<div class="banner banner--urgent">Failed to load data: ${err.message}</div>`;
  }
}

// --------------------------------------------------------
// Card generation
// --------------------------------------------------------
function renderCards(weekly, members, projects) {
  const grid = document.getElementById('card-grid');
  grid.innerHTML = '';

  // Group all rows by member_id to support multiple projects per member
  const submittedMap = new Map();
  weekly.forEach(r => {
    if (!submittedMap.has(r.member_id)) submittedMap.set(r.member_id, []);
    submittedMap.get(r.member_id).push(r);
  });

  const activeMembers = members.filter(m => m.active);

  // Sort: worst status first (🔴 → 🟡 → 🟢 → no_update → pending)
  const sorted = [...activeMembers].sort((a, b) => {
    const rowsA = submittedMap.get(a.id) || [];
    const rowsB = submittedMap.get(b.id) || [];
    const worstA = rowsA.reduce((w, r) => Math.min(w, getStatusPriority(r.status)), 999);
    const worstB = rowsB.reduce((w, r) => Math.min(w, getStatusPriority(r.status)), 999);
    return worstA - worstB;
  });

  sorted.forEach(member => {
    const rows = submittedMap.get(member.id);
    const card = rows ? buildCard(member, rows, projects) : buildPendingCard(member);
    grid.appendChild(card);
  });
}

function buildCard(member, rows, projects) {
  // Determine worst status across all projects for card-level styling
  const worstRow = rows.reduce((worst, r) =>
    getStatusPriority(r.status) < getStatusPriority(worst.status) ? r : worst
  );
  const meta = getStatusMeta(worstRow.status);

  const card = document.createElement('div');
  card.className = `card ${meta.cardClass}`;
  card.dataset.status = worstRow.status;

  // 🚨 Check: milestone within 3 days across any of this member's projects
  const today        = new Date();
  const todayStr     = today.toISOString().slice(0, 10);
  const threeDays    = new Date(today);
  threeDays.setDate(threeDays.getDate() + 3);
  const threeDaysStr = threeDays.toISOString().slice(0, 10);

  const hasUrgentMs = rows.some(row => {
    const proj = (projects || []).find(p => p.id === row.project_id);
    return (proj?.milestones || []).some(ms => ms.date >= todayStr && ms.date <= threeDaysStr);
  });

  const urgentBadge = hasUrgentMs
    ? `<span class="badge badge--red" style="font-size:10px; padding:1px 6px;">🚨</span>`
    : '';

  // Build a section for each project row
  const projectSections = rows.map((row, i) => {
    const rowMeta = getStatusMeta(row.status);
    const divider = i > 0 ? `<div style="border-top:1px solid var(--border); margin: 8px 0;"></div>` : '';

    if (row.status === 'no_update') {
      return `
        ${divider}
        <div class="card__project" style="display:flex; justify-content:space-between; align-items:center;">
          <span>${escHtml(row.project_name)}</span>
          <span class="badge ${rowMeta.badgeClass}" style="font-size:10px;">${rowMeta.emoji} ${rowMeta.label}</span>
        </div>
        <ul class="card__tops">
          <li style="color:var(--text-muted); font-style:italic;">No update this week</li>
        </ul>
      `;
    }

    const tops = [row.top1, row.top2, row.top3].filter(t => t && t.trim());
    const topsHtml = tops.map(t => `<li>${escHtml(t)}</li>`).join('');
    const blockerHtml = (row.status === 'at_risk' || row.status === 'blocked') && row.blocker
      ? `<div class="card__blocker blocker-text">⚠️ ${escHtml(row.blocker)}</div>`
      : '';

    return `
      ${divider}
      <div class="card__project" style="display:flex; justify-content:space-between; align-items:center;">
        <span>${escHtml(row.project_name)}</span>
        <span class="badge ${rowMeta.badgeClass}" style="font-size:10px;">${rowMeta.emoji} ${rowMeta.label}</span>
      </div>
      <ul class="card__tops">${topsHtml}</ul>
      ${blockerHtml}
    `;
  }).join('');

  card.innerHTML = `
    <div class="card__header">
      <div class="flex-center gap-8">
        <span class="card__name">${escHtml(member.display_name)}</span>
        ${urgentBadge}
      </div>
      <span class="badge ${meta.badgeClass}">${meta.emoji} ${meta.label}</span>
    </div>
    ${projectSections}
  `;

  return card;
}

function buildPendingCard(member) {
  const card = document.createElement('div');
  card.className = 'card card--pending';
  card.dataset.status = '';

  card.innerHTML = `
    <div class="card__header">
      <span class="card__name">${escHtml(member.display_name)}</span>
      <span class="badge badge--gray">⬜ Pending</span>
    </div>
    <div class="card__project" style="color:var(--text-muted);">—</div>
    <ul class="card__tops">
      <li style="color:var(--text-muted);">Not submitted</li>
    </ul>
  `;

  return card;
}

// --------------------------------------------------------
// Summary Bar
// --------------------------------------------------------
function renderSummary(weekly, members) {
  const activeCount = members.filter(m => m.active).length;
  const counts = { blocked: 0, at_risk: 0, on_track: 0, no_update: 0 };
  weekly.forEach(r => { if (r.status in counts) counts[r.status]++; });
  // Count unique members who submitted (not total rows, since one member may have multiple projects)
  const submitted = new Set(weekly.map(r => r.member_id)).size;
  const pending = activeCount - submitted;

  setText('count-blocked',  `🔴 ${counts.blocked} Blocked`);
  setText('count-at-risk',  `🟡 ${counts.at_risk} At Risk`);
  setText('count-on-track', `🟢 ${counts.on_track} On Track`);
  setText('count-pending',  `⬜ ${pending} Pending`);

  // Add no_update count if any
  const summaryEl = document.getElementById('count-no-update');
  if (summaryEl) {
    if (counts.no_update > 0) {
      setText('count-no-update', `🔘 ${counts.no_update} No Update`);
    } else {
      summaryEl.style.display = 'none';
    }
  }

  setText('submitted-count', `${submitted} / ${activeCount} submitted`);
}

// --------------------------------------------------------
// Team Health Score (v4.0)
// --------------------------------------------------------
async function renderHealthScore(weekly, members) {
  const activeMembers = members.filter(m => m.active);
  const total = activeMembers.length;
  if (total === 0) return;

  // On Track rate = on_track rows / rows with actual status (no_update excluded)
  const statusRows   = weekly.filter(r => r.status && r.status !== 'no_update');
  const onTrackCount = statusRows.filter(r => r.status === 'on_track').length;
  const pct = statusRows.length > 0 ? Math.round((onTrackCount / statusRows.length) * 100) : 0;

  // Calculate consecutive On Track streak (DEV_MODE only)
  let streak = 0;
  if (pct === 100) {
    streak = 1;
    if (DEV_MODE) {
      for (let i = 1; i <= 12; i++) {
        const label = getWeekLabelOffset(-i);
        try {
          const pastRows = await fetchJSON(`./data/mock/weekly_${label}.json`);
          // Same logic: on_track rows / rows with actual status (no_update excluded)
          const pastStatusRows = pastRows.filter(r => r.status && r.status !== 'no_update');
          const pastOnTrack = pastStatusRows.filter(r => r.status === 'on_track').length;
          if (pastStatusRows.length > 0 && pastOnTrack >= pastStatusRows.length) {
            streak++;
          } else {
            break;
          }
        } catch {
          break;
        }
      }
    }
  }

  const el = document.getElementById('health-score');
  if (!el) return;

  if (streak >= 3) {
    el.textContent = `🏆 ${streak} weeks streak!`;
    el.style.color = 'var(--yellow-text)';
  } else if (pct === 100) {
    el.textContent = 'On Track 100% 🎉';
    el.style.color = 'var(--green-text)';
  } else {
    el.textContent = `On Track ${pct}%`;
    el.style.color = pct >= 75 ? 'var(--green-text)'
                   : pct >= 50 ? 'var(--yellow-text)'
                   : 'var(--red-text)';
  }
}

// Returns week label for an offset (negative = past, positive = future)
function getWeekLabelOffset(weeksOffset) {
  const d = new Date();
  d.setDate(d.getDate() + weeksOffset * 7);
  const year  = d.getFullYear();
  const start = new Date(year, 0, 1);
  const week  = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// --------------------------------------------------------
// Milestone Timeline (v4.0: past 2 weeks → 3 months, project colors)
// --------------------------------------------------------
function renderTimeline(projectsData) {
  const projects       = projectsData.projects       || [];
  const teamMilestones = projectsData.team_milestones || [];

  const now       = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 14);      // -2 weeks
  const endDate   = new Date(now);
  endDate.setMonth(endDate.getMonth() + 3);          // +3 months

  const totalMs = endDate - startDate;

  // Labels
  const fmt = d => `${d.getMonth() + 1}/${d.getDate()}`;
  const mid = new Date((startDate.getTime() + endDate.getTime()) / 2);
  setText('label-start',    fmt(startDate));
  setText('label-mid',      fmt(mid));
  setText('label-end',      fmt(endDate));
  setText('timeline-range', `${fmt(startDate)} – ${fmt(endDate)}`);

  // Today's vertical line
  const todayPct  = ((now - startDate) / totalMs) * 100;
  const todayLine = document.getElementById('timeline-today');
  todayLine.style.left = `${todayPct}%`;

  // Collect milestones within range
  const allMs = [];
  projects.forEach(proj => {
    (proj.milestones || []).forEach(ms => {
      const d = new Date(ms.date);
      if (d >= startDate && d <= endDate) {
        allMs.push({ ...ms, color: proj.color || '#58a6ff', projectName: proj.name });
      }
    });
  });
  teamMilestones.forEach(ms => {
    const d = new Date(ms.date);
    if (d >= startDate && d <= endDate) {
      allMs.push({ ...ms, color: '#8b949e', projectName: 'Team' });
    }
  });

  // Group by date for vertical stacking
  const byDate = {};
  allMs.forEach(ms => {
    if (!byDate[ms.date]) byDate[ms.date] = [];
    byDate[ms.date].push(ms);
  });

  // Resize track based on max dots per day
  const maxPerDay     = Object.values(byDate).reduce((m, a) => Math.max(m, a.length), 1);
  const dotSize       = 12;
  const dotSpacing    = 16;
  const trackHeight   = Math.max(dotSize, maxPerDay * dotSpacing);
  const track         = document.getElementById('timeline-track');
  track.style.height  = `${trackHeight}px`;

  // Remove old dots (keep today line)
  Array.from(track.children).forEach(el => {
    if (!el.classList.contains('timeline__today')) track.removeChild(el);
  });

  // Legend
  const legend = document.getElementById('timeline-legend');
  if (legend) {
    legend.innerHTML = '';
    projects
      .filter(proj => (proj.milestones || []).length > 0)
      .forEach(proj => {
        const item = document.createElement('span');
        item.style.cssText = 'display:inline-flex; align-items:center; gap:5px; font-size:11px; color:var(--text-secondary);';
        item.innerHTML = `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${escHtml(proj.color || '#58a6ff')}; flex-shrink:0;"></span>${escHtml(proj.name)}`;
        legend.appendChild(item);
      });
    // Team milestones entry (only if there are any in range)
    if (teamMilestones.some(ms => { const d = new Date(ms.date); return d >= startDate && d <= endDate; })) {
      const item = document.createElement('span');
      item.style.cssText = 'display:inline-flex; align-items:center; gap:5px; font-size:11px; color:var(--text-secondary);';
      item.innerHTML = `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#8b949e; flex-shrink:0;"></span>Team-wide`;
      legend.appendChild(item);
    }
  }

  // Render dots
  Object.entries(byDate).forEach(([date, msList]) => {
    const d   = new Date(date);
    const pct = ((d - startDate) / totalMs) * 100;

    msList.forEach((ms, i) => {
      const dot = document.createElement('div');
      dot.className  = 'timeline__dot';
      dot.style.left = `${pct}%`;

      // Vertical stacking
      if (msList.length === 1) {
        dot.style.top = '50%';
      } else {
        const topPct = ((i + 0.5) / msList.length) * 100;
        dot.style.top = `${topPct}%`;
      }

      // Project color (override level-based CSS)
      dot.style.backgroundColor = ms.color;

      // Tooltip
      const tip = document.createElement('div');
      tip.className   = 'tooltip';
      tip.textContent = `${date}  ${ms.title}  (${ms.projectName})`;
      dot.appendChild(tip);

      track.appendChild(dot);
    });
  });

  // Milestone list (always visible below timeline)
  const listEl = document.getElementById('milestone-list');
  if (listEl) {
    listEl.innerHTML = '';
    const sorted = allMs.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sorted.length === 0) {
      listEl.innerHTML = '<p class="milestone-list__empty">No milestones in this period</p>';
    } else {
      sorted.forEach(ms => {
        const d        = new Date(ms.date);
        const diffDays = Math.round((d - now) / 86400000);
        const isPast   = diffDays < 0;
        const isUrgent = !isPast && diffDays <= 3;

        const row = document.createElement('div');
        row.className = 'milestone-list__row' + (isPast ? ' milestone-list__row--past' : '') + (isUrgent ? ' milestone-list__row--urgent' : '');

        const dot = document.createElement('span');
        dot.className = 'milestone-list__dot';
        dot.style.background = ms.color;

        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        const label   = isPast  ? `${Math.abs(diffDays)}d ago`
                      : diffDays === 0 ? 'Today'
                      : `in ${diffDays}d`;

        row.innerHTML = `
          <span class="milestone-list__date">${escHtml(dateStr)}</span>
          <span class="milestone-list__dot" style="background:${escHtml(ms.color)}"></span>
          <span class="milestone-list__title">${escHtml(ms.title)}</span>
          <span class="milestone-list__project">${escHtml(ms.projectName)}</span>
          <span class="milestone-list__badge ${isPast ? 'badge--past' : isUrgent ? 'badge--urgent' : 'badge--normal'}">${escHtml(label)}</span>
        `;
        listEl.appendChild(row);
      });
    }
  }
}

// --------------------------------------------------------
// Announcement Banner (v4.0: reads from JSON/xlsx, not localStorage)
// --------------------------------------------------------
function renderAnnouncement(memberId, members, announcements) {
  const banner = document.getElementById('announcement-banner');

  if (!announcements || announcements.length === 0) {
    banner.style.display = 'none';
    return;
  }

  const today       = new Date().toISOString().slice(0, 10);
  const me          = memberId ? members.find(m => m.id === memberId) : null;
  const myProjects  = me?.projects ?? [];  // v4.2: projects array instead of default_project

  const active = announcements.filter(a => {
    if (!a.active) return false;
    if (a.start_date && a.start_date > today) return false;
    if (a.end_date   && a.end_date   < today) return false;
    // v4.2: check against projects array
    if (a.target_project && !myProjects.includes(a.target_project)) return false;
    return true;
  });

  if (active.length === 0) { banner.style.display = 'none'; return; }

  const levelClass = { urgent: 'banner--urgent', notice: 'banner--notice', info: 'banner--info' };
  const levelEmoji = { urgent: '🔴', notice: '🟡', info: 'ℹ️' };
  const a = active[0];
  banner.className    = `banner ${levelClass[a.level] || 'banner--info'}`;
  banner.textContent  = `${levelEmoji[a.level] || 'ℹ️'} ${a.body}`;
  banner.style.display = '';
}

// --------------------------------------------------------
// Focus Mode
// --------------------------------------------------------
function bindFocusMode() {
  let focusMode = false;

  document.getElementById('btn-focus').addEventListener('click', () => {
    focusMode = !focusMode;

    const onTrackCards = document.querySelectorAll('.card[data-status="on_track"]');
    const blockerTexts = document.querySelectorAll('.blocker-text');
    const btn          = document.getElementById('btn-focus');

    if (focusMode) {
      onTrackCards.forEach(card => {
        card.style.transition = 'opacity 0.4s ease';
        card.style.opacity    = '0';
        setTimeout(() => { card.style.display = 'none'; }, 400);
      });
      blockerTexts.forEach(el => {
        el.style.color      = 'var(--red-text)';
        el.style.fontWeight = 'bold';
        el.style.fontSize   = '1.05em';
      });
      btn.textContent = '⚡ Exit Focus';
      btn.classList.add('active');
    } else {
      onTrackCards.forEach(card => {
        card.style.display = '';
        requestAnimationFrame(() => { card.style.opacity = '1'; });
      });
      blockerTexts.forEach(el => {
        el.style.color      = '';
        el.style.fontWeight = '';
        el.style.fontSize   = '';
      });
      btn.textContent = '⚡ Focus';
      btn.classList.remove('active');
    }
  });
}

// --------------------------------------------------------
// Helpers
// --------------------------------------------------------
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --------------------------------------------------------
// Start
// --------------------------------------------------------
document.addEventListener('DOMContentLoaded', init);
