const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(__dirname, 'data', 'attendance.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// ── Migration: upgrade users table to support owner role + status ──────────
const usersExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
if (usersExists) {
  const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!cols.includes('status')) {
    console.log('[DB] Migrating: adding status column and owner role...');
    db.pragma('foreign_keys = OFF');
    db.exec(`
      CREATE TABLE users_new (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        email       TEXT UNIQUE NOT NULL,
        password    TEXT NOT NULL,
        role        TEXT NOT NULL CHECK(role IN ('owner','trainer','student')),
        status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','pending','rejected')),
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users_new (id, name, email, password, role, status, created_at)
        SELECT id, name, email, password, role, 'active', created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);
    db.pragma('foreign_keys = ON');
    console.log('[DB] Migration complete.');
  }
}

db.pragma('foreign_keys = ON');

// ── Create tables (fresh install) ─────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL CHECK(role IN ('owner','trainer','student')),
    status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','pending','rejected')),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS batches (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT,
    start_date  TEXT NOT NULL,
    end_date    TEXT NOT NULL,
    trainer_id  INTEGER NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id    INTEGER NOT NULL,
    student_id  INTEGER NOT NULL,
    date        TEXT NOT NULL,
    status      TEXT NOT NULL CHECK(status IN ('present','absent','late')),
    marked_by   INTEGER NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id)   REFERENCES batches(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (marked_by)  REFERENCES users(id),
    UNIQUE(batch_id, student_id, date)
  );

  CREATE TABLE IF NOT EXISTS topics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id    INTEGER NOT NULL,
    date        TEXT NOT NULL,
    title       TEXT NOT NULL,
    notes       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
    UNIQUE(batch_id, date)
  );
`);

// ── Seed owner account ─────────────────────────────────────────────────────
const OWNER_EMAIL = 'waqar@definedigital.in';
const existingOwner = db.prepare('SELECT id FROM users WHERE email = ?').get(OWNER_EMAIL);
if (!existingOwner) {
  const hashed = bcrypt.hashSync('Admin@1234', 10);
  db.prepare(`INSERT INTO users (name, email, password, role, status) VALUES (?,?,?,'owner','active')`)
    .run('Waqar', OWNER_EMAIL, hashed);
  console.log(`[DB] Owner account created: ${OWNER_EMAIL} / Admin@1234`);
}

// ── Seed legacy trainer (pre-approved) ────────────────────────────────────
const TRAINER_EMAIL = 'trainer@institute.com';
const existingTrainer = db.prepare('SELECT id FROM users WHERE email = ?').get(TRAINER_EMAIL);
if (!existingTrainer) {
  const hashed = bcrypt.hashSync('trainer123', 10);
  db.prepare(`INSERT INTO users (name, email, password, role, status) VALUES (?,?,?,'trainer','active')`)
    .run('Admin Trainer', TRAINER_EMAIL, hashed);
  console.log('[DB] Default trainer seeded.');
}

module.exports = db;
