import mysql, { type Pool } from "mysql2/promise";
import { schemaStatements } from "./schema.js";

export type DatabaseState = {
  db: Pool;
  connected: boolean;
  fts5: boolean;
  engine: "mysql";
  host: string;
  database: string;
  persist: () => Promise<void>;
  close: () => Promise<void>;
};

type DatabaseConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

export async function initDatabase(): Promise<DatabaseState> {
  const config = readDatabaseConfig();
  await ensureDatabaseExists(config);

  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4",
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true
  });

  await ensureSchema(pool);

  return {
    db: pool,
    connected: true,
    fts5: false,
    engine: "mysql",
    host: config.host,
    database: config.database,
    persist: async () => {},
    close: async () => {
      await pool.end();
    }
  };
}

function readDatabaseConfig(): DatabaseConfig {
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

async function ensureDatabaseExists(config: DatabaseConfig) {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    charset: "utf8mb4"
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(config.database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
    );
  } finally {
    await connection.end();
  }
}

async function ensureSchema(pool: Pool) {
  for (const statement of schemaStatements) {
    await pool.query(statement);
  }
}

function quoteIdentifier(value: string) {
  return `\`${value.replace(/`/g, "``")}\``;
}
