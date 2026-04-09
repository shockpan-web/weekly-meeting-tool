# FocusBoard — Open Source Edition
**Version 5.0 | Architecture: Serverless (Firebase / Firestore)**

---

## 1. Project Overview

FocusBoard is an open-source tool for streamlining team weekly meetings by shifting status updates to an asynchronous model. 

**Core Concept:**
- Members submit status updates asynchronously before the meeting.
- Managers focus immediately on blockers at the start of the meeting.
- Real-time data sharing via Firebase ensures everyone is on the same page.
- **"Zero-reporting meetings"** — meetings are dedicated entirely to decision-making and unblocking.

**System Architecture:**

```text
[ Input ] Member PCs
  └── index.html
      └── Select Status ➔ Submit ➔ Firestore (weekly collection)

[ Storage ] Firebase Firestore
  ├── weekly updates (collection)
  └── announcements (collection)

[ View ] Manager/Team Dashboards
  ├── dashboard.html ➔ Real-time dashboard with Focus Mode
  └── admin.html ➔ Manage milestones, members, projects, and announcements
```

---

## 2. Directory Structure

```text
focusboard/
├── index.html             # Member input form
├── dashboard.html         # Team dashboard view
├── admin.html             # Admin panel
├── generate_input_html.py # Script to generate standalone HTML files
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── utils.js
│       ├── index.js
│       ├── dashboard.js
│       ├── admin.js
│       ├── confetti.js
│       └── firebase-config.js
└── data/                  # Initial master data configuration
    ├── projects.json
    ├── members.json
    └── mock/              # Mock data for local development mode
```

---

## 3. Role & Permission Design

### Roles

| Role | Details |
|---|---|
| `member` | Can submit their own status and view the team dashboard. |
| `manager` | Full access. Can access the Admin panel, manage projects, milestones, announcements, and team member roles. |

### Access Control Matrix

| Feature | `member` | `manager` |
|---|---|---|
| Submit Weekly Status | ✅ | ✅ |
| View Team Dashboard | ✅ | ✅ |
| Trigger Focus Mode | ❌ | ✅ |
| Manage Master Data | ❌ | ✅ |
| Manage Milestones | ❌ | ✅ |
| Manage Announcements | ❌ | ✅ |
| View Workload Matrix | ❌ | ✅ |
| Change Member Roles | ❌ | ✅ |

---

## 4. Data Models (Firestore & JSON)

### 4.1 Firestore Collections

**Collection: `weekly`**
Stores the weekly updates submitted by team members.

| Field | Type | Description |
|---|---|---|
| `member_id` | String | Submitting member's ID |
| `member_name` | String | Submitting member's display name |
| `project_id` | String | Target project ID |
| `project_name`| String | Target project display name |
| `week` | String | Target week (e.g., "2025-W12") |
| `status` | String | `on_track`, `at_risk`, `blocked`, or `no_update` |
| `top1`, `top2`, `top3` | String | Key updates for the week |
| `blocker` | String | Issue details (active only if `status` is at_risk or blocked) |
| `submitted_at` | Timestamp | Server timestamp of submission |

**Collection: `announcements`**
Stores team-wide or project-specific announcements shown across all views.

| Field | Type | Description |
|---|---|---|
| `text` / `body` | String | The announcement message |
| `level` | String | `urgent`, `notice`, or `info` |
| `target` | String | `all` or specific target project ID |
| `start_date` | String | Display start date (YYYY-MM-DD) |
| `end_date` | String | Display end date (YYYY-MM-DD) |
| `active` | Boolean | Whether the announcement is active |
| `created_by` | String | Author member ID |
| `created_at` | Timestamp | Server timestamp of creation |

### 4.2 Local Configuration JSON

**`data/projects.json`**
Stores project configurations and predefined milestones.

```json
{
  "projects": [
    {
      "id": "proj_alpha",
      "name": "Project Alpha: Frontend Overhaul",
      "phase": "In Progress",
      "members": ["alex", "member_b"],
      "start_date": "2025-01-15",
      "end_date": "2025-06-30",
      "active": true,
      "color": "#1f6feb",
      "milestones": []
    }
  ],
  "team_milestones": []
}
```

**`data/members.json`**
Stores user profiles and project assignments.

```json
{
  "members": [
    {
      "id": "alex",
      "display_name": "Alex",
      "role": "manager",
      "projects": ["proj_alpha", "proj_beta"],
      "active": true
    }
  ]
}
```

---

## 5. UI & Component Specifications

### 5.1 Common Styling (`style.css`)
- **Theme:** Dark mode by default. Minimalist aesthetics designed for clarity.
- **Core Elements:** Badges, Cards, Modals, and consistent CSS variables for accent colors indicating statuses (Red, Yellow, Green).

### 5.2 Input View (`index.html`)
- Displays dynamic sections based on the user's assigned projects.
- **"No update this week" toggle:** Disables input for projects with no recent activity and labels them with the `no_update` status to quickly signal to managers that no time is needed.
- **Validation:** Enforces input restrictions (e.g., blocker field is mandatory when status is At Risk or Blocked).

### 5.3 Dashboard View (`dashboard.html`)
- **Card Sorting Prioritization:** 🔴 Blocked → 🟡 At Risk → 🟢 On Track → 🔘 No Update → ⬜ Not submitted.
- **Timeline:** Visualizes upcoming project milestones (next 3 months) and recently completed ones (past 2 weeks).
- **Focus Mode:** Dims all `on_track` items to easily identify and focus solely on blocked or at-risk tickets during meetings.
- **Team Health Score:** Dynamic display showing the percentage of team members on track, including a weekly "streak" tracker.

### 5.4 Admin View (`admin.html`)
- **Master Data:** Manage users and projects. Visual UI for editing local JSON arrays.
- **Milestones:** UI for adding Team-wide and Project-specific goals directly to the configuration.
- **Announcements:** Publishing system with priority levels (`Urgent`, `Notice`, `Info`) that creates records in Firestore.
- **Workloads:** Assignment matrix for balancing team workloads across projects.

---

## 6. Initial Setup & Deployment

### Step 1: Firebase Configuration
1. Create a Project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Firestore Database** in test mode or configure custom authenticated access rules.
3. Retrieve your Firebase Configuration variables.
4. Update `focusboard/static/js/firebase-config.js` with your active credentials.

### Step 2: Distribution Generation
Run the distribution generator to embed local configurations into standalone HTML files per member workspace, preventing them from needing server-side compilation or file dependencies.

```bash
python3 focusboard/generate_input_html.py
```
Generated standalone HTML files will be saved in the `focusboard/dist/` directory.

### Step 3: Local Testing / Development
You can test the frontend locally by passing `?dev=true` to force it to use mocked JSON database values from `/data/mock/` instead of reaching out to your live Firestore database.

```bash
cd focusboard
python3 -m http.server 8080

open 'http://localhost:8080/dashboard.html?dev=true'
```

---

## 7. Troubleshooting

| Symptom | Cause | Remedy |
|---|---|---|
| Data not loading | Firebase Config | Ensure `static/js/firebase-config.js` exists and is populated correctly. |
| Permission denied | Firestore Rules | Ensure proper Read/Write rules are set in the Firebase Console. |
| Submit button disabled | Validation Error | Ensure at least one project has status updates or is marked "No update". |
| Cannot access Admin | Role Mismatch | Check `members.json` to ensure the member URL matches a user with `"role": "manager"`. |
| Old data showing | Cache / Firestore | Verify the correct document structure exists in the Firestore `weekly` collection. |

---

*FocusBoard — Open Source Edition | Released 2026-04*

*v5.0 Major Updates:*
* Fully migrated backend from local Excel/Power Automate implementations to Firebase (Firestore).
* Deprecated reliance on Outlook mailto submission mechanisms.
* Removed auto-generated corporate project terminology for generic open-source compatibility.
* Enabled true cross-team real-time data access via a serverless architecture.
