/* ============================================================
   FocusBoard — admin.js
   Admin panel logic (Step 11: Master / Step 12: Communications)
   ============================================================ */

// --------------------------------------------------------
// localStorage keys
// --------------------------------------------------------
const LS_PROJECTS        = 'focusboard_projects';
const LS_MEMBERS         = 'focusboard_members';
const LS_ANNOUNCEMENTS   = 'focusboard_announcements';
const LS_TEAM_MILESTONES = 'focusboard_team_milestones';

// --------------------------------------------------------
// State
// --------------------------------------------------------
let projects         = [];
let members          = [];
let announcements    = [];
let teamMilestones   = [];
let editingProjectId = null; // null = new
let selectedMsLevel  = '';
let selectedMsScope  = 'project';

// --------------------------------------------------------
// Initialization
// --------------------------------------------------------
async function init() {
  // Access control: redirect members to dashboard
  const params   = new URLSearchParams(window.location.search);
  const memberId = params.get('member');

  // Load base data (fallback: localStorage → JSON)
  await loadData();

  if (memberId) {
    const me = members.find(m => m.id === memberId);
    if (me && me.role !== 'manager') {
      window.location.href = `dashboard.html?member=${memberId}`;
      return;
    }
    // Pass parameters to Dashboard link
    document.getElementById('btn-dashboard').href = `dashboard.html?member=${memberId}`;
  }

  renderProjectTable();
  renderMemberTable();
  bindTabEvents();
  bindProjectModal();
  bindMemberModal();
  bindExportButton();
  await loadAnnouncements();
  renderAnnounceList();
  bindAnnounceForm();
  bindMilestoneTab();
  renderMilestoneTable();
  refreshProjectDropdowns();
}

// --------------------------------------------------------
// Data loading
// --------------------------------------------------------
async function loadData() {
  // Projects
  const lsProj = localStorage.getItem(LS_PROJECTS);
  if (lsProj) {
    try { projects = JSON.parse(lsProj); } catch { projects = []; }
  } else {
    try {
      const data = await fetchJSON('./data/projects.json');
      projects = data.projects || [];
    } catch { projects = []; }
  }

  // Members
  const lsMem = localStorage.getItem(LS_MEMBERS);
  if (lsMem) {
    try { members = JSON.parse(lsMem); } catch { members = []; }
  } else {
    try {
      const data = await fetchJSON('./data/members.json');
      members = data.members || [];
    } catch { members = []; }
  }

  // Team milestones
  const lsTm = localStorage.getItem(LS_TEAM_MILESTONES);
  if (lsTm) {
    try { teamMilestones = JSON.parse(lsTm); } catch { teamMilestones = []; }
  } else {
    try {
      const data = await fetchJSON('./data/projects.json');
      teamMilestones = data.team_milestones || [];
    } catch { teamMilestones = []; }
  }
}

function saveProjects() {
  localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
}

function saveMembers() {
  localStorage.setItem(LS_MEMBERS, JSON.stringify(members));
}

function saveTeamMilestones() {
  localStorage.setItem(LS_TEAM_MILESTONES, JSON.stringify(teamMilestones));
}

// --------------------------------------------------------
// Refresh project dropdowns in milestone & announce forms
// --------------------------------------------------------
function refreshProjectDropdowns() {
  // ms-project の再生成（Milestone tab）
  const msSel = document.getElementById('ms-project');
  if (msSel) {
    msSel.innerHTML = '<option value="">— Select Project —</option>';
    projects.filter(p => p.active).forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      msSel.appendChild(opt);
    });
  }

  // an-project の再生成（Announce form）
  const anSel = document.getElementById('an-project');
  if (anSel) {
    anSel.innerHTML = '<option value="">— Select Project —</option>';
    projects.filter(p => p.active).forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      anSel.appendChild(opt);
    });
  }
}

// --------------------------------------------------------
// Tab switching
// --------------------------------------------------------
function bindTabEvents() {
  let workloadLoaded = false;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');

      // Load workload data on first tab display
      if (btn.dataset.tab === 'workload' && !workloadLoaded) {
        workloadLoaded = true;
        renderWorkload();
      }

      // Refresh dropdowns when switching to announce/milestone tabs
      if (btn.dataset.tab === 'announce' || btn.dataset.tab === 'milestone') {
        refreshProjectDropdowns();
      }
    });
  });
}

// --------------------------------------------------------
// Render project table
// --------------------------------------------------------
function renderProjectTable() {
  const tbody = document.getElementById('project-tbody');
  tbody.innerHTML = '';

  if (projects.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-muted" style="text-align:center;padding:20px;">No projects available</td></tr>';
    return;
  }

  projects.forEach(proj => {
    const tr = document.createElement('tr');

    const statusBadge = proj.active
      ? '<span class="badge badge--green">Active</span>'
      : '<span class="badge badge--gray">Archived</span>';

    const period = proj.start_date && proj.end_date
      ? `${proj.start_date} – ${proj.end_date}`
      : '—';

    tr.innerHTML = `
      <td><strong>${escHtml(proj.name)}</strong></td>
      <td>${escHtml(proj.phase || '—')}</td>
      <td style="font-size:12px; color:var(--text-secondary);">${escHtml(period)}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn--ghost" data-action="edit-project" data-id="${escHtml(proj.id)}">Edit</button>
          <button class="btn btn--ghost" data-action="archive-project" data-id="${escHtml(proj.id)}"
            style="color:${proj.active ? 'var(--text-secondary)' : 'var(--green-text)'};">
            ${proj.active ? 'Archive' : 'Restore'}
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Event delegation
  tbody.onclick = e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id     = btn.dataset.id;
    if (action === 'edit-project')    openProjectModal(id);
    if (action === 'archive-project') toggleArchiveProject(id);
  };
}

// --------------------------------------------------------
// Project modal
// --------------------------------------------------------
function bindProjectModal() {
  document.getElementById('btn-add-project').addEventListener('click', () => openProjectModal(null));
  document.getElementById('modal-project-cancel').addEventListener('click', closeProjectModal);
  document.getElementById('modal-project-save').addEventListener('click', saveProject);

  // Close on overlay click
  document.getElementById('modal-project').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeProjectModal();
  });
}

function openProjectModal(id) {
  editingProjectId = id;
  const isNew = id === null;
  document.getElementById('modal-project-title').textContent = isNew ? 'Add Project' : 'Edit Project';

  if (!isNew) {
    const proj = projects.find(p => p.id === id);
    if (!proj) return;
    document.getElementById('modal-project-id').value = proj.id;
    document.getElementById('mp-name').value  = proj.name       || '';
    document.getElementById('mp-phase').value = proj.phase      || '';
    document.getElementById('mp-start').value = proj.start_date || '';
    document.getElementById('mp-end').value   = proj.end_date   || '';
  } else {
    document.getElementById('modal-project-id').value = '';
    document.getElementById('mp-name').value  = '';
    document.getElementById('mp-phase').value = '';
    document.getElementById('mp-start').value = '';
    document.getElementById('mp-end').value   = '';
  }

  document.getElementById('modal-project').classList.add('open');
}

function closeProjectModal() {
  document.getElementById('modal-project').classList.remove('open');
}

function saveProject() {
  const name  = document.getElementById('mp-name').value.trim();
  const phase = document.getElementById('mp-phase').value.trim();
  const start = document.getElementById('mp-start').value;
  const end   = document.getElementById('mp-end').value;

  if (!name) {
    document.getElementById('mp-name').focus();
    return;
  }

  if (editingProjectId === null) {
    // New entry
    const newId = 'proj_' + name.replace(/\s+/g, '_').toLowerCase().slice(0, 20) + '_' + Date.now();
    projects.push({
      id:         newId,
      name,
      phase:      phase || 'Planning',
      members:    [],
      start_date: start || '',
      end_date:   end   || '',
      active:     true,
      milestones: [],
    });
  } else {
    // Edit
    const proj = projects.find(p => p.id === editingProjectId);
    if (proj) {
      proj.name       = name;
      proj.phase      = phase;
      proj.start_date = start;
      proj.end_date   = end;
    }
  }

  saveProjects();
  renderProjectTable();
  closeProjectModal();
  refreshProjectDropdowns();
}

function toggleArchiveProject(id) {
  const proj = projects.find(p => p.id === id);
  if (!proj) return;
  proj.active = !proj.active;
  saveProjects();
  renderProjectTable();
  refreshProjectDropdowns();
}

// --------------------------------------------------------
// Render member table
// --------------------------------------------------------
function renderMemberTable() {
  const tbody = document.getElementById('member-tbody');
  tbody.innerHTML = '';

  if (members.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-muted" style="text-align:center;padding:20px;">No members</td></tr>';
    return;
  }

  members.forEach(m => {
    const tr = document.createElement('tr');

    const defaultProjName = projects.find(p => p.id === m.default_project)?.name ?? '—';
    const activeIcon = m.active ? '✅' : '⬜';

    // Role change select
    const roleOpts = ['member', 'manager'].map(r =>
      `<option value="${r}" ${m.role === r ? 'selected' : ''}>${r}</option>`
    ).join('');

    tr.innerHTML = `
      <td style="color:var(--text-secondary); font-size:12px;">${escHtml(m.id)}</td>
      <td><strong>${escHtml(m.display_name)}</strong></td>
      <td>
        <select class="role-select" data-action="change-role" data-id="${escHtml(m.id)}">
          ${roleOpts}
        </select>
      </td>
      <td style="font-size:12px; color:var(--text-secondary);">${escHtml(defaultProjName)}</td>
      <td>
        <span class="toggle-active" data-action="toggle-active" data-id="${escHtml(m.id)}"
          title="${m.active ? 'Disable' : 'Enable'}">${activeIcon}</span>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Event delegation
  tbody.onchange = e => {
    const sel = e.target.closest('[data-action="change-role"]');
    if (sel) changeMemberRole(sel.dataset.id, sel.value);
  };

  tbody.onclick = e => {
    const el = e.target.closest('[data-action="toggle-active"]');
    if (el) toggleMemberActive(el.dataset.id);
  };
}

// --------------------------------------------------------
// Member modal
// --------------------------------------------------------
function bindMemberModal() {
  document.getElementById('btn-add-member').addEventListener('click', openMemberModal);
  document.getElementById('modal-member-cancel').addEventListener('click', closeMemberModal);
  document.getElementById('modal-member-save').addEventListener('click', saveMember);

  document.getElementById('modal-member').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeMemberModal();
  });
}

function openMemberModal() {
  // Update project dropdown
  const sel = document.getElementById('mm-project');
  sel.innerHTML = '<option value="">— Select —</option>';
  projects.filter(p => p.active).forEach(p => {
    const opt = document.createElement('option');
    opt.value       = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });

  // Reset form
  ['mm-id', 'mm-name'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('mm-role').value    = 'member';
  document.getElementById('mm-project').value = '';
  ['err-mm-id', 'err-mm-name'].forEach(id =>
    document.getElementById(id).classList.remove('visible'));

  document.getElementById('modal-member').classList.add('open');
}

function closeMemberModal() {
  document.getElementById('modal-member').classList.remove('open');
}

function saveMember() {
  const id      = document.getElementById('mm-id').value.trim();
  const name    = document.getElementById('mm-name').value.trim();
  const role    = document.getElementById('mm-role').value;
  const project = document.getElementById('mm-project').value;

  let valid = true;
  if (!id) { document.getElementById('err-mm-id').classList.add('visible');   valid = false; }
  else      { document.getElementById('err-mm-id').classList.remove('visible'); }
  if (!name){ document.getElementById('err-mm-name').classList.add('visible'); valid = false; }
  else      { document.getElementById('err-mm-name').classList.remove('visible'); }
  if (!valid) return;

  // Check for duplicate ID
  if (members.find(m => m.id === id)) {
    document.getElementById('err-mm-id').textContent = 'This ID already exists';
    document.getElementById('err-mm-id').classList.add('visible');
    return;
  }

  members.push({
    id,
    display_name:    name,
    role,
    default_project: project || '',
    active:          true,
  });

  saveMembers();
  renderMemberTable();
  closeMemberModal();
}

function changeMemberRole(id, newRole) {
  const m = members.find(m => m.id === id);
  if (m) { m.role = newRole; saveMembers(); }
}

function toggleMemberActive(id) {
  const m = members.find(m => m.id === id);
  if (m) { m.active = !m.active; saveMembers(); renderMemberTable(); }
}

// --------------------------------------------------------
// Communications tab (v5.0: Firestore)
// --------------------------------------------------------

const DEV_MODE_ADMIN  = new URLSearchParams(window.location.search).get('dev') === 'true';
// Deprecated Excel/mailto constants
// const ANNOUNCE_URL    = './announcements.xlsx';
// const TO_ANNOUNCE     = 'admin@example.com';

// State for announce form
let selectedAnLevel  = 'notice';
let selectedAnTarget = 'all';

async function loadAnnouncements() {
  if (DEV_MODE_ADMIN) {
    try {
      announcements = await fetchJSON('./data/mock/announcements.json');
    } catch { announcements = []; }
  } else {
    try {
      const snapshot = await db.collection('announcements').get();
      announcements = [];
      snapshot.forEach(doc => {
        const r = doc.data();
        announcements.push({
          id:             doc.id,
          body:           r.text || r.body,
          level:          r.level,
          target_project: r.target === 'all' ? '' : r.target,
          start_date:     r.start_date,
          end_date:       r.end_date,
          active:         Boolean(r.active),
          created_at:     r.created_at,
          created_by:     r.created_by,
        });
      });
    } catch (err) {
      console.error("Error loading announcements from Firebase:", err);
      announcements = [];
    }
  }
}

function renderAnnounceList() {
  const container = document.getElementById('announce-list');
  if (!container) return;
  container.innerHTML = '';

  const active = announcements.filter(a => a.active);

  if (active.length === 0) {
    container.innerHTML = '<p class="text-muted" style="padding:16px 0;">No active announcements</p>';
    return;
  }

  const levelLabel = { urgent: '🔴 Urgent', notice: '🟡 Notice', info: 'ℹ️ Info' };
  const levelBadge = { urgent: 'badge--red', notice: 'badge--yellow', info: 'badge--blue' };

  // Show newest first
  [...active].reverse().forEach(a => {
    const card = document.createElement('div');
    card.className = 'card mb-8';
    card.style.padding = '14px 16px';

    const period = (a.start_date || a.end_date)
      ? `${a.start_date || '—'} – ${a.end_date || '—'}`
      : 'No period';

    const target = a.target_project
      ? (projects.find(p => p.id === a.target_project)?.name ?? a.target_project)
      : 'All';

    card.innerHTML = `
      <div class="flex-between mb-8">
        <div class="flex gap-8" style="align-items:center; flex-wrap:wrap;">
          <span class="badge ${levelBadge[a.level] || 'badge--blue'}">${levelLabel[a.level] || a.level}</span>
          <span class="badge badge--green" style="font-size:10px;">Active</span>
          <span class="text-muted" style="font-size:11px;">📅 ${escHtml(period)}</span>
          <span class="text-muted" style="font-size:11px;">👤 ${escHtml(target)}</span>
        </div>
        <button class="btn btn--ghost" style="font-size:12px; padding:4px 10px;"
          data-action="deactivate-announce" data-id="${escHtml(a.id)}">
          Deactivate
        </button>
      </div>
      <div style="font-size:13px; color:var(--text-primary); line-height:1.6;">${escHtml(a.body)}</div>
    `;
    container.appendChild(card);
  });

  // Event delegation
  container.onclick = e => {
    const btn = e.target.closest('[data-action="deactivate-announce"]');
    if (!btn) return;
    sendDeactivate(btn.dataset.id);
  };
}

function bindAnnounceForm() {
  const btnAdd    = document.getElementById('btn-add-announce');
  const formWrap  = document.getElementById('announce-form-wrap');
  const btnCancel = document.getElementById('btn-announce-cancel');
  const btnPost   = document.getElementById('btn-announce-save');

  if (!btnAdd) return;

  // Level toggle buttons
  document.querySelectorAll('.an-level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.an-level-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedAnLevel = btn.dataset.level;
    });
  });

  // Target toggle buttons
  document.querySelectorAll('.an-target-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.an-target-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedAnTarget = btn.dataset.target;
      document.getElementById('an-project-group').style.display =
        selectedAnTarget === 'project' ? '' : 'none';
    });
  });

  // Populate project dropdown
  const projSel = document.getElementById('an-project');
  if (projSel) {
    projects.filter(p => p.active).forEach(p => {
      const opt = document.createElement('option');
      opt.value       = p.id;
      opt.textContent = p.name;
      projSel.appendChild(opt);
    });
  }

  // Default dates
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('an-start').value = today;

  btnAdd.addEventListener('click', () => {
    formWrap.style.display = formWrap.style.display === 'none' ? '' : 'none';
  });

  btnCancel.addEventListener('click', () => {
    formWrap.style.display = 'none';
    resetAnnounceForm();
  });

  btnPost.addEventListener('click', async () => {
    const body  = document.getElementById('an-body').value.trim();
    const errEl = document.getElementById('err-an-body');

    if (!body) { errEl.classList.add('visible'); return; }
    errEl.classList.remove('visible');

    btnPost.textContent = 'Posting...';
    btnPost.disabled = true;

    const params   = new URLSearchParams(window.location.search);
    const memberId = params.get('member') || 'admin';
    const dateStr  = new Date().toISOString().slice(0, 10);
    const target   = selectedAnTarget === 'project'
      ? (document.getElementById('an-project').value || 'all')
      : 'all';

    const newDoc = {
      created_by: memberId,
      text:       body,
      level:      selectedAnLevel,
      target:     target,
      start_date: document.getElementById('an-start').value || dateStr,
      end_date:   document.getElementById('an-end').value   || dateStr,
      active:     true,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      await db.collection('announcements').add(newDoc);
      alert("Announcement posted successfully!");
      location.reload();
    } catch (e) {
      console.error("Error adding announcement: ", e);
      alert("Error posting announcement.");
      btnPost.disabled = false;
      btnPost.textContent = 'Post Announcement';
    }
  });
}

// Deprecated: buildAnnounceMail

async function sendDeactivate(id) {
  if (confirm("Are you sure you want to deactivate this announcement?")) {
    try {
      await db.collection('announcements').doc(id).update({ active: false });
      alert("Deactivated successfully!");
      location.reload();
    } catch (e) {
      console.error("Error deactivating: ", e);
      alert("Error deactivating.");
    }
  }
}

function resetAnnounceForm() {
  document.getElementById('an-body').value = '';
  document.getElementById('an-end').value  = '';
  document.getElementById('an-project-group').style.display = 'none';
  document.getElementById('err-an-body').classList.remove('visible');
  // Reset toggles to defaults
  document.querySelectorAll('.an-level-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.level === 'notice');
  });
  document.querySelectorAll('.an-target-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.target === 'all');
  });
  selectedAnLevel  = 'notice';
  selectedAnTarget = 'all';
}

// --------------------------------------------------------
// Milestone tab (Step 12)
// --------------------------------------------------------
function bindMilestoneTab() {
  // Level buttons
  document.querySelectorAll('.ms-level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ms-level-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMsLevel = btn.dataset.level;
      document.getElementById('err-ms-level').classList.remove('visible');
    });
  });

  // Scope buttons
  document.querySelectorAll('.ms-scope-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ms-scope-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMsScope = btn.dataset.scope;
      document.getElementById('ms-project-group').style.display =
        selectedMsScope === 'project' ? '' : 'none';
    });
  });

  // Populate project dropdown
  const sel = document.getElementById('ms-project');
  if (sel) {
    sel.innerHTML = '<option value="">— Select Project —</option>';
    projects.filter(p => p.active).forEach(p => {
      const opt = document.createElement('option');
      opt.value       = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
  }

  // Add milestone button
  const btnAdd = document.getElementById('btn-add-milestone');
  if (btnAdd) btnAdd.addEventListener('click', addMilestone);
}

function addMilestone() {
  const title = document.getElementById('ms-title').value.trim();
  const date  = document.getElementById('ms-date').value;

  let valid = true;
  const setErr = (id, show) => document.getElementById(id)?.classList[show ? 'add' : 'remove']('visible');

  if (!title)          { setErr('err-ms-title',   true);  valid = false; }
  else                 { setErr('err-ms-title',   false); }
  if (!date)           { setErr('err-ms-date',    true);  valid = false; }
  else                 { setErr('err-ms-date',    false); }
  if (!selectedMsLevel){ setErr('err-ms-level',   true);  valid = false; }
  else                 { setErr('err-ms-level',   false); }

  let projectId = '';
  if (selectedMsScope === 'project') {
    projectId = document.getElementById('ms-project').value;
    if (!projectId) { setErr('err-ms-project', true);  valid = false; }
    else            { setErr('err-ms-project', false); }
  } else {
    setErr('err-ms-project', false);
  }

  if (!valid) return;

  const newMs = {
    id:    'ms_' + Date.now(),
    title,
    date,
    level: selectedMsLevel,
    scope: selectedMsScope,
  };

  if (selectedMsScope === 'project') {
    const proj = projects.find(p => p.id === projectId);
    if (proj) {
      proj.milestones = proj.milestones || [];
      proj.milestones.push(newMs);
      saveProjects();
    }
  } else {
    teamMilestones.push(newMs);
    saveTeamMilestones();
  }

  // Reset form
  document.getElementById('ms-title').value = '';
  document.getElementById('ms-date').value  = '';
  document.querySelectorAll('.ms-level-btn').forEach(b => b.classList.remove('active'));
  selectedMsLevel = '';

  renderMilestoneTable();
}

function renderMilestoneTable() {
  const tbody = document.getElementById('milestone-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const allMs = [];

  // Project milestones
  projects.forEach(proj => {
    (proj.milestones || []).forEach(ms => {
      allMs.push({ ...ms, projectName: proj.name, projectId: proj.id });
    });
  });

  // Team milestones
  teamMilestones.forEach(ms => {
    allMs.push({ ...ms, projectName: 'Team-wide', projectId: '' });
  });

  // Sort by date
  allMs.sort((a, b) => a.date.localeCompare(b.date));

  if (allMs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="text-align:center;padding:20px;">No milestones registered</td></tr>';
    return;
  }

  const levelEmoji = { critical: '🔴', major: '🟡', minor: '⚪' };

  allMs.forEach(ms => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-size:12px; color:var(--text-secondary); white-space:nowrap;">${escHtml(ms.date)}</td>
      <td>${levelEmoji[ms.level] || '⚪'} ${escHtml(ms.title)}</td>
      <td style="font-size:12px; color:var(--text-secondary);">${escHtml(ms.projectName)}</td>
      <td>
        <button class="btn btn--danger" style="font-size:12px; padding:4px 10px;"
          data-action="delete-ms"
          data-id="${escHtml(ms.id)}"
          data-scope="${escHtml(ms.scope || 'project')}"
          data-project="${escHtml(ms.projectId)}">
          Delete
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Event delegation
  tbody.onclick = e => {
    const btn = e.target.closest('[data-action="delete-ms"]');
    if (!btn) return;
    deleteMilestone(btn.dataset.id, btn.dataset.scope, btn.dataset.project);
  };
}

function deleteMilestone(id, scope, projectId) {
  if (scope === 'project') {
    const proj = projects.find(p => p.id === projectId);
    if (proj) {
      proj.milestones = (proj.milestones || []).filter(ms => ms.id !== id);
      saveProjects();
    }
  } else {
    teamMilestones = teamMilestones.filter(ms => ms.id !== id);
    saveTeamMilestones();
  }
  renderMilestoneTable();
}

// --------------------------------------------------------
// Workload tab
// --------------------------------------------------------

// Return labels for last 4 weeks in newest order
function getPast4Weeks() {
  const weeks = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    const year  = d.getFullYear();
    const start = new Date(year, 0, 1);
    const week  = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
    weeks.push(`${year}-W${String(week).padStart(2, '0')}`);
  }
  return weeks;
}

async function renderWorkload() {
  renderAssignMatrix();
  await renderHeatmap();
}

// C-1: Assign Matrix
function renderAssignMatrix() {
  const head = document.getElementById('assign-head');
  const body = document.getElementById('assign-body');
  if (!head || !body) return;

  const activeProjects = projects.filter(p => p.active);
  const activeMembers  = members.filter(m => m.active);

  // Header row
  head.innerHTML = '<th></th>' +
    activeProjects.map(p => `<th style="font-size:12px;">${escHtml(p.name)}</th>`).join('');

  // Data rows
  body.innerHTML = '';
  activeMembers.forEach(m => {
    const tr = document.createElement('tr');
    let cells = `<td><strong>${escHtml(m.display_name)}</strong></td>`;

    activeProjects.forEach(p => {
      const assigned = (p.members || []).includes(m.id);
      cells += `
        <td style="text-align:center; cursor:pointer; font-size:18px;"
            data-action="toggle-assign"
            data-member="${escHtml(m.id)}"
            data-project="${escHtml(p.id)}"
            title="${assigned ? 'Click to remove assignment' : 'Click to add assignment'}">
          ${assigned ? '●' : '<span style="color:var(--text-muted);">·</span>'}
        </td>`;
    });

    tr.innerHTML = cells;
    body.appendChild(tr);
  });

  // Event delegation
  body.onclick = e => {
    const td = e.target.closest('[data-action="toggle-assign"]');
    if (!td) return;
    toggleAssign(td.dataset.member, td.dataset.project);
  };
}

function toggleAssign(memberId, projectId) {
  const proj   = projects.find(p => p.id === projectId);
  const member = members.find(m => m.id === memberId);
  if (!proj || !member) return;

  // Update project side
  proj.members = proj.members || [];
  const projIdx = proj.members.indexOf(memberId);
  if (projIdx === -1) {
    proj.members.push(memberId);
  } else {
    proj.members.splice(projIdx, 1);
  }

  // Update member side (keep in sync)
  member.projects = member.projects || [];
  const memIdx = member.projects.indexOf(projectId);
  if (projIdx === -1) {
    // was just added to project → add to member.projects
    if (memIdx === -1) member.projects.push(projectId);
  } else {
    // was just removed from project → remove from member.projects
    if (memIdx !== -1) member.projects.splice(memIdx, 1);
  }

  saveProjects();
  saveMembers();
  renderAssignMatrix();
}

// C-2: Workload Heatmap
async function renderHeatmap() {
  const head = document.getElementById('heatmap-head');
  const body = document.getElementById('heatmap-body');
  if (!head || !body) return;

  const weekLabels    = getPast4Weeks();
  const activeMembers = members.filter(m => m.active);

  // Load week data together
  const weekDataMap = new Map(); // weekLabel → rows[]
  await Promise.all(weekLabels.map(async label => {
    try {
      const rows = await fetchJSON(`./data/mock/weekly_${label}.json`);
      weekDataMap.set(label, rows);
    } catch {
      weekDataMap.set(label, []);
    }
  }));

  // Header
  head.innerHTML = '<th></th>' +
    weekLabels.map((w, i) => {
      const label = i === 0 ? `This Week<br><span style="font-size:10px;font-weight:400;">${w}</span>`
                            : `${i} wk${i > 1 ? 's' : ''} ago<br><span style="font-size:10px;font-weight:400;">${w}</span>`;
      return `<th style="text-align:center; min-width:80px;">${label}</th>`;
    }).join('');

  // Data rows + summary aggregation
  body.innerHTML = '';
  let onTrackCount    = 0;
  let totalThisWeek   = 0;
  let consecutiveRed  = 0; // 2+ consecutive weeks 🔴
  let pendingCount    = 0;

  const currentWeek = weekLabels[0];

  activeMembers.forEach(m => {
    const tr = document.createElement('tr');
    let cells = `<td><strong>${escHtml(m.display_name)}</strong></td>`;

    // 連続🔴チェック用
    let redStreak = 0;

    weekLabels.forEach((week, i) => {
      const rows = weekDataMap.get(week) || [];
      const row  = rows.find(r => r.member_id === m.id);
      const status = row?.status ?? '';
      const meta   = getStatusMeta(status);

      // This week summary
      if (i === 0) {
        totalThisWeek++;
        if (status === 'on_track') onTrackCount++;
        if (!status) pendingCount++;
      }

      // Consecutive 🔴
      if (status === 'blocked') { redStreak++; }
      else { redStreak = 0; }

      const bgStyle = {
        on_track: 'background:var(--green-bg);  color:var(--green-text);',
        at_risk:  'background:var(--yellow-bg); color:var(--yellow-text);',
        blocked:  'background:var(--red-bg);    color:var(--red-text);',
      }[status] || 'background:var(--bg-tertiary); color:var(--text-muted);';

      cells += `<td style="text-align:center; ${bgStyle} padding:8px 4px; font-size:16px;"
                    title="${escHtml(m.display_name)} ${week}: ${meta.label}">
                  ${meta.emoji}
                </td>`;
    });

    if (redStreak >= 2) consecutiveRed++;
    tr.innerHTML = cells;
    body.appendChild(tr);
  });

  // Summary metrics
  const summary = document.getElementById('workload-summary');
  if (summary) {
    const onTrackRate = totalThisWeek > 0
      ? Math.round((onTrackCount / totalThisWeek) * 100) : 0;
    summary.innerHTML = `
      <span>🟢 On Track Rate <strong style="color:var(--green-text);">${onTrackRate}%</strong></span>
      <span>🔴 2+ Consecutive Weeks <strong style="color:var(--red-text);">${consecutiveRed}</strong></span>
      <span>⬜ Pending <strong style="color:var(--text-secondary);">${pendingCount}</strong></span>
    `;
  }
}

// --------------------------------------------------------
// Export JSON functionality
// --------------------------------------------------------
function bindExportButton() {
  document.getElementById('btn-export-json').addEventListener('click', exportJsonFiles);
}

function exportJsonFiles() {
  // Always read from localStorage to ensure latest changes are captured
  const latestMembers  = JSON.parse(localStorage.getItem(LS_MEMBERS)         || '[]');
  const latestProjects = JSON.parse(localStorage.getItem(LS_PROJECTS)        || '[]');
  const latestTeamMs   = JSON.parse(localStorage.getItem(LS_TEAM_MILESTONES) || '[]');

  downloadJson('members.json',  { members: latestMembers });
  downloadJson('projects.json', { projects: latestProjects, team_milestones: latestTeamMs });
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --------------------------------------------------------
// Helpers
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
