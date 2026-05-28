import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

export type DatabaseExecutor = Pool | PoolConnection;
export type SqlValue = string | number | boolean | null;
export type SqlParams = SqlValue[];

export async function queryRows<T>(db: DatabaseExecutor, sql: string, params: SqlParams = []): Promise<T[]> {
  const [rows] = await db.query<RowDataPacket[]>(sql, params);
  return rows as T[];
}

export async function queryOne<T>(db: DatabaseExecutor, sql: string, params: SqlParams = []): Promise<T | null> {
  const rows = await queryRows<T>(db, sql, params);
  return rows[0] ?? null;
}

export async function queryCount(db: DatabaseExecutor, sql: string, params: SqlParams = []): Promise<number> {
  const row = await queryOne<{ count: number | string }>(db, sql, params);
  return row ? Number(row.count ?? 0) : 0;
}

export async function execute(db: DatabaseExecutor, sql: string, params: SqlParams = []): Promise<number> {
  const [result] = await db.execute<ResultSetHeader>(sql, params);
  return result.affectedRows;
}
