import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs, { type Database } from "sql.js";

export type DatabaseState = {
  db: Database;
  path: string;
  connected: boolean;
  fts5: boolean;
  persist: () => void;
  close: () => void;
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const defaultDatabasePath = path.join(projectRoot, "data/app.db");

export async function initDatabase(databasePath = process.env.DATABASE_PATH ?? defaultDatabasePath): Promise<DatabaseState> {
  const resolvedPath = path.isAbsolute(databasePath) ? databasePath : path.resolve(projectRoot, databasePath);
  mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const SQL = await initSqlJs();
  const db = existsSync(resolvedPath) ? new SQL.Database(readFileSync(resolvedPath)) : new SQL.Database();

  db.exec("PRAGMA foreign_keys = ON;");
  createTables(db);

  const persist = () => {
    writeFileSync(resolvedPath, Buffer.from(db.export()));
  };

  persist();

  return {
    db,
    path: resolvedPath,
    connected: true,
    fts5: detectFts5(db),
    persist,
    close: () => {
      persist();
      db.close();
    }
  };
}

function createTables(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      default_branch TEXT NOT NULL DEFAULT 'main',
      description TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS worktrees (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      branch TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'clean',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE (project_id, name)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      source_note_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      name TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'global',
      prompt TEXT NOT NULL DEFAULT '',
      script TEXT,
      parameters TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE (project_id, name)
    );

    CREATE TABLE IF NOT EXISTS prompt_drafts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      todo_id TEXT,
      worktree_id TEXT,
      requested_worktree_name TEXT,
      source TEXT NOT NULL DEFAULT 'direct',
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE SET NULL,
      FOREIGN KEY (worktree_id) REFERENCES worktrees(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      worktree_id TEXT,
      todo_id TEXT,
      prompt_draft_id TEXT,
      requested_worktree_name TEXT,
      source TEXT NOT NULL DEFAULT 'direct',
      name TEXT NOT NULL DEFAULT '未命名会话',
      prompt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      runtime_status TEXT,
      summary TEXT,
      pid INTEGER,
      cwd TEXT,
      resolved_worktree_path TEXT,
      exit_code INTEGER,
      last_activity_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (worktree_id) REFERENCES worktrees(id) ON DELETE SET NULL,
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE SET NULL,
      FOREIGN KEY (prompt_draft_id) REFERENCES prompt_drafts(id) ON DELETE SET NULL
    );
  `);

  ensureColumn(db, "sessions", "prompt_draft_id", "TEXT");
  ensureColumn(db, "sessions", "requested_worktree_name", "TEXT");
  ensureColumn(db, "sessions", "source", "TEXT NOT NULL DEFAULT 'direct'");
  ensureColumn(db, "sessions", "name", "TEXT NOT NULL DEFAULT '未命名会话'");
  ensureColumn(db, "sessions", "runtime_status", "TEXT");
  ensureColumn(db, "sessions", "pid", "INTEGER");
  ensureColumn(db, "sessions", "cwd", "TEXT");
  ensureColumn(db, "sessions", "resolved_worktree_path", "TEXT");
  ensureColumn(db, "sessions", "exit_code", "INTEGER");
  ensureColumn(db, "sessions", "last_activity_at", "TEXT");
}

function ensureColumn(db: Database, tableName: string, columnName: string, definition: string) {
  const statement = db.prepare(`PRAGMA table_info(${tableName});`);
  let exists = false;

  try {
    while (statement.step()) {
      const row = statement.getAsObject() as { name?: unknown };

      if (row.name === columnName) {
        exists = true;
        break;
      }
    }
  } finally {
    statement.free();
  }

  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

function detectFts5(db: Database) {
  try {
    db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS fts5_probe USING fts5(content);");
    db.exec("DROP TABLE IF EXISTS fts5_probe;");
    return true;
  } catch {
    return false;
  }
}
