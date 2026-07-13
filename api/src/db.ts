import pg from 'pg';
import { readFileSync } from 'node:fs';

const { Pool } = pg;

// SSL is required by Azure Postgres. Certificate VERIFICATION is opt-in so it can't
// break a running deployment, but should be turned on at handover:
//   PGSSLROOTCERT=/path/to/DigiCertGlobalRootCA.crt.pem  -> verify against that CA, or
//   PGSSL_VERIFY=1                                        -> verify against the system store.
// Unset = encrypted but unverified (the pre-handover behaviour).
const ca = process.env.PGSSLROOTCERT ? readFileSync(process.env.PGSSLROOTCERT, 'utf8') : undefined;
const ssl = ca ? { ca } : { rejectUnauthorized: process.env.PGSSL_VERIFY === '1' };

// Single pool, least-privilege role (see db/api_role.sql).
export const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl,
  max: 10,
  idleTimeoutMillis: 30000,
});

// An idle client's backend connection dying (Azure failover, network blip) emits
// 'error' on the pool; without a listener Node treats it as fatal and exits the
// process, taking every dashboard down. Log it and let the pool replace the client.
pool.on('error', (err) => console.error('[pg] idle client error (recovered):', err.message));

export const q = (text: string, params: any[] = []) => pool.query(text, params);
