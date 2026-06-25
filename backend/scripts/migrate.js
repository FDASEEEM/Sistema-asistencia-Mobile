const { ensureMobileSchema } = require('../src/schema');
const db = require('../src/db');

ensureMobileSchema()
  .then(async () => {
    const [rows] = await db.query('SELECT current_schema() AS schema');
    console.log(`Schema movil listo: ${rows[0]?.schema || db.schemaName}`);
  })
  .catch((error) => {
    console.error('No se pudo preparar el schema movil:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.pool.end();
  });
