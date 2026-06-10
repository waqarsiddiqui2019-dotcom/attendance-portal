const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'attendance.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

console.log('[DB] Using database at:', dbPath);
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Step 1: Create all tables unconditionally (IF NOT EXISTS = safe always) ──
// All columns — including those previously added via ALTER TABLE — are included
// here so a fresh database gets the complete schema in one shot.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL CHECK(role IN ('owner','co_owner','admin','trainer','student')),
    status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','pending','rejected','inactive')),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen   DATETIME
  );

  CREATE TABLE IF NOT EXISTS batches (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    name              TEXT NOT NULL,
    description       TEXT,
    start_date        TEXT NOT NULL,
    end_date          TEXT NOT NULL,
    trainer_id        INTEGER NOT NULL,
    mode              TEXT DEFAULT 'offline',
    sessions_per_week INTEGER,
    class_days        TEXT,
    status            TEXT DEFAULT 'active',
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trainer_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS batch_students (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id    INTEGER NOT NULL,
    student_id  INTEGER NOT NULL,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id)   REFERENCES batches(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id)   ON DELETE CASCADE,
    UNIQUE(batch_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id      INTEGER NOT NULL,
    student_id    INTEGER NOT NULL,
    date          TEXT NOT NULL,
    status        TEXT NOT NULL CHECK(status IN ('present','absent','late')),
    marked_by     INTEGER NOT NULL,
    confirm_token TEXT,
    confirmed_at  DATETIME,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id)   REFERENCES batches(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (marked_by)  REFERENCES users(id),
    UNIQUE(batch_id, student_id, date)
  );

  CREATE TABLE IF NOT EXISTS topics (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id          INTEGER NOT NULL,
    date              TEXT NOT NULL,
    title             TEXT NOT NULL,
    notes             TEXT,
    mode              TEXT,
    duration_hours    REAL DEFAULT 1,
    completion_status TEXT DEFAULT 'pending',
    is_revision       INTEGER DEFAULT 0,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
    UNIQUE(batch_id, date)
  );

  CREATE TABLE IF NOT EXISTS topic_sets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    trainer_id  INTEGER NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS topic_set_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id         INTEGER NOT NULL,
    order_index    INTEGER NOT NULL DEFAULT 0,
    title          TEXT NOT NULL,
    description    TEXT,
    duration_hours REAL DEFAULT 1,
    mode           TEXT NOT NULL DEFAULT 'offline',
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (set_id) REFERENCES topic_sets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS syllabus_topics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id    INTEGER NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    title       TEXT NOT NULL,
    description TEXT,
    mode        TEXT NOT NULL DEFAULT 'offline',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT NOT NULL,
    name        TEXT NOT NULL,
    applies_to  TEXT NOT NULL DEFAULT 'all',
    batch_ids   TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS leave_requests (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id         INTEGER NOT NULL,
    batch_id           INTEGER NOT NULL,
    leave_type         TEXT NOT NULL,
    leave_type_note    TEXT,
    from_date          TEXT NOT NULL,
    to_date            TEXT NOT NULL,
    reason             TEXT NOT NULL,
    status             TEXT NOT NULL DEFAULT 'pending',
    trainer_note       TEXT,
    rejection_reason   TEXT,
    counter_from_date  TEXT,
    counter_to_date    TEXT,
    counter_message    TEXT,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at        DATETIME,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id)   REFERENCES batches(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS appointment_requests (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id       INTEGER NOT NULL,
    batch_id         INTEGER NOT NULL,
    preferred_date   TEXT NOT NULL,
    preferred_time   TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    topic_question   TEXT NOT NULL,
    mode             TEXT NOT NULL DEFAULT 'online',
    status           TEXT NOT NULL DEFAULT 'pending',
    trainer_note     TEXT,
    suggested_date   TEXT,
    suggested_time   TEXT,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at      DATETIME,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id)   REFERENCES batches(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    title        TEXT NOT NULL,
    message      TEXT NOT NULL,
    type         TEXT NOT NULL DEFAULT 'info',
    related_type TEXT,
    related_id   INTEGER,
    is_read      INTEGER NOT NULL DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id    INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    body         TEXT NOT NULL,
    is_read      INTEGER NOT NULL DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id)    REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS staff_permissions (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                  INTEGER NOT NULL UNIQUE,
    can_manage_trainers      INTEGER NOT NULL DEFAULT 0,
    can_manage_students      INTEGER NOT NULL DEFAULT 0,
    can_manage_batches       INTEGER NOT NULL DEFAULT 0,
    can_view_reports         INTEGER NOT NULL DEFAULT 1,
    can_approve_leaves       INTEGER NOT NULL DEFAULT 0,
    can_message_all          INTEGER NOT NULL DEFAULT 1,
    can_admit_students       INTEGER NOT NULL DEFAULT 0,
    can_reassign_students    INTEGER NOT NULL DEFAULT 0,
    can_send_announcements   INTEGER NOT NULL DEFAULT 0,
    can_view_financials      INTEGER NOT NULL DEFAULT 0,
    can_manage_daily_log     INTEGER NOT NULL DEFAULT 0,
    created_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS student_admissions (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                     INTEGER NOT NULL UNIQUE,
    batch_id                    INTEGER,
    admitted_by                 INTEGER,
    phone                       TEXT,
    whatsapp                    TEXT,
    dob                         TEXT,
    gender                      TEXT,
    profile_photo               TEXT,
    city                        TEXT,
    state                       TEXT,
    pin_code                    TEXT,
    highest_qualification       TEXT,
    field_of_study              TEXT,
    college_name                TEXT,
    year_of_passing             TEXT,
    preferred_mode              TEXT DEFAULT 'no_preference',
    emergency_contact_name      TEXT,
    emergency_contact_relation  TEXT,
    emergency_contact_phone     TEXT,
    heard_about_us              TEXT,
    prior_knowledge             TEXT DEFAULT 'none',
    special_requirements        TEXT,
    id_proof_name               TEXT,
    id_proof_data               TEXT,
    edu_cert_name               TEXT,
    edu_cert_data               TEXT,
    other_doc_name              TEXT,
    other_doc_data              TEXT,
    created_at                  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id)    REFERENCES batches(id),
    FOREIGN KEY (admitted_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS student_reassignments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id      INTEGER NOT NULL,
    old_batch_id    INTEGER,
    new_batch_id    INTEGER NOT NULL,
    old_trainer_id  INTEGER,
    new_trainer_id  INTEGER,
    reason          TEXT NOT NULL,
    effective_date  TEXT NOT NULL,
    keep_attendance INTEGER DEFAULT 1,
    reassigned_by   INTEGER NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id)    REFERENCES users(id),
    FOREIGN KEY (reassigned_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS daily_log (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    logged_by         INTEGER NOT NULL,
    log_date          TEXT NOT NULL,
    log_time          TEXT NOT NULL,
    category          TEXT NOT NULL DEFAULT 'other',
    person_name       TEXT,
    student_id        INTEGER,
    description       TEXT NOT NULL,
    outcome           TEXT NOT NULL DEFAULT 'informational',
    followup_required INTEGER NOT NULL DEFAULT 0,
    followup_date     TEXT,
    followup_note     TEXT,
    followup_done     INTEGER NOT NULL DEFAULT 0,
    priority          TEXT NOT NULL DEFAULT 'medium',
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (logged_by)  REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    token      TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used       INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ── Step 2: Migrations (upgrade old databases that predate certain columns) ───
// All PRAGMA table_info calls are safe here because tables now exist above.
// These are no-ops on fresh databases (columns already in CREATE TABLE above).

// Migrate: add last_seen to users
{
  const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!cols.includes('last_seen')) {
    db.exec('ALTER TABLE users ADD COLUMN last_seen DATETIME');
    console.log('[DB] Added last_seen column to users');
  }
}

// Migrate: add schedule fields to batches
{
  const cols = db.prepare('PRAGMA table_info(batches)').all().map(c => c.name);
  if (!cols.includes('mode'))              { db.exec(`ALTER TABLE batches ADD COLUMN mode TEXT DEFAULT 'offline'`);    console.log('[DB] Added mode to batches'); }
  if (!cols.includes('sessions_per_week')) { db.exec(`ALTER TABLE batches ADD COLUMN sessions_per_week INTEGER`);     console.log('[DB] Added sessions_per_week to batches'); }
  if (!cols.includes('class_days'))        { db.exec(`ALTER TABLE batches ADD COLUMN class_days TEXT`);               console.log('[DB] Added class_days to batches'); }
  if (!cols.includes('status'))            { db.exec(`ALTER TABLE batches ADD COLUMN status TEXT DEFAULT 'active'`);  console.log('[DB] Added status to batches'); }
}

// Migrate: add confirmation tracking to attendance
{
  const cols = db.prepare('PRAGMA table_info(attendance)').all().map(c => c.name);
  if (!cols.includes('confirm_token')) { db.exec('ALTER TABLE attendance ADD COLUMN confirm_token TEXT');    console.log('[DB] Added confirm_token to attendance'); }
  if (!cols.includes('confirmed_at'))  { db.exec('ALTER TABLE attendance ADD COLUMN confirmed_at DATETIME'); console.log('[DB] Added confirmed_at to attendance'); }
}

// Migrate: add extended columns to topics
{
  const cols = db.prepare('PRAGMA table_info(topics)').all().map(c => c.name);
  if (!cols.includes('mode'))              { db.exec(`ALTER TABLE topics ADD COLUMN mode TEXT`);                                   console.log('[DB] Added mode to topics'); }
  if (!cols.includes('duration_hours'))    { db.exec(`ALTER TABLE topics ADD COLUMN duration_hours REAL DEFAULT 1`);               console.log('[DB] Added duration_hours to topics'); }
  if (!cols.includes('completion_status')) { db.exec(`ALTER TABLE topics ADD COLUMN completion_status TEXT DEFAULT 'pending'`);    console.log('[DB] Added completion_status to topics'); }
  if (!cols.includes('is_revision'))       { db.exec(`ALTER TABLE topics ADD COLUMN is_revision INTEGER DEFAULT 0`);              console.log('[DB] Added is_revision to topics'); }
}

// Migrate: add extended permission columns to staff_permissions
{
  const cols = db.prepare('PRAGMA table_info(staff_permissions)').all().map(c => c.name);
  const newPerms = [
    ['can_admit_students',    'INTEGER NOT NULL DEFAULT 0'],
    ['can_reassign_students', 'INTEGER NOT NULL DEFAULT 0'],
    ['can_send_announcements','INTEGER NOT NULL DEFAULT 0'],
    ['can_view_financials',   'INTEGER NOT NULL DEFAULT 0'],
    ['can_manage_daily_log',  'INTEGER NOT NULL DEFAULT 0'],
  ];
  for (const [col, def] of newPerms) {
    if (!cols.includes(col)) {
      db.exec(`ALTER TABLE staff_permissions ADD COLUMN ${col} ${def}`);
      console.log(`[DB] Added ${col} to staff_permissions`);
    }
  }
}

// ── Step 3: Seed owner account (only if not present) ─────────────────────────
const OWNER_EMAIL = 'waqar@definedigital.in';
if (!db.prepare('SELECT id FROM users WHERE email = ?').get(OWNER_EMAIL)) {
  const hashed = bcrypt.hashSync('Admin@1234', 10);
  db.prepare(`INSERT INTO users (name, email, password, role, status) VALUES (?,?,?,'owner','active')`)
    .run('Waqar', OWNER_EMAIL, hashed);
  console.log(`[DB] Owner account created: ${OWNER_EMAIL} / Admin@1234`);
}

// ── Step 4: Seed legacy trainer (only if not present) ────────────────────────
const TRAINER_EMAIL = 'trainer@institute.com';
if (!db.prepare('SELECT id FROM users WHERE email = ?').get(TRAINER_EMAIL)) {
  const hashed = bcrypt.hashSync('trainer123', 10);
  db.prepare(`INSERT INTO users (name, email, password, role, status) VALUES (?,?,?,'trainer','active')`)
    .run('Admin Trainer', TRAINER_EMAIL, hashed);
  console.log('[DB] Default trainer seeded.');
}

module.exports = db;
