/* ============================================================
   FocusBoard — index.js
   Member input view logic (v4.2: multiple projects + no_update)
   ============================================================ */

// Destination email address (Deprecated in favor of Firebase)
// const TO = 'demo@example.com';

// --------------------------------------------------------
// State
// --------------------------------------------------------
let currentMember  = null;   // Member object
let allProjects    = [];     // All active projects
let allAnnouncements = [];   // Announcements
let projectStates  = new Map(); // { projectId: { status, skipped, top1, top2, top3, blocker } }

// --------------------------------------------------------
// Initialization
// --------------------------------------------------------
async function init() {
  // Set week label
  document.getElementById('week-label').textContent = getCurrentWeekLabel();

  // Get member ID from URL parameter
  const params   = new URLSearchParams(window.location.search);
  const memberId = params.get('member');

  if (!memberId) {
    showFatalError('Please specify ?member=<id> in the URL. e.g. index.html?member=alex');
    return;
  }

  try {
    // Load data
    const DEV = window.location.hostname === 'localhost' || window.location.protocol === 'file:';
    const dataBase = DEV ? './data/mock' : './data';

    const [membersData, projectsData, announcements] = await Promise.all([
      fetchJSON(`${dataBase}/members.json`),
      fetchJSON(`${dataBase}/projects.json`),
      fetchJSON(`${dataBase}/announcements.json`).catch(() => []),
    ]);

    allProjects = projectsData.projects.filter(p => p.active);
    allAnnouncements = announcements;

    // Identify member
    currentMember = membersData.members.find(m => m.id === memberId && m.active);
    if (!currentMember) {
      showFatalError(`Member ID "${memberId}" not found.`);
      return;
    }

    // Display member name
    document.getElementById('member-name').textContent = currentMember.display_name;

    // Display announcement banner
    renderAnnouncement();

    // Build project sections
    buildProjectSections();

    // Register events
    bindEvents();

  } catch (err) {
    showFatalError(`Failed to load data: ${err.message}`);
  }
}

// --------------------------------------------------------
// Build project sections (multiple projects + no_update)
// --------------------------------------------------------
function buildProjectSections() {
  const container = document.getElementById('projects-container');
  container.innerHTML = '';

  // Get member's projects (v4.2: projects array instead of default_project)
  const projectIds = currentMember.projects || [];
  if (projectIds.length === 0) {
    container.innerHTML = '<div class="banner banner--notice">No projects assigned</div>';
    return;
  }

  // Filter and order: only active projects assigned to this member
  const memberProjects = projectIds
    .map(pid => allProjects.find(p => p.id === pid))
    .filter(p => p !== undefined);

  memberProjects.forEach(project => {
    // Initialize state for this project
    projectStates.set(project.id, {
      status: '',
      skipped: false,
      top1: '',
      top2: '',
      top3: '',
      blocker: '',
    });

    // Build section HTML
    const section = document.createElement('div');
    section.id = `project-${project.id}`;
    section.className = 'project-section';
    section.style.marginBottom = '32px';

    section.innerHTML = `
      <div style="border-top: 1px solid var(--border); padding-top: 24px; margin-bottom: 24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h2 style="font-size:16px; font-weight:600;">
            ══ ${escHtml(project.name)} ══
          </h2>
          <button class="btn btn--no-update" data-project="${project.id}" type="button">
            No update this week
          </button>
        </div>

        <!-- Status -->
        <div class="form-group">
          <label class="form-label">Status</label>
          <div class="status-toggle">
            <button class="status-btn" data-project="${project.id}" data-status="on_track">🟢 On Track</button>
            <button class="status-btn" data-project="${project.id}" data-status="at_risk">🟡 At Risk</button>
            <button class="status-btn" data-project="${project.id}" data-status="blocked">🔴 Blocked</button>
          </div>
          <span class="error-msg" id="err-status-${project.id}" style="display:none;">Please select a status</span>
        </div>

        <!-- Top 3 -->
        <div class="form-group">
          <label class="form-label">Top 3 This Week <span class="text-muted" style="font-size:11px;font-weight:400;">(max 40 chars each)</span></label>
          <div class="top-inputs">
            <div class="top-inputs__row">
              <span class="top-inputs__num">1.</span>
              <div style="flex:1;">
                <input class="form-control" type="text" id="top1-${project.id}" maxlength="40" placeholder="Most important task this week">
                <div class="char-count" id="count1-${project.id}">0 / 40</div>
              </div>
            </div>
            <div class="top-inputs__row">
              <span class="top-inputs__num">2.</span>
              <div style="flex:1;">
                <input class="form-control" type="text" id="top2-${project.id}" maxlength="40" placeholder="Optional">
                <div class="char-count" id="count2-${project.id}">0 / 40</div>
              </div>
            </div>
            <div class="top-inputs__row">
              <span class="top-inputs__num">3.</span>
              <div style="flex:1;">
                <input class="form-control" type="text" id="top3-${project.id}" maxlength="40" placeholder="Optional">
                <div class="char-count" id="count3-${project.id}">0 / 40</div>
              </div>
            </div>
          </div>
          <span class="error-msg" id="err-top1-${project.id}" style="display:none;">Top 1 is required</span>
        </div>

        <!-- Blocker Field (shown only for 🟡🔴) -->
        <div class="blocker-field" id="blocker-field-${project.id}">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" for="blocker-${project.id}">
              ⚠️ Blocker Details
              <span class="badge badge--red" style="margin-left:6px; vertical-align:middle;">Required</span>
            </label>
            <textarea class="form-control form-control--textarea" id="blocker-${project.id}"
              placeholder="Describe what is blocked and who needs to take action"></textarea>
            <span class="error-msg" id="err-blocker-${project.id}" style="display:none;">Please enter blocker details</span>
          </div>
        </div>
      </div>
    `;

    container.appendChild(section);
  });
}

// --------------------------------------------------------
// Announcement Banner (v4.2: check against projects array)
// --------------------------------------------------------
function renderAnnouncement() {
  const banner = document.getElementById('announcement-banner');

  if (!allAnnouncements || allAnnouncements.length === 0) {
    banner.style.display = 'none';
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const memberProjects = currentMember?.projects ?? [];

  const active = allAnnouncements.filter(a => {
    if (!a.active) return false;
    if (a.start_date && a.start_date > today) return false;
    if (a.end_date   && a.end_date   < today) return false;
    // v4.2: check against projects array
    if (a.target !== 'all' && !memberProjects.includes(a.target)) return false;
    return true;
  });

  if (active.length === 0) {
    banner.style.display = 'none';
    return;
  }

  const levelClass = { urgent: 'banner--urgent', warning: 'banner--warning', info: 'banner--info' };
  const levelEmoji = { urgent: '🔴', warning: '🟡', info: 'ℹ️' };
  const a = active[0];
  banner.className  = `banner ${levelClass[a.level] || 'banner--info'}`;
  banner.textContent = `${levelEmoji[a.level] || 'ℹ️'} ${a.body || a.text}`;
  banner.style.display = '';
}

// --------------------------------------------------------
// Event Binding
// --------------------------------------------------------
function bindEvents() {
  // Status toggle (delegated)
  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => onStatusClick(btn));
  });

  // No Update toggle button (delegated)
  document.querySelectorAll('.btn--no-update').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      onNoUpdateClick(btn.dataset.project);
    });
  });

  // Top 3 character counters (delegated)
  projectStates.forEach((state, projectId) => {
    [1, 2, 3].forEach(i => {
      const input   = document.getElementById(`top${i}-${projectId}`);
      const counter = document.getElementById(`count${i}-${projectId}`);
      if (input && counter) {
        input.addEventListener('input', () => updateCharCount(input, counter));
        if (i === 1) input.addEventListener('input', () => clearError(`err-top1-${projectId}`));
      }
    });
  });

  // Submit button
  document.getElementById('btn-submit').addEventListener('click', onSubmit);
}

// --------------------------------------------------------
// No Update Toggle
// --------------------------------------------------------
function onNoUpdateClick(projectId) {
  const state = projectStates.get(projectId);
  if (!state) return;

  const section = document.getElementById(`project-${projectId}`);
  const btn = section.querySelector('.btn--no-update');

  // Toggle skipped state
  state.skipped = !state.skipped;

  if (state.skipped) {
    // Deselect status
    state.status = '';
    state.top1 = '';
    state.top2 = '';
    state.top3 = '';
    state.blocker = '';

    // Clear form inputs
    const btns = section.querySelectorAll('.status-btn');
    btns.forEach(b => b.classList.remove('selected'));
    document.getElementById(`top1-${projectId}`).value = '';
    document.getElementById(`top2-${projectId}`).value = '';
    document.getElementById(`top3-${projectId}`).value = '';
    document.getElementById(`blocker-${projectId}`).value = '';
    updateCharCount(document.getElementById(`top1-${projectId}`), document.getElementById(`count1-${projectId}`));
    updateCharCount(document.getElementById(`top2-${projectId}`), document.getElementById(`count2-${projectId}`));
    updateCharCount(document.getElementById(`top3-${projectId}`), document.getElementById(`count3-${projectId}`));

    // Grayout section
    section.classList.add('project-section--skipped');
    btn.classList.add('active');
  } else {
    // Clear skipped state
    section.classList.remove('project-section--skipped');
    btn.classList.remove('active');
  }

  // Clear errors
  clearError(`err-status-${projectId}`);
  clearError(`err-top1-${projectId}`);
  clearError(`err-blocker-${projectId}`);
}

// --------------------------------------------------------
// Status Toggle (multi-project version)
// --------------------------------------------------------
function onStatusClick(btn) {
  const projectId = btn.dataset.project;
  const status    = btn.dataset.status;
  const state     = projectStates.get(projectId);

  if (!state || state.skipped) return; // Do nothing if skipped

  if (state.status === status) {
    // Re-click same button → deselect
    state.status = '';
    btn.classList.remove('selected');
  } else {
    // Select another button
    const section = document.getElementById(`project-${projectId}`);
    const sectionBtns = section.querySelectorAll(`.status-btn`);
    sectionBtns.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.status = status;
  }

  clearError(`err-status-${projectId}`);
  updateBlockerVisibility(projectId);

  // 🟢 Launch confetti when any project reaches On Track
  const hasOnTrack = Array.from(projectStates.values())
    .some(s => s.status === 'on_track' && !s.skipped);
  if (hasOnTrack) {
    launchConfetti();
  }
}

// --------------------------------------------------------
// Blocker field visibility control (per project)
// --------------------------------------------------------
function updateBlockerVisibility(projectId) {
  const state = projectStates.get(projectId);
  if (!state) return;

  const field = document.getElementById(`blocker-field-${projectId}`);
  const needsBlocker = state.status === 'at_risk' || state.status === 'blocked';

  if (needsBlocker) {
    field.classList.add('visible');
  } else {
    field.classList.remove('visible');
    document.getElementById(`blocker-${projectId}`).value = '';
    clearError(`err-blocker-${projectId}`);
  }
}

// --------------------------------------------------------
// Update character counter
// --------------------------------------------------------
function updateCharCount(input, counter) {
  const len = input.value.length;
  const max = parseInt(input.maxLength, 10);
  counter.textContent = `${len} / ${max}`;
  counter.className = 'char-count' + (len >= max ? ' over' : len >= max * 0.8 ? ' warn' : '');
}

// --------------------------------------------------------
// Validation (multi-project + no_update)
// --------------------------------------------------------
function validate() {
  let valid = true;
  let hasAnyInput = false;

  projectStates.forEach((state, projectId) => {
    // Skip projects marked as "no update"
    if (state.skipped) {
      return;
    }

    hasAnyInput = true;

    // Status required
    if (!state.status) {
      showError(`err-status-${projectId}`);
      valid = false;
    }

    // Top 1 required
    const top1Input = document.getElementById(`top1-${projectId}`);
    if (!top1Input || !top1Input.value.trim()) {
      showError(`err-top1-${projectId}`);
      valid = false;
    }

    // Blocker required for at_risk / blocked
    if (state.status === 'at_risk' || state.status === 'blocked') {
      const blockerInput = document.getElementById(`blocker-${projectId}`);
      if (!blockerInput || !blockerInput.value.trim()) {
        showError(`err-blocker-${projectId}`);
        valid = false;
      }
    }
  });

  // At least one project must have input (not all skipped)
  if (!hasAnyInput) {
    showFatalError('Please provide updates for at least one project');
    return false;
  }

  return valid;
}

// --------------------------------------------------------
// Collect form data (multi-project + no_update)
// --------------------------------------------------------
function collectFormData() {
  const projects = [];

  projectStates.forEach((state, projectId) => {
    const project = allProjects.find(p => p.id === projectId);
    if (!project) return;

    projects.push({
      member_id:    currentMember.id,
      member_name:  currentMember.display_name,
      week:        getCurrentWeekLabel(),
      project_id:   project.id,
      project_name: project.name,
      status:      state.skipped ? 'no_update' : state.status,
      top1:        state.skipped ? '' : document.getElementById(`top1-${projectId}`).value.trim(),
      top2:        state.skipped ? '' : document.getElementById(`top2-${projectId}`).value.trim(),
      top3:        state.skipped ? '' : document.getElementById(`top3-${projectId}`).value.trim(),
      blocker:     state.skipped ? '' : document.getElementById(`blocker-${projectId}`).value.trim(),
    });
  });

  return projects;
}

// --------------------------------------------------------
// --------------------------------------------------------
// Submit (v5.0: Save to Firestore)
// --------------------------------------------------------
async function onSubmit() {
  if (!validate()) return;
  const projects = collectFormData();
  
  const btn = document.getElementById('btn-submit');
  const originalText = btn.textContent;
  btn.textContent = 'Submitting...';
  btn.disabled = true;

  try {
    const batch = db.batch(); // globally accessible from firebase-config.js
    
    projects.forEach(p => {
       const docRef = db.collection('weekly').doc();
       batch.set(docRef, {
           ...p,
           submitted_at: firebase.firestore.FieldValue.serverTimestamp()
       });
    });
    
    await batch.commit();
    
    // Success feedback
    btn.textContent = 'Successfully Submitted! 🎉';
    btn.style.backgroundColor = 'var(--green-border)';
    
    setTimeout(() => {
      alert("Updates submitted successfully!");
      window.location.reload();
    }, 1000);

  } catch (e) {
    console.error("Error writing document: ", e);
    alert("Error submitting data. See console for details.");
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// --------------------------------------------------------
// Error display helpers
// --------------------------------------------------------
function showError(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = '';
}

function clearError(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function showFatalError(msg) {
  document.querySelector('main').innerHTML =
    `<div class="banner banner--urgent" style="margin-top:40px;">${msg}</div>`;
}

// --------------------------------------------------------
// HTML escape helper
// --------------------------------------------------------
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
