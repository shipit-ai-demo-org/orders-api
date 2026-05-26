import { Pool, PoolClient } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX ?? 10),
      connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 5000),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30000),
      statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS ?? 10000),
    });

    pool.on("error", (err) => {
      // A backend crash on an idle client should not take the process down.
      console.error("pg pool idle client error", err);
    });
  }
  return pool;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
