const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const schemaName = process.env.APODERADOS_PG_SCHEMA || 'test_pruebas';
const schemaOption = `-c search_path=${schemaName},public`;

const poolOptions = {
  ssl: process.env.PG_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 300000,
  connectionTimeoutMillis: 8000,
  allowExitOnIdle: false,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  statement_timeout: 30000,
};

const pool = process.env.PG_URI
  ? new Pool({
      connectionString: process.env.PG_URI.split('?')[0],
      options: schemaOption,
      ...poolOptions,
    })
  : new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      options: schemaOption,
      ...poolOptions,
    });

pool.on('error', (err) => {
  console.error('[mobile-db] Error en pool de conexiones:', err.message);
});

module.exports = {
  query: async (text, params) => {
    let index = 1;
    const formattedText = text.replace(/\?/g, () => `$${index++}`);
    const start = Date.now();
    const res = await pool.query(formattedText, params);
    const elapsed = Date.now() - start;
    const statement = text.replace(/\s+/g, ' ').trim().slice(0, 120);
    const level = elapsed > 500 ? 'warn' : 'info';
    console[level](`[mobile-db:${schemaName}] ${elapsed}ms: ${statement}`);

    const rows = res.rows;
    rows.affectedRows = res.rowCount;
    rows.insertId = rows.length > 0 ? rows[0].id : null;
    return [rows, res.fields];
  },
  pool,
  schemaName,
};
