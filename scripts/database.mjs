import pg from 'pg';
import { openSqlite } from './sqlite.mjs';

let sqlite;
let pool;
let queue = Promise.resolve();

export function postgresConfigured() {
  return Boolean(process.env.PROJECTOS_DATABASE_URL);
}

function localHost(hostname) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}

export function getPostgresPool() {
  if (pool) return pool;
  const connectionString = process.env.PROJECTOS_DATABASE_URL;
  if (!connectionString) throw new Error('PostgreSQL connection is not configured');
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.search || url.hash) {
    throw new Error('Provide a PostgreSQL URL without connection overrides');
  }
  const ssl = localHost(url.hostname)
    ? false
    : { rejectUnauthorized: true, ca: process.env.PROJECTOS_PG_CA || undefined };
  pool = new pg.Pool({
    connectionString,
    ssl,
    max: 10,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
    idle_in_transaction_session_timeout: 10_000,
    allowExitOnIdle: true,
    types: {
      getTypeParser(oid, format) {
        if (oid === 20) return (value) => {
          const parsed = Number(value);
          if (!Number.isSafeInteger(parsed)) throw new Error('PostgreSQL integer exceeds safe range');
          return parsed;
        };
        if (oid === 1184) return value => new Date(value).toISOString();
        return pg.types.getTypeParser(oid, format);
      },
    },
  });
  pool.on('error', () => console.error('ProjectOS PostgreSQL idle connection closed unexpectedly'));
  return pool;
}

export function getDb() {
  if (postgresConfigured()) throw new Error('SQLite is unavailable while PostgreSQL is configured');
  if (process.env.NODE_ENV === 'production') {
    const origin = process.env.PROJECTOS_PUBLIC_ORIGIN;
    if (!origin || !localHost(new URL(origin).hostname)) {
      throw new Error('PostgreSQL is required outside localhost');
    }
  }
  sqlite ??= openSqlite();
  return sqlite;
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
  sqlite?.close();
  sqlite = undefined;
}

function sqliteExecutor(connection) {
  return {
    dialect: 'sqlite',
    async all(statement, ...params) { return connection.prepare(statement).all(...params); },
    async one(statement, ...params) { return connection.prepare(statement).get(...params); },
    async run(statement, ...params) { return Number(connection.prepare(statement).run(...params).changes); },
  };
}

function postgresExecutor(connection) {
  function execute(statement, params) {
    let parameter = 0;
    // Repository SQL is static and uses '?' only as a parameter marker.
    const text = statement.replace(/\?/g, () => '$' + (++parameter));
    if (parameter !== params.length) throw new Error('SQL parameter count mismatch');
    return connection.query(text, params);
  }
  return {
    dialect: 'postgres',
    async all(statement, ...params) { return (await execute(statement, params)).rows; },
    async one(statement, ...params) { return (await execute(statement, params)).rows[0]; },
    async run(statement, ...params) { return (await execute(statement, params)).rowCount ?? 0; },
  };
}

function sqliteExclusive(action) {
  const result = queue.then(() => action(getDb()));
  queue = result.catch(() => {});
  return result;
}

export const sql = {
  get dialect() { return postgresConfigured() ? 'postgres' : 'sqlite'; },
  all(statement, ...params) {
    if (postgresConfigured()) return postgresExecutor(getPostgresPool()).all(statement, ...params);
    return sqliteExclusive(db => sqliteExecutor(db).all(statement, ...params));
  },
  one(statement, ...params) {
    if (postgresConfigured()) return postgresExecutor(getPostgresPool()).one(statement, ...params);
    return sqliteExclusive(db => sqliteExecutor(db).one(statement, ...params));
  },
  run(statement, ...params) {
    if (postgresConfigured()) return postgresExecutor(getPostgresPool()).run(statement, ...params);
    return sqliteExclusive(db => sqliteExecutor(db).run(statement, ...params));
  },
};

async function inTransaction(action, readOnly) {
  if (!postgresConfigured()) {
    return sqliteExclusive(async db => {
      db.exec(readOnly ? 'BEGIN' : 'BEGIN IMMEDIATE');
      try {
        const value = await action(sqliteExecutor(db));
        db.exec('COMMIT');
        return value;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    });
  }
  const client = await getPostgresPool().connect();
  let discard = false;
  try {
    await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
    const db = postgresExecutor(client);
    let workspace;
    db.scopeWorkspace = async workspaceId => {
      if (!workspaceId || (workspace !== undefined && workspace !== workspaceId)) throw new Error('Invalid transaction workspace');
      workspace = workspaceId;
      await client.query("SELECT set_config('projectos.workspace', $1, true)", [workspaceId]);
    };
    const value = await action(db);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { discard = true; }
    throw error;
  } finally {
    client.release(discard);
  }
}

export function transaction(action) { return inTransaction(action, false); }
export function readTransaction(action) { return inTransaction(action, true); }

export function lockWorkspace(db, workspaceId) {
  const lock = db.dialect === 'postgres' ? ' FOR UPDATE' : '';
  return db.one('SELECT version,name FROM workspaces WHERE id=?' + lock, workspaceId);
}

export async function lockBootstrap(db) {
  if (db.dialect === 'postgres') await db.one('SELECT pg_advisory_xact_lock(3804522)');
}
