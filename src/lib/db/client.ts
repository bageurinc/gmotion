import fs from 'fs';
import path from 'path';

export type DbValue = string | number | null;

export interface Db {
  all<T>(sql: string, params?: DbValue[]): Promise<T[]>;
  first<T>(sql: string, params?: DbValue[]): Promise<T | null>;
  /** Returns the number of rows the statement changed. */
  run(sql: string, params?: DbValue[]): Promise<number>;
}

interface D1QueryResult {
  results?: unknown[];
  meta?: { changes?: number };
}

interface D1Response {
  success: boolean;
  errors?: Array<{ message?: string }>;
  result?: D1QueryResult[];
}

/** Talks to Cloudflare D1 over its REST API, so it works from any host. */
export function createD1HttpDb(
  config: { accountId: string; databaseId: string; apiToken: string },
  fetcher: typeof fetch = fetch
): Db {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`;

  const query = async (sql: string, params: DbValue[]): Promise<D1QueryResult> => {
    const res = await fetcher(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    });
    const body = (await res.json().catch(() => null)) as D1Response | null;
    const result = body?.result?.[0];
    if (!res.ok || !body?.success || !result) {
      throw new Error(`D1 query failed (${res.status}): ${body?.errors?.[0]?.message ?? 'unknown error'}`);
    }
    return result;
  };

  return {
    all: async <T>(sql: string, params: DbValue[] = []) => ((await query(sql, params)).results ?? []) as T[],
    first: async <T>(sql: string, params: DbValue[] = []) => (((await query(sql, params)).results ?? [])[0] ?? null) as T | null,
    run: async (sql, params = []) => (await query(sql, params)).meta?.changes ?? 0,
  };
}

/**
 * Local SQLite for development and tests. D1 is SQLite too, so both run the same
 * SQL and migrations. getBuiltinModule keeps node:sqlite out of bundler analysis.
 */
export function createLocalDb(file: string, migrationsDir = path.join(process.cwd(), 'migrations')): Db {
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec('CREATE TABLE IF NOT EXISTS d1_migrations (name TEXT PRIMARY KEY)');

  const applied = new Set(
    (sqlite.prepare('SELECT name FROM d1_migrations').all() as unknown as Array<{ name: string }>).map((row) => row.name)
  );
  for (const name of fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort()) {
    if (applied.has(name)) continue;
    sqlite.exec(fs.readFileSync(path.join(migrationsDir, name), 'utf-8'));
    sqlite.prepare('INSERT INTO d1_migrations (name) VALUES (?)').run(name);
  }

  return {
    all: async <T>(sql: string, params: DbValue[] = []) => sqlite.prepare(sql).all(...params) as unknown as T[],
    first: async <T>(sql: string, params: DbValue[] = []) => (sqlite.prepare(sql).get(...params) ?? null) as T | null,
    run: async (sql, params = []) => Number(sqlite.prepare(sql).run(...params).changes),
  };
}

let instance: Db | undefined;

export function getDb(): Db {
  if (instance) return instance;

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (accountId && databaseId && apiToken) {
    instance = createD1HttpDb({ accountId, databaseId, apiToken });
    return instance;
  }
  if (process.env.NODE_ENV === 'production') {
    // A silent fallback here would split users and balances across two databases.
    throw new Error('D1 is not configured: set CLOUDFLARE_ACCOUNT_ID, D1_DATABASE_ID, and CLOUDFLARE_API_TOKEN.');
  }

  const dir = path.join(process.cwd(), 'storage');
  fs.mkdirSync(dir, { recursive: true });
  instance = createLocalDb(path.join(dir, 'gmotion.db'));
  return instance;
}

export function setDbForTests(db: Db | undefined): void {
  instance = db;
}
