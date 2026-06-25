const db = require('./db');

async function ensureMobileSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      email VARCHAR(160) UNIQUE NOT NULL,
      password_hash TEXT,
      rol VARCHAR(30) NOT NULL DEFAULT 'inspector',
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS cursos (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(80) NOT NULL UNIQUE,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS estudiantes (
      id SERIAL PRIMARY KEY,
      rut VARCHAR(20) UNIQUE,
      nombre VARCHAR(100) NOT NULL,
      apellido VARCHAR(100) NOT NULL,
      sexo VARCHAR(10),
      curso_id INT NOT NULL REFERENCES cursos(id) ON DELETE RESTRICT,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      foto_url TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS asistencia (
      id SERIAL PRIMARY KEY,
      estudiante_id INT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      fecha DATE NOT NULL,
      hora_ingreso TIME,
      es_atraso BOOLEAN NOT NULL DEFAULT FALSE,
      justificado BOOLEAN NOT NULL DEFAULT FALSE,
      justificacion_descripcion TEXT,
      minutos_retraso INT NOT NULL DEFAULT 0,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS salidas_anticipadas (
      id SERIAL PRIMARY KEY,
      estudiante_id INT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      fecha DATE NOT NULL,
      hora_salida TIME NOT NULL,
      motivo VARCHAR(255) NOT NULL,
      es_medico BOOLEAN NOT NULL DEFAULT FALSE,
      autorizado_por INT REFERENCES usuarios(id) ON DELETE SET NULL,
      observaciones TEXT,
      autorizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (estudiante_id, fecha)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS anuncios (
      id SERIAL PRIMARY KEY,
      titulo VARCHAR(200) NOT NULL,
      mensaje TEXT NOT NULL,
      tipo VARCHAR(30) NOT NULL DEFAULT 'general',
      activo_desde DATE NOT NULL DEFAULT CURRENT_DATE,
      activo_hasta DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS apoderados (
      id SERIAL PRIMARY KEY,
      rut VARCHAR(20) UNIQUE,
      nombre VARCHAR(100) NOT NULL,
      apellido VARCHAR(100) NOT NULL,
      email VARCHAR(160) UNIQUE NOT NULL,
      telefono VARCHAR(30),
      password_hash TEXT NOT NULL,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS estudiante_apoderado (
      estudiante_id INT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      apoderado_id INT NOT NULL REFERENCES apoderados(id) ON DELETE CASCADE,
      parentesco VARCHAR(50),
      principal BOOLEAN NOT NULL DEFAULT TRUE,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (estudiante_id, apoderado_id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS apoderado_refresh_tokens (
      id SERIAL PRIMARY KEY,
      apoderado_id INT NOT NULL REFERENCES apoderados(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      revocado BOOLEAN NOT NULL DEFAULT FALSE,
      expira_en TIMESTAMPTZ NOT NULL,
      ip TEXT,
      user_agent TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS apoderado_push_tokens (
      id SERIAL PRIMARY KEY,
      apoderado_id INT NOT NULL REFERENCES apoderados(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      plataforma VARCHAR(30) NOT NULL DEFAULT 'android',
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (apoderado_id, token)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS tabla_asistencia_registros (
      id SERIAL PRIMARY KEY,
      estudiante_id INT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      curso_id INT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
      fecha DATE NOT NULL,
      estado VARCHAR(20) NOT NULL CHECK (estado IN ('presente', 'ausente', 'justificado')),
      observacion TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (estudiante_id, curso_id, fecha)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS solicitudes_justificacion (
      id SERIAL PRIMARY KEY,
      asistencia_id INT NOT NULL REFERENCES asistencia(id) ON DELETE CASCADE,
      estudiante_id INT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      apoderado_id INT NOT NULL REFERENCES apoderados(id) ON DELETE CASCADE,
      motivo TEXT NOT NULL,
      evidencia_url TEXT,
      estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      comentario_revision TEXT,
      revisado_por INT REFERENCES usuarios(id) ON DELETE SET NULL,
      revisado_en TIMESTAMPTZ,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS solicitudes_salida (
      id SERIAL PRIMARY KEY,
      estudiante_id INT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      apoderado_id INT NOT NULL REFERENCES apoderados(id) ON DELETE CASCADE,
      fecha DATE NOT NULL,
      hora_salida TIME NOT NULL,
      motivo VARCHAR(255) NOT NULL,
      es_medico BOOLEAN NOT NULL DEFAULT FALSE,
      estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      comentario_revision TEXT,
      revisado_por INT REFERENCES usuarios(id) ON DELETE SET NULL,
      revisado_en TIMESTAMPTZ,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS notificaciones_apoderado (
      id SERIAL PRIMARY KEY,
      apoderado_id INT NOT NULL REFERENCES apoderados(id) ON DELETE CASCADE,
      estudiante_id INT REFERENCES estudiantes(id) ON DELETE CASCADE,
      titulo VARCHAR(200) NOT NULL,
      mensaje TEXT NOT NULL,
      tipo VARCHAR(30) NOT NULL,
      leida BOOLEAN NOT NULL DEFAULT FALSE,
      data JSONB,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`ALTER TABLE asistencia ADD COLUMN IF NOT EXISTS justificacion_descripcion TEXT`);
  await db.query(`ALTER TABLE asistencia ADD COLUMN IF NOT EXISTS minutos_retraso INT NOT NULL DEFAULT 0`);
  await db.query(`ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS foto_url TEXT`);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_mobile_estudiante_apoderado_apoderado ON estudiante_apoderado (apoderado_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_mobile_asistencia_estudiante_fecha ON asistencia (estudiante_id, fecha, es_atraso)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_mobile_tabla_asistencia_estudiante_fecha ON tabla_asistencia_registros (estudiante_id, fecha)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_mobile_salidas_estudiante_fecha ON salidas_anticipadas (estudiante_id, fecha)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_mobile_notif_apoderado_fecha ON notificaciones_apoderado (apoderado_id, leida, creado_en DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_mobile_anuncios_fechas ON anuncios (activo_desde, activo_hasta, created_at DESC)`);
}

module.exports = { ensureMobileSchema };
