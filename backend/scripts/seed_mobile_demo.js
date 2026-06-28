const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const pool = require('../src/db');
const { ensureMobileSchema } = require('../src/schema');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const DEMO_PASSWORD = 'apoderado123';
const DEMO_TEACHER_PASSWORD = 'profesor123';
const DEFAULT_GUARDIAN = {
  1: {
    rut: '11111111-1',
    nombre: 'Marcela',
    apellido: 'Gonzalez',
    email: 'apoderado1@colegio.cl',
    telefono: '+56911111111',
  },
  2: {
    rut: '22222222-2',
    nombre: 'Cristian',
    apellido: 'Rojas',
    email: 'apoderado2@colegio.cl',
    telefono: '+56922222222',
  },
};

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function toTime(hour, minute = 0) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

function currentMonthRange() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return { from, to, today };
}

async function ensureSchemaTables() {
  await ensureMobileSchema();

  await pool.query(`ALTER TABLE asistencia ADD COLUMN IF NOT EXISTS justificacion_descripcion TEXT`);
  await pool.query(`ALTER TABLE asistencia ADD COLUMN IF NOT EXISTS minutos_retraso INT NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS foto_url TEXT`);

  await pool.query(`
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

  await pool.query(`
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

  await pool.query(`
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

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mobile_asistencia_estudiante_fecha
      ON asistencia (estudiante_id, fecha, es_atraso)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mobile_tabla_asistencia_estudiante_fecha
      ON tabla_asistencia_registros (estudiante_id, fecha)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mobile_salidas_estudiante_fecha
      ON salidas_anticipadas (estudiante_id, fecha)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mobile_notif_apoderado_fecha
      ON notificaciones_apoderado (apoderado_id, leida, creado_en DESC)
  `);
}

async function ensureGuards() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const id of [1, 2]) {
    const guardian = DEFAULT_GUARDIAN[id];
    await pool.query(
      `INSERT INTO apoderados (id, rut, nombre, apellido, email, telefono, password_hash, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
       ON CONFLICT (email)
       DO UPDATE SET
         rut = EXCLUDED.rut,
         nombre = EXCLUDED.nombre,
         apellido = EXCLUDED.apellido,
         telefono = EXCLUDED.telefono,
         password_hash = EXCLUDED.password_hash,
         activo = TRUE`,
      [id, guardian.rut, guardian.nombre, guardian.apellido, guardian.email, guardian.telefono, passwordHash],
    );
  }
}

async function ensureDemoTeacher() {
  const passwordHash = await bcrypt.hash(DEMO_TEACHER_PASSWORD, 10);
  const [rows] = await pool.query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
     VALUES (?, ?, ?, ?, TRUE)
     ON CONFLICT (email)
     DO UPDATE SET
       nombre = EXCLUDED.nombre,
       password_hash = EXCLUDED.password_hash,
       rol = 'profesor',
       activo = TRUE
     RETURNING id`,
    ['Paula Torres', 'profesora.jefe@colegio.cl', passwordHash, 'profesor'],
  );

  return rows[0].id;
}

async function ensureDemoStudents() {
  const [existing] = await pool.query(
    `SELECT estudiante_id
     FROM estudiante_apoderado
     WHERE apoderado_id IN (1, 2)
     LIMIT 1`,
  );

  if (existing.length > 0) {
    return;
  }

  const [courseRows] = await pool.query(
    `INSERT INTO cursos (nombre)
     VALUES (?)
     ON CONFLICT (nombre)
     DO UPDATE SET nombre = EXCLUDED.nombre
     RETURNING id`,
    ['4 Basico A'],
  );
  const cursoId = courseRows[0].id;

  const students = [
    { rut: '30111111-1', nombre: 'Sofia', apellido: 'Gonzalez', apoderado_id: 1 },
    { rut: '30222222-2', nombre: 'Mateo', apellido: 'Gonzalez', apoderado_id: 1 },
    { rut: '30333333-3', nombre: 'Agustin', apellido: 'Rojas', apoderado_id: 2 },
    { rut: '30444444-4', nombre: 'Isidora', apellido: 'Rojas', apoderado_id: 2 },
  ];

  for (const student of students) {
    const [rows] = await pool.query(
      `INSERT INTO estudiantes (rut, nombre, apellido, curso_id, activo)
       VALUES (?, ?, ?, ?, TRUE)
       ON CONFLICT (rut)
       DO UPDATE SET
         nombre = EXCLUDED.nombre,
         apellido = EXCLUDED.apellido,
         curso_id = EXCLUDED.curso_id,
         activo = TRUE
       RETURNING id`,
      [student.rut, student.nombre, student.apellido, cursoId],
    );

    await pool.query(
      `INSERT INTO estudiante_apoderado (estudiante_id, apoderado_id, parentesco, principal)
       VALUES (?, ?, ?, TRUE)
       ON CONFLICT (estudiante_id, apoderado_id)
       DO UPDATE SET parentesco = EXCLUDED.parentesco, principal = TRUE`,
      [rows[0].id, student.apoderado_id, 'apoderado'],
    );
  }
}

async function getLinkedStudents() {
  const [rows] = await pool.query(
    `SELECT ea.apoderado_id, e.id, e.nombre, e.apellido, e.curso_id, c.nombre AS curso_nombre
     FROM estudiante_apoderado ea
     JOIN estudiantes e ON e.id = ea.estudiante_id
     JOIN cursos c ON c.id = e.curso_id
     WHERE ea.apoderado_id IN (1, 2)
     ORDER BY ea.apoderado_id, e.apellido, e.nombre`,
  );
  return rows;
}

function buildAttendanceState(dayIndex, studentIndex) {
  const mod = (dayIndex + studentIndex) % 10;
  if (mod === 0) return { estado: 'ausente', es_atraso: false, justificado: false, hora: '08:00:00', min: 0 };
  if (mod === 1) return { estado: 'presente', es_atraso: false, justificado: false, hora: '07:58:00', min: 0 };
  if (mod === 2) return { estado: 'presente', es_atraso: false, justificado: false, hora: '08:03:00', min: 0 };
  if (mod === 3) return { estado: 'presente', es_atraso: true, justificado: false, hora: '08:17:00', min: 17 };
  if (mod === 4) return { estado: 'justificado', es_atraso: true, justificado: true, hora: '08:22:00', min: 22 };
  if (mod === 5) return { estado: 'presente', es_atraso: false, justificado: false, hora: '07:59:00', min: 0 };
  if (mod === 6) return { estado: 'ausente', es_atraso: false, justificado: false, hora: '08:00:00', min: 0 };
  if (mod === 7) return { estado: 'presente', es_atraso: true, justificado: false, hora: '08:11:00', min: 11 };
  if (mod === 8) return { estado: 'presente', es_atraso: false, justificado: false, hora: '08:01:00', min: 0 };
  return { estado: 'presente', es_atraso: false, justificado: false, hora: '07:57:00', min: 0 };
}

async function seedAttendance(students) {
  const { from, to, today } = currentMonthRange();
  const monthDays = [];
  for (let d = new Date(from); d < to && d <= today; d.setDate(d.getDate() + 1)) {
    const current = new Date(d);
    const weekday = current.getDay();
    if (weekday === 0 || weekday === 6) continue;
    monthDays.push(new Date(current));
  }

  for (const student of students) {
    await pool.query(
      'DELETE FROM tabla_asistencia_registros WHERE estudiante_id = ? AND fecha >= ?::date AND fecha < ?::date',
      [student.id, toIsoDate(from), toIsoDate(to)],
    );
    await pool.query(
      'DELETE FROM asistencia WHERE estudiante_id = ? AND fecha >= ?::date AND fecha < ?::date',
      [student.id, toIsoDate(from), toIsoDate(to)],
    );

    for (let i = 0; i < monthDays.length; i++) {
      const date = monthDays[i];
      const state = buildAttendanceState(i, student.id);
      await pool.query(
        `INSERT INTO tabla_asistencia_registros (estudiante_id, curso_id, fecha, estado, observacion)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (estudiante_id, curso_id, fecha)
         DO UPDATE SET estado = EXCLUDED.estado, observacion = EXCLUDED.observacion, actualizado_en = NOW()`,
        [
          student.id,
          student.curso_id,
          toIsoDate(date),
          state.estado,
          state.justificado ? 'Justificado en demo' : state.es_atraso ? 'Demo de atraso' : null,
        ],
      );

      await pool.query(
        `INSERT INTO asistencia (estudiante_id, fecha, hora_ingreso, es_atraso, justificado, justificacion_descripcion, minutos_retraso)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT DO NOTHING`,
        [
          student.id,
          toIsoDate(date),
          state.hora,
          state.es_atraso,
          state.justificado,
          state.justificado ? 'Justificado en demo' : state.es_atraso ? 'Llegó tarde en demo' : null,
          state.min,
        ],
      );
    }
  }
}

async function seedExits(students) {
  const { today } = currentMonthRange();
  const demoRows = [
    { student: students[0], offset: 3, hour: '12:35:00', motivo: 'Control medico', es_medico: true },
    { student: students[1], offset: 5, hour: '15:10:00', motivo: 'Tramite familiar', es_medico: false },
    { student: students[3], offset: 8, hour: '11:45:00', motivo: 'Visita al dentista', es_medico: true },
  ].filter((item) => item.student);

  await pool.query(
    'DELETE FROM salidas_anticipadas WHERE estudiante_id = ANY(?::int[]) AND fecha >= date_trunc(\'month\', CURRENT_DATE)::date',
    [demoRows.map((row) => row.student.id)],
  );

  for (const row of demoRows) {
    const date = new Date(today);
    date.setDate(Math.max(1, today.getDate() - row.offset));
    await pool.query(
      `INSERT INTO salidas_anticipadas (estudiante_id, fecha, hora_salida, motivo, es_medico, observaciones)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
      [
        row.student.id,
        toIsoDate(date),
        row.hour,
        row.motivo,
        row.es_medico,
        'Semilla de pruebas',
      ],
    );
  }
}

async function seedNotifications(students) {
  const rows = [
    {
      apoderado_id: 1,
      estudiante_id: students[0]?.id || null,
      titulo: 'Atraso registrado',
      mensaje: 'Se registró un ingreso tardío de ejemplo para validar la pantalla de notificaciones.',
      tipo: 'atraso',
      data: { demo: true },
    },
    {
      apoderado_id: 1,
      estudiante_id: students[1]?.id || null,
      titulo: 'Salida aprobada',
      mensaje: 'La solicitud de salida de prueba quedó aprobada para verificar el flujo completo.',
      tipo: 'solicitud-salida',
      data: { demo: true },
    },
    {
      apoderado_id: 2,
      estudiante_id: students[3]?.id || null,
      titulo: 'Justificación recibida',
      mensaje: 'Se cargó una justificación de demo con evidencia para revisar el render de la lista.',
      tipo: 'solicitud-justificacion',
      data: { demo: true },
    },
  ].filter((row) => row.apoderado_id && row.estudiante_id);

  await pool.query('DELETE FROM notificaciones_apoderado WHERE data @> ?::jsonb', [JSON.stringify({ demo: true })]);
  for (const row of rows) {
    await pool.query(
      `INSERT INTO notificaciones_apoderado (apoderado_id, estudiante_id, titulo, mensaje, tipo, leida, data)
       VALUES (?, ?, ?, ?, ?, FALSE, ?::jsonb)`,
      [row.apoderado_id, row.estudiante_id, row.titulo, row.mensaje, row.tipo, JSON.stringify(row.data)],
    );
  }
}

async function seedRequests(students) {
  const now = new Date();
  const day = now.getDate();
  const baseDate = toIsoDate(now);

  const justifications = [
    {
      student: students[0],
      asistenciaIdQuery: `SELECT id FROM asistencia WHERE estudiante_id = ? ORDER BY fecha DESC LIMIT 1`,
      apoderado_id: 1,
      motivo: 'Justificación de prueba para validar el flujo móvil.',
      estado: 'pendiente',
    },
    {
      student: students[3],
      asistenciaIdQuery: `SELECT id FROM asistencia WHERE estudiante_id = ? ORDER BY fecha DESC OFFSET 1 LIMIT 1`,
      apoderado_id: 2,
      motivo: 'Justificación aprobada para revisar el estado final en la app.',
      estado: 'aprobada',
      comentario_revision: 'Revisado en demo.',
    },
  ].filter((row) => row.student);

  await pool.query('DELETE FROM solicitudes_justificacion WHERE motivo ILIKE ?', ['%prueba%']).catch(() => {});

  for (const item of justifications) {
    const [attendance] = await pool.query(item.asistenciaIdQuery, [item.student.id]);
    const asistenciaId = attendance[0]?.id;
    if (!asistenciaId) continue;
    await pool.query(
      `INSERT INTO solicitudes_justificacion (asistencia_id, estudiante_id, apoderado_id, motivo, evidencia_url, estado, comentario_revision, revisado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
      [
        asistenciaId,
        item.student.id,
        item.apoderado_id,
        item.motivo,
        null,
        item.estado,
        item.comentario_revision || null,
        item.estado !== 'pendiente' ? new Date().toISOString() : null,
      ],
    );
  }

  const exits = [
    {
      student: students[1],
      apoderado_id: 1,
      fecha: baseDate,
      hora_salida: '13:20:00',
      motivo: 'Salida de prueba',
      estado: 'pendiente',
    },
    {
      student: students[4],
      apoderado_id: 2,
      fecha: baseDate,
      hora_salida: '11:50:00',
      motivo: 'Salida revisada de demo',
      estado: 'aprobada',
      comentario_revision: 'Aprobada para validación de interfaz.',
    },
  ].filter((row) => row.student);

  await pool.query('DELETE FROM solicitudes_salida WHERE motivo ILIKE ?', ['%prueba%']).catch(() => {});

  for (const item of exits) {
    await pool.query(
      `INSERT INTO solicitudes_salida (estudiante_id, apoderado_id, fecha, hora_salida, motivo, es_medico, estado, comentario_revision, revisado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
      [
        item.student.id,
        item.apoderado_id,
        item.fecha,
        item.hora_salida,
        item.motivo,
        false,
        item.estado,
        item.comentario_revision || null,
        item.estado !== 'pendiente' ? new Date().toISOString() : null,
      ],
    );
  }
}

function shiftDate(base, offsetDays) {
  const date = new Date(base);
  date.setDate(date.getDate() + offsetDays);
  return toIsoDate(date);
}

async function seedAcademicCalendar(students, teacherId, courseId) {
  if (!students.length || !courseId) {
    return;
  }

  await pool.query(
    `UPDATE cursos
     SET profesor_jefe_id = ?
     WHERE id = ?`,
    [teacherId, courseId],
  );

  const subjects = [
    { nombre: 'Lenguaje', descripcion: 'Comprension lectora y redaccion' },
    { nombre: 'Matematicas', descripcion: 'Numeros, operaciones y problemas' },
    { nombre: 'Ciencias', descripcion: 'Ciencias naturales y experimentales' },
  ];

  const subjectIds = {};
  for (const subject of subjects) {
    const [rows] = await pool.query(
      `INSERT INTO materias (curso_id, nombre, descripcion, activa)
       VALUES (?, ?, ?, TRUE)
       ON CONFLICT (curso_id, nombre)
       DO UPDATE SET descripcion = EXCLUDED.descripcion, activa = TRUE
       RETURNING id`,
      [courseId, subject.nombre, subject.descripcion],
    );
    subjectIds[subject.nombre] = rows[0].id;
  }

  const today = new Date();
  const feriados = [
    { fecha: shiftDate(today, -2), nombre: 'Feriado demo: Reunion escolar', descripcion: 'Feriado cargado para validar el calendario', alcance: 'colegio' },
    { fecha: shiftDate(today, 5), nombre: 'Feriado demo: Dia administrativo', descripcion: 'Ejemplo de feriado dentro del mes', alcance: 'nacional' },
  ];

  for (const holiday of feriados) {
    await pool.query(
      `INSERT INTO feriados (fecha, nombre, descripcion, alcance, activo)
       VALUES (?, ?, ?, ?, TRUE)
       ON CONFLICT (fecha)
       DO UPDATE SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, alcance = EXCLUDED.alcance, activo = TRUE`,
      [holiday.fecha, holiday.nombre, holiday.descripcion, holiday.alcance],
    );
  }

  await pool.query(
    `DELETE FROM pruebas
     WHERE titulo ILIKE ? OR descripcion ILIKE ?`,
    ['%demo%', '%demo%'],
  ).catch(() => {});

  const pruebas = [
    {
      fecha: shiftDate(today, 1),
      hora_inicio: '08:30:00',
      hora_fin: '09:15:00',
      titulo: 'Prueba de Lenguaje',
      descripcion: 'Comprension lectora y vocabulario',
      sala: 'Sala 3',
      tipo: 'prueba',
      materia_id: subjectIds['Lenguaje'],
    },
    {
      fecha: shiftDate(today, 4),
      hora_inicio: '10:00:00',
      hora_fin: '10:45:00',
      titulo: 'Control de Matematicas',
      descripcion: 'Operaciones basicas y problemas',
      sala: 'Sala 1',
      tipo: 'evaluacion',
      materia_id: subjectIds['Matematicas'],
    },
  ];

  for (const test of pruebas) {
    await pool.query(
      `INSERT INTO pruebas (materia_id, fecha, hora_inicio, hora_fin, titulo, descripcion, sala, tipo, creado_por, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [test.materia_id, test.fecha, test.hora_inicio, test.hora_fin, test.titulo, test.descripcion, test.sala, test.tipo, teacherId],
    );
  }

  await pool.query(
    `DELETE FROM anotaciones
     WHERE titulo ILIKE ? OR descripcion ILIKE ?`,
    ['%demo%', '%demo%'],
  ).catch(() => {});

  const annotations = [
    {
      estudiante: students[0],
      fecha: shiftDate(today, -1),
      tipo: 'positiva',
      gravedad: 'baja',
      titulo: 'Destacado en clase',
      descripcion: 'Participa con seguridad y completa sus actividades a tiempo.',
    },
    {
      estudiante: students[1] || students[0],
      fecha: shiftDate(today, 2),
      tipo: 'observacion',
      gravedad: 'media',
      titulo: 'Uso de uniforme incompleto',
      descripcion: 'Se registra observacion menor para seguimiento del apoderado.',
    },
  ].filter((item) => item.estudiante);

  for (const note of annotations) {
    await pool.query(
      `INSERT INTO anotaciones (estudiante_id, curso_id, fecha, tipo, gravedad, titulo, descripcion, visible_apoderado, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?)` ,
      [note.estudiante.id, courseId, note.fecha, note.tipo, note.gravedad, note.titulo, note.descripcion, teacherId],
    );
  }
}

async function main() {
  await ensureSchemaTables();
  await ensureGuards();
  const teacherId = await ensureDemoTeacher();
  await ensureDemoStudents();

  const [students] = await pool.query(
    `SELECT e.id, e.nombre, e.apellido, e.curso_id
     FROM estudiante_apoderado ea
     JOIN estudiantes e ON e.id = ea.estudiante_id
     WHERE ea.apoderado_id IN (1, 2)
     ORDER BY ea.apoderado_id, e.apellido, e.nombre`,
  );

  if (students.length === 0) {
    throw new Error('No hay estudiantes vinculados a apoderados en el schema de pruebas.');
  }

  const courseId = students[0]?.curso_id || null;
  if (courseId) {
    await seedAcademicCalendar(students, teacherId, courseId);
  }

  await seedAttendance(students);
  await seedExits(students);
  await seedNotifications(students);
  await seedRequests(students);

  console.log('\nSeed de pruebas listo.');
  console.log(`- Apoderado 1: ${DEFAULT_GUARDIAN[1].email} / ${DEMO_PASSWORD}`);
  console.log(`- Apoderado 2: ${DEFAULT_GUARDIAN[2].email} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('No se pudo crear el seed de pruebas:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.pool.end();
  });
