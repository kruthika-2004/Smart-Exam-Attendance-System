FaceXam — UI Documentation + AI prompt for UI generation
Nice — below is a complete UI specification you can hand to a designer, a frontend developer, or paste into an AI UI-generation tool (Figma / TeleportHQ / Uizard / similar). It covers structure, pages, components, behavior, data model, interactions, accessibility, and a ready-to-use AI prompt tuned for high-fidelity UI generation.
 
1. Project summary (short)
Name: FaceXam
Purpose: Browser-based attendance & exam hall-ticket system using face recognition. Two dashboards:
•	/admin (Teacher/Admin) — manage classes, students, sessions, and attendance (live & historical).
•	/user (Student) — personal profile, session attendance, hall ticket generation.
Primary constraints: easy-to-scan UI for teachers (fast operations), clear feedback for live attendance, mobile-responsive, accessible.
 
2. Global UI system (visual language)
•	Layout: 12-column grid, centered, 1200px max width on desktop. Left sidebar on desktop, collapsible to top nav on small screens.
•	Spacing: Base spacing 8px (scale: 4/8/16/24/32/48).
•	Typography:
o	Headline: Inter / 600 / 24–28px
o	Subhead: Inter / 500 / 16–18px
o	Body: Inter / 400 / 14px
o	Monospace (for codes): 13px
•	Color palette (example):
o	Primary: #0B6CF9 (blue)
o	Accent/Success: #16A34A (green)
o	Warning: #F59E0B (amber)
o	Danger: #EF4444 (red)
o	Background: #F7F9FC (very light)
o	Surface: #FFFFFF
o	Text primary: #0F172A
o	Muted text: #6B7280
•	Controls & tokens:
o	Buttons: rounded 8px, shadow soft, primary filled, secondary outline
o	Cards: 2xl radius, soft shadow
o	Inputs: 1px subtle border, focus ring primary 2px
•	Icons: line-icon set (feather or lucide), meaningful only (search, camera, plus, edit, csv, export).
•	Interactions: small animated transitions (ease-out 160ms) for modals, toasts, and sidebars.
 
3. Routes & pages (overview)
•	/admin — Admin dashboard root (default overview page)
o	/admin/classes — Create / list classes
o	/admin/students — Student management
o	/admin/sessions — Session management
o	/admin/attendance — Attendance management (live, ongoing, previous)
o	/admin/settings — App settings, exports, backups
•	/user — User (student) dashboard root
o	/user/overview — Sections / attendance summary
o	/user/profile — Profile & edit
o	/user/sessions — Session attendance list (join live)
o	/user/attendance-status — per-session details & history
o	/user/hallticket — Generate hall ticket
 
4. Admin/Teacher dashboard — detailed spec
4.1 Layout & global chrome
•	Left Sidebar (persistent)
o	Top: Logo (FaceXam) + small org label
o	Navigation (vertical):
	Overview (dashboard)
	Create Class
	Student Management
	Session Management
	Attendance Management
	Settings / Exports
o	Bottom: user avatar + short name + quick logout
•	Top bar
o	Page title
o	Search input (search students/sessions)
o	Notifications bell (attendance alerts)
o	Fast action button: + New (dropdown: Class, Student, Session)
•	Main area: content region with cards & lists (scrollable)
4.2 Create Class (page /admin/classes)
Layout: two-tab trigger component (All Classes | Create Class)
Tab: All Classes
•	Grid of class cards:
o	Each card: Class name (e.g., "CSE - A"), Branch, Section, #students, Quick actions: Edit, Add Students, View Sessions.
o	Card footer: "Open Session" (start quick session) button
•	Search & filters at top (branch, section)
Tab: Create Class (form)
•	Fields:
o	Branch name (select / text)
o	Section name (text)
o	Academic Year (optional)
o	Description (optional)
•	Buttons: Create & Add Students (primary) / Create (secondary)
•	After create: success toast + auto navigate to "Add Students" modal or Student Management pre-filtered to that class.
4.3 Student Management (/admin/students)
•	Top: bulk actions (Import CSV, Export, Add Student)
•	Filters: class select, search by name/usn/email
•	List / table view:
o	Columns: Photo (circle), Name, USN, Email, Phone, Branch, Sem, Actions (Edit, Delete, Compute Descriptor, View Attendance)
•	Row actions:
o	Edit opens modal with full form:
	First/Last name, USN, Email, Phone, Branch, Semester, Photo upload (drag & drop), Notes
	Face descriptor status badge (computed / not computed)
	Button: Compute Descriptor (runs face-api.js on upload — stores descriptor locally / sends to server)
o	Compute Descriptor: compute descriptor from uploaded photo (client-side), show confidence; retry if no face found.
•	Bulk import:
o	CSV mapping wizard (map CSV columns to fields)
o	Upload photos via zipped folder option (optional)
•	Export: CSV of students + option to export descriptors JSON.
4.4 Session Management (/admin/sessions)
•	Tab trigger: Current Sessions | Add New Session
Current Sessions
•	List of upcoming & ongoing sessions (cards / table)
•	Each session row shows:
o	Session name (e.g., "Math - Sem A"), Class, Date & Time, Duration, Status badge (Upcoming / Live / Ended), Actions (Open Live View / View Attendance / Edit / End)
•	Live indicator for ongoing sessions.
Add New Session (form)
•	Fields:
o	Session title
o	Class (dropdown)
o	Date & start time (datetime picker)
o	Duration (minutes / hours)
o	Session notes (optional)
o	Auto-mark rules (optional): e.g., minimum recognition confidence, mark once per session
•	Create button shows success and adds to Current Sessions
4.5 Attendance Management (/admin/attendance)
•	Sub-tabs: Live Attendance | Ongoing | Previous Sessions
•	Live Attendance: interactive live view (opens session live UI)
o	Left: live camera feed (large), overlay bounding boxes + recognized name + green tick when marked
o	Right: attendee list with live updates (Name, USN, status badge, timestamp)
o	Controls:
	Start / Stop session
	Mark Manual (search & mark)
	Undo for last mark
	Export CSV for session
	Settings (face recognition threshold, frame interval)
o	Toasts for errors/warnings (no descriptors, camera disconnect)
•	Ongoing: list of sessions not ended — quick links to their live views
•	Previous Sessions: searchable list with session details, statistics (attendance % per student/class), download CSV, view session timeline.
 
5. Student (/user) dashboard — detailed spec
5.1 Layout & global chrome
•	Left sidebar compact (Overview, Profile, Session Attendance, Attendance Status, Generate Hall Ticket)
•	Top header: student name + avatar, notifications, logout
5.2 Overview (/user/overview)
•	Card grid:
o	Overall attendance percentage (big donut chart)
o	Sessions attended (count)
o	Upcoming sessions (list)
o	Quick action: Generate Hall Ticket
•	Section breakdown per class (list with progress bars for each class/subject)
5.3 Profile (/user/profile)
•	Editable card with:
o	Photo (circle) with Change Photo
o	Fields: Name, USN, Email, Phone, Branch, Semester
o	Stats: Sessions Attended (numeric), Overall Attendance % (big number)
•	Button: Request Correction (to report attendance error)
5.4 Session Attendance (/user/sessions)
•	List of sessions student can join (if live) or view history
•	Each item shows status (Live / Upcoming / Completed), join link (if live), details
5.5 Attendance Status (/user/attendance-status)
•	Timeline or table of all sessions with status:
o	Date, Session name, Class, Marked/Absent, Marked at (time)
o	Filter by date range, class
o	Export personal attendance PDF
5.6 Generate Hall Ticket (/user/hallticket)
•	Small form:
o	Name (pre-filled)
o	USN (pre-filled)
o	Subject code (dropdown / text)
•	Generate button → preview of hall ticket (paper-like card):
o	Student photo, signature image (upload or predefined), name, USN, subject code, exam date, exam time, teacher signature placeholder (blank line + label)
o	Button: Download PDF and Send to Email
•	Hall ticket template must be printable (A4), clear margins, QR code optional (encoded with USN + session id)
 
6. Data model (entities & keys)
•	Class
o	id, branchName, sectionName, academicYear, createdAt
•	Student
o	id, name, usn, email, phone, branch, semester, photoUrl, descriptor (array 128 floats), createdAt
•	Session
o	id, title, classId, startAt (datetime), durationMin, status, version, createdAt
•	Attendance
o	id, sessionId, studentId, timestamp, method (face/manual), confidence (float), deviceId, markedBy
•	User (admin/teacher)
o	id, name, email, role
 
7. Interaction patterns & UX rules
•	Compute Descriptor: always client-side (face-api.js), show status; if no face detected, show error and image crop suggestion.
•	Live marking debounce & duplicate prevention:
o	Block further automatic marks for same student for the same session by server-side check of (sessionId, studentId).
o	Client shows “Already marked” state if duplicate attempt happens.
•	Network failure:
o	Client caches events locally (IndexedDB) and retries sync when online. Show offline banner.
•	Security:
o	Sensitive endpoints require auth (teacher tokens). Use HTTPS for production.
•	Accessibility:
o	All buttons & inputs keyboard-focusable. Alt text for images. High contrast mode supported.
•	Notifications:
o	Use ephemeral toasts for successes/errors; use persistent modals for destructive actions (delete class/student).
 
8. Responsive behavior
•	Desktop (≥1024px): full sidebar + 2-column layout for live view (camera + attendee list).
•	Tablet (>=768px): collapsible sidebar, single column stacking (camera above list).
•	Mobile (<768px): sidebar becomes bottom nav; camera view occupies full screen when active; admin tasks use simplified forms and list views.
 
9. Accessibility & internationalization
•	Labels for all form fields, ARIA roles for live camera feed region, alt text for images, keyboard shortcuts for quick actions (N for new session, C for compute descriptor).
•	Strings externalized for i18n (support English + local language).
 
10. API surface (minimal recommended endpoints)
•	GET /api/classes
•	POST /api/classes {branch,section}
•	GET /api/classes/:id
•	POST /api/students {name,usn,email,phone,branch,semester,photo}
•	PUT /api/students/:id (update descriptor)
•	GET /api/sessions?classId=...
•	POST /api/sessions {title,classId,startAt,duration}
•	POST /api/attendance/mark {sessionId,studentId,method:"face",confidence,deviceId}
•	GET /api/attendance?sessionId=...
•	POST /api/export/session/:id -> CSV
•	POST /api/import (students/csv/json)
(Use auth tokens on all of these.)
 
11. Error / edge-case handling
•	If descriptor missing, show red banner with a one-click Compute Descriptor action.
•	If camera blocked: show full-screen help modal with steps to enable camera.
•	If multiple faces in frame during mark: show modal asking teacher to confirm which person to mark.
•	If attendance marking fails (network), queue locally and retry with exponential backoff; mark record as pending in UI.
 
12. Deliverables for dev/design hand-off
•	High-fidelity screens for:
o	Admin: Classes list, Create Class, Student list edit modal, Add Session, Live Attendance view, Previous session report
o	User: Overview, Profile, Session list, Hall ticket generator
•	Component library:
o	Sidebar, Topbar, Card, Table, Forms, Modals, Toasts, Avatar, CameraFeed component (with overlay)
•	Interaction spec (micro-interactions) for live marking, toasts, and confirmation modals
•	Data-contract doc (for backend devs) showing request/response examples

