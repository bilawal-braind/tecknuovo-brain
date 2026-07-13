import pg from 'pg';

const { Pool } = pg;

// Single pool, least-privilege role (see db/api_role.sql). SSL is required by Azure Postgres.
export const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

// An idle client's backend connection dying (Azure failover, network blip) emits
// 'error' on the pool; without a listener Node treats it as fatal and exits the
// process, taking every dashboard down. Log it and let the pool replace the client.
pool.on('error', (err) => console.error('[pg] idle client error (recovered):', err.message));

export const q = (text: string, params: any[] = []) => pool.query(text, params);
