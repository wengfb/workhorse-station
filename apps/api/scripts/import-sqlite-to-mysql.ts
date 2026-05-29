import sqlite3 from "node:sqlite";
import mysql from "mysql2/promise";
import { schemaStatements } from "../src/db/schema.js";

type TableSpec = {
  name: string;
  columns: string[];
  orderBy?: string;
};

const TABLES: TableSpec[] = [
  {
    name: "projects",
    columns: ["id", "name", "path", "default_branch", "description", "latest_session_result", "created_at", "updated_at"]
  },
  {
    name: "worktrees",
    columns: ["id", "project_id", "name", "path", "branch", "status", "created_at", "updated_at"]
  },
  {
    name: "notes",
    columns: ["id", "project_id", "title", "content", "tags", "created_at", "updated_at", "source_chat_suggestion_json"]
  },
  {
    name: "todos",
    columns: [
      "id",
      "project_id",
      "source_note_id",
      "title",
      "description",
      "status",
      "tags",
      "latest_session_result",
      "completed_at",
      "created_at",
      "updated_at",
      "source_chat_suggestion_json"
    ]
  },
  {
    name: "skills",
    columns: ["id", "project_id", "name", "scope", "prompt", "script", "parameters", "created_at", "updated_at"]
  },
  {
    name: "prompt_drafts",
    columns: [
      "id",
      "project_id",
      "todo_id",
      "worktree_id",
      "requested_worktree_name",
      "source",
      "title",
      "prompt",
      "status",
      "created_at",
      "updated_at",
      "source_chat_suggestion_json"
    ]
  },
  {
    name: "sessions",
    columns: [
      "id",
      "project_id",
      "worktree_id",
      "todo_id",
      "prompt_draft_id",
      "requested_worktree_name",
      "source",
      "name",
      "prompt",
      "status",
      "runtime_status",
      "summary",
      "pid",
      "cwd",
      "resolved_worktree_path",
      "exit_code",
      "last_activity_at",
      "created_at",
      "updated_at",
      "terminal_buffer"
    ]
  },
  {
    name: "chat_sessions",
    columns: ["id", "project_id", "worktree_id", "title", "created_at", "updated_at"]
  },
  {
    name: "chat_messages",
    columns: [
      "id",
      "chat_session_id",
      "role",
      "content",
      "attachments_json",
      "artifact_suggestions_json",
      "created_at",
      "tool_calls_json",
      "tool_results_json"
    ],
    orderBy: "rowid"
  }
];

type MysqlConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

async function main() {
  const sqlitePath = readSqlitePath();

  if (!sqlitePath) {
    throw new Error("缺少 SQLite 路径，使用: pnpm import:sqlite:mysql -- <sqlite-path>");
  }

  const config = readMysqlConfig();
  const sqlite = new sqlite3.DatabaseSync(sqlitePath, { open: true, readOnly: true });
  const bootstrap = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    charset: "utf8mb4"
  });

  try {
    await bootstrap.query(`CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(config.database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
  } finally {
    await bootstrap.end();
  }

  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    charset: "utf8mb4",
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true
  });

  try {
    await connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_general_ci");

    for (const statement of schemaStatements) {
      await connection.query(statement);
    }

    await connection.beginTransaction();
    await connection.query("SET FOREIGN_KEY_CHECKS=0");

    for (const table of [...TABLES].reverse()) {
      await connection.query(`TRUNCATE TABLE ${quoteIdentifier(table.name)}`);
    }

    const counts: Record<string, number> = {};

    for (const table of TABLES) {
      const selectSql = `SELECT ${table.columns.join(", ")} FROM ${table.name}${table.orderBy ? ` ORDER BY ${table.orderBy}` : ""}`;
      const rows = sqlite.prepare(selectSql).all() as Array<Record<string, unknown>>;
      counts[table.name] = rows.length;

      if (rows.length === 0) {
        continue;
      }

      const placeholders = `(${table.columns.map(() => "?").join(", ")})`;
      const sql = `INSERT INTO ${quoteIdentifier(table.name)} (${table.columns.map(quoteIdentifier).join(", ")}) VALUES ${rows
        .map(() => placeholders)
        .join(", ")}`;
      const params = rows.flatMap((row) => table.columns.map((column) => toMysqlValue(row[column])));
      await connection.query(sql, params);
    }

    await connection.query("SET FOREIGN_KEY_CHECKS=1");
    await connection.commit();
    process.stdout.write(`${JSON.stringify(counts, null, 2)}\n`);
  } catch (error) {
    await connection.rollback();
    try {
      await connection.query("SET FOREIGN_KEY_CHECKS=1");
    } catch {}
    throw error;
  } finally {
    sqlite.close();
    await connection.end();
  }
}

function readSqlitePath() {
  const cliArgs = process.argv.slice(2).filter((arg) => arg !== "--");
  return cliArgs[0] ?? process.env.SQLITE_PATH;
}

function readMysqlConfig(): MysqlConfig {
  const url = process.env.DATABASE_URL?.trim();

  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username || "root"),
      password: decodeURIComponent(parsed.password || ""),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, "") || "workhorse_station")
    };
  }

  return {
    host: process.env.MYSQL_HOST?.trim() || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER?.trim() || "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE?.trim() || "workhorse_station"
  };
}

function quoteIdentifier(value: string) {
  return `\`${value.replace(/`/g, "``")}\``;
}

function toMysqlValue(value: unknown) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value)) {
    return value.replace("T", " ").replace(/\.\d+Z$/, "").replace("Z", "");
  }

  return value ?? null;
}

void main();
