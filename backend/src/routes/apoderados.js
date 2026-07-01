const express = require('express');
const multer = require('multer');
const path = require('path');
const NodeCache = require('node-cache');
const pool = require('../db');
const { apoderadoAuth } = require('../middleware/apoderadoAuth');
const { requireOwnedStudent, buildAbsoluteUploadUrl, getApoderadoByStudentId, apoderadosCache } = require('../utils/apoderados');
const { enviarPushApoderado } = require('../utils/pushNotifications');
const {
    validarSalidaAnticipada,
    normalizarDatos,
    esHoraSalidaValida,
} = require('../utils/earlyExit');

const router = express.Router();
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

function buildCoursePayload(student) {
    if (!student?.curso_id) {
        return null;
    }

    return {
        id: student.curso_id,
        nombre: student.curso_nombre,
        profesor_jefe: student.profesor_jefe_id ? {
            id: student.profesor_jefe_id,
            nombre: student.profesor_jefe_nombre,
            apellido: student.profesor_jefe_apellido,
            email: student.profesor_jefe_email,
            telefono: student.profesor_jefe_telefono,
        } : null,
    };
}

const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(file.mimetype) || ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'));
        }
    },
});

router.use(apoderadoAuth);

function getMonthRange(month) {
    const base = /^\d{4}-\d{2}$/.test(month || '') ? `${month}-01` : new Date().toISOString().slice(0, 7) + '-01';
    const start = new Date(`${base}T00:00:00`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    const toYmd = (date) => date.toISOString().slice(0, 10);
    return {
        month: toYmd(start).slice(0, 7),
        from: toYmd(start),
        to: toYmd(end),
    };
}

async function getBestSummaryMonthRange(estudianteId) {
    const current = getMonthRange();
    const [currentRows] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM (
           SELECT fecha FROM tabla_asistencia_registros WHERE estudiante_id = ?
           UNION ALL
           SELECT fecha FROM asistencia WHERE estudiante_id = ?
           UNION ALL
           SELECT fecha FROM salidas_anticipadas WHERE estudiante_id = ?
         ) registros
         WHERE fecha >= ?::date AND fecha < ?::date`,
        [estudianteId, estudianteId, estudianteId, current.from, current.to],
    );

    if (Number(currentRows[0]?.total || 0) > 0) {
        return current;
    }

    const [latestRows] = await pool.query(
        `SELECT TO_CHAR(MAX(fecha), 'YYYY-MM-DD') AS fecha
         FROM (
           SELECT fecha FROM tabla_asistencia_registros WHERE estudiante_id = ?
           UNION ALL
           SELECT fecha FROM asistencia WHERE estudiante_id = ?
           UNION ALL
           SELECT fecha FROM salidas_anticipadas WHERE estudiante_id = ?
         ) registros`,
        [estudianteId, estudianteId, estudianteId],
    );

    const latestDate = latestRows[0]?.fecha;
    return latestDate ? getMonthRange(latestDate.slice(0, 7)) : current;
}

function mapAttendanceDay(baseState, attendanceRow, retiroRow) {
    const estadoBase = baseState || (attendanceRow ? 'presente' : 'sin estado');
    const tieneSalida = Boolean(retiroRow);

    return {
        fecha: attendanceRow?.fecha || retiroRow?.fecha || null,
        estado: estadoBase,
        estados: [estadoBase],
        hora_ingreso: attendanceRow?.hora_ingreso || null,
        minutos_retraso: attendanceRow?.minutos_retraso || 0,
        justificado: Boolean(attendanceRow?.justificado),
        hora_salida: retiroRow?.hora_salida || null,
        motivo_salida: retiroRow?.motivo || null,
        tiene_salida: tieneSalida,
    };
}

router.get('/estudiantes', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT e.id, e.nombre, e.apellido, e.rut, e.foto_url, e.curso_id,
                    c.nombre AS curso_nombre
              FROM estudiante_apoderado ea
              JOIN estudiantes e ON e.id = ea.estudiante_id
              JOIN cursos c ON c.id = e.curso_id
              WHERE ea.apoderado_id = ? AND e.activo = TRUE
              ORDER BY c.nombre ASC, e.apellido ASC`,
            [req.apoderado.id],
        );

        res.json(rows.map((student) => ({
            ...student,
            foto_url: buildAbsoluteUploadUrl(req, student.foto_url),
            curso: buildCoursePayload(student),
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/estudiantes/:id/resumen', requireOwnedStudent, async (req, res) => {
    const estudianteId = req.estudiante.id;
    const cacheKey = `resumen_${req.apoderado.id}_${estudianteId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        return res.json(cached);
    }

    try {
        const monthRange = await getBestSummaryMonthRange(estudianteId);
        const from = monthRange.from;
        const to = monthRange.to;
        const previousMonth = new Date(`${from}T00:00:00`);
        previousMonth.setMonth(previousMonth.getMonth() - 1);
        const previousFrom = previousMonth.toISOString().slice(0, 10);
        const previousTo = from;

        const results = await Promise.all([
            pool.query(
                `WITH tabla AS (
                    SELECT LOWER(TRIM(estado)) AS estado
                    FROM tabla_asistencia_registros
                    WHERE estudiante_id = ? AND fecha >= ?::date AND fecha < ?::date
                 ), ingresos AS (
                    SELECT 'presente' AS estado
                    FROM asistencia
                    WHERE estudiante_id = ? AND fecha >= ?::date AND fecha < ?::date
                 ), base AS (
                    SELECT * FROM tabla
                    UNION ALL
                    SELECT * FROM ingresos WHERE NOT EXISTS (SELECT 1 FROM tabla)
                 )
                 SELECT COUNT(*) FILTER (WHERE estado IN ('presente', 'justificado')) AS presentes,
                        COUNT(*) FILTER (WHERE estado = 'ausente') AS ausentes,
                        COUNT(*) AS total
                 FROM base`,
                [estudianteId, from, to, estudianteId, from, to],
            ),
            pool.query(
                `WITH tabla AS (
                    SELECT LOWER(TRIM(estado)) AS estado
                    FROM tabla_asistencia_registros
                    WHERE estudiante_id = ? AND fecha >= ?::date AND fecha < ?::date
                 ), ingresos AS (
                    SELECT 'presente' AS estado
                    FROM asistencia
                    WHERE estudiante_id = ? AND fecha >= ?::date AND fecha < ?::date
                 ), base AS (
                    SELECT * FROM tabla
                    UNION ALL
                    SELECT * FROM ingresos WHERE NOT EXISTS (SELECT 1 FROM tabla)
                 )
                 SELECT COUNT(*) FILTER (WHERE estado IN ('presente', 'justificado')) AS presentes,
                        COUNT(*) AS total
                 FROM base`,
                [estudianteId, previousFrom, previousTo, estudianteId, previousFrom, previousTo],
            ),
            pool.query(
                `SELECT COUNT(*) AS atrasos_mes,
                        COALESCE(AVG(minutos_retraso), 0)::numeric(10,2) AS promedio_minutos_retraso
                 FROM asistencia
                 WHERE estudiante_id = ? AND es_atraso = TRUE
                   AND fecha >= ?::date AND fecha < ?::date`,
                [estudianteId, from, to],
            ),
            pool.query(
                `SELECT COUNT(*) AS salidas_mes
                 FROM salidas_anticipadas
                 WHERE estudiante_id = ?
                   AND fecha >= ?::date AND fecha < ?::date`,
                [estudianteId, from, to],
            ),
            pool.query(
                `SELECT *
                 FROM (
                    SELECT a.fecha, 'atraso' AS tipo, CONCAT('Ingreso ', a.hora_ingreso) AS detalle
                    FROM asistencia a
                    WHERE a.estudiante_id = ? AND a.es_atraso = TRUE
                    UNION ALL
                    SELECT s.fecha, 'salida' AS tipo, s.motivo AS detalle
                    FROM salidas_anticipadas s
                    WHERE s.estudiante_id = ?
                 ) eventos
                 ORDER BY fecha DESC
                 LIMIT 6`,
                [estudianteId, estudianteId],
            ),
        ]);

        const attendanceRows = results[0][0];
        const previousAttendanceRows = results[1][0];
        const lateRows = results[2][0];
        const exitRows = results[3][0];
        const latestEvents = results[4];

        const attendanceRowsData = attendanceRows[0];
        const previousAttendanceData = previousAttendanceRows[0];
        const lateRowsData = lateRows[0];
        const exitRowsData = exitRows[0];
        const latestEventsData = latestEvents[0];
        const presentes = Number(attendanceRowsData?.presentes || 0);
        const ausentes = Number(attendanceRowsData?.ausentes || 0);
        const total = Number(attendanceRowsData?.total || 0);
        const porcentaje = total > 0 ? Number(((presentes / total) * 100).toFixed(1)) : 0;
        const previousPresentes = Number(previousAttendanceData?.presentes || 0);
        const previousTotal = Number(previousAttendanceData?.total || 0);
        const previousPorcentaje = previousTotal > 0 ? Number(((previousPresentes / previousTotal) * 100).toFixed(1)) : 0;
        const deltaAsistencia = Number((porcentaje - previousPorcentaje).toFixed(1));

        let estadoResumen = 'atencion';
        if (porcentaje >= 95) {
            estadoResumen = 'excelente';
        } else if (porcentaje >= 85) {
            estadoResumen = 'estable';
        }

        const result = {
            estudiante: {
                ...req.estudiante,
                foto_url: buildAbsoluteUploadUrl(req, req.estudiante.foto_url),
                curso: buildCoursePayload(req.estudiante),
            },
            porcentaje_asistencia: porcentaje,
            porcentaje_asistencia_anterior: previousPorcentaje,
            mes_resumen: monthRange.month,
            delta_asistencia: deltaAsistencia,
            estado_resumen: estadoResumen,
            total_presencias_mes: presentes,
            total_ausencias_mes: ausentes,
            total_registros_asistencia: total,
            total_atrasos_mes: Number(lateRowsData?.atrasos_mes || 0),
            promedio_minutos_retraso: Number(lateRowsData?.promedio_minutos_retraso || 0),
            total_salidas_mes: Number(exitRowsData?.salidas_mes || 0),
            eventos_recientes: latestEventsData,
        };
        cache.set(cacheKey, result);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/estudiantes/:id/asistencia-mensual', requireOwnedStudent, async (req, res) => {
    const { from, to, month } = getMonthRange(req.query.mes);
    const cacheKey = `mes_${req.apoderado.id}_${req.estudiante.id}_${month}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        return res.json(cached);
    }

    try {
        const [attendanceTable] = await pool.query(
            `SELECT TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha, LOWER(TRIM(estado)) AS estado
             FROM tabla_asistencia_registros
             WHERE estudiante_id = ? AND fecha >= ?::date AND fecha < ?::date`,
            [req.estudiante.id, from, to],
        );
        const [arrivalRows] = await pool.query(
            `SELECT TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha, hora_ingreso, es_atraso, justificado, minutos_retraso
             FROM asistencia
             WHERE estudiante_id = ? AND fecha >= ?::date AND fecha < ?::date`,
            [req.estudiante.id, from, to],
        );
        const [exitRows] = await pool.query(
            `SELECT TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha, hora_salida, motivo
             FROM salidas_anticipadas
             WHERE estudiante_id = ? AND fecha >= ?::date AND fecha < ?::date`,
            [req.estudiante.id, from, to],
        );

        const attendanceMap = new Map(attendanceTable.map((row) => [row.fecha, row.estado]));
        const arrivalMap = new Map(arrivalRows.map((row) => [row.fecha, row]));
        const exitMap = new Map(exitRows.map((row) => [row.fecha, row]));
        const dates = [...new Set([...attendanceMap.keys(), ...arrivalMap.keys(), ...exitMap.keys()])].sort();

        const result = {
            estudiante: {
                ...req.estudiante,
                foto_url: buildAbsoluteUploadUrl(req, req.estudiante.foto_url),
                curso: buildCoursePayload(req.estudiante),
            },
            mes: month,
            dias: dates.map((date) => ({
                ...mapAttendanceDay(attendanceMap.get(date), arrivalMap.get(date), exitMap.get(date)),
                fecha: date,
            })),
        };
        cache.set(cacheKey, result);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/estudiantes/:id/calendario-mensual', requireOwnedStudent, async (req, res) => {
    const { from, to, month } = getMonthRange(req.query.mes);
    const cacheKey = `calendario_${req.apoderado.id}_${req.estudiante.id}_${month}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        return res.json(cached);
    }

    try {
        const [attendanceTable, arrivalRows, exitRows, holidayRows, testRows, annotationRows] = await Promise.all([
            pool.query(
                `SELECT TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha, LOWER(TRIM(estado)) AS estado
                 FROM tabla_asistencia_registros
                 WHERE estudiante_id = ? AND fecha >= ?::date AND fecha < ?::date`,
                [req.estudiante.id, from, to],
            ),
            pool.query(
                `SELECT TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha, hora_ingreso, es_atraso, justificado, minutos_retraso
                 FROM asistencia
                 WHERE estudiante_id = ? AND fecha >= ?::date AND fecha < ?::date`,
                [req.estudiante.id, from, to],
            ),
            pool.query(
                `SELECT TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha, hora_salida, motivo
                 FROM salidas_anticipadas
                 WHERE estudiante_id = ? AND fecha >= ?::date AND fecha < ?::date`,
                [req.estudiante.id, from, to],
            ),
            pool.query(
                `SELECT TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha, nombre, descripcion, alcance
                 FROM feriados
                 WHERE activo = TRUE AND fecha >= ?::date AND fecha < ?::date
                 ORDER BY fecha ASC`,
                [from, to],
            ),
            pool.query(
                `SELECT TO_CHAR(p.fecha, 'YYYY-MM-DD') AS fecha,
                        p.id,
                        p.titulo,
                        p.descripcion,
                        p.hora_inicio,
                        p.hora_fin,
                        p.sala,
                        p.tipo,
                        m.id AS materia_id,
                        m.nombre AS materia_nombre
                 FROM pruebas p
                 JOIN materias m ON m.id = p.materia_id
                 WHERE p.activo = TRUE
                   AND m.activa = TRUE
                   AND m.curso_id = ?
                   AND p.fecha >= ?::date AND p.fecha < ?::date
                 ORDER BY p.fecha ASC, p.hora_inicio ASC NULLS LAST, p.titulo ASC`,
                [req.estudiante.curso_id, from, to],
            ),
            pool.query(
                `SELECT TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha,
                        id,
                        tipo,
                        gravedad,
                        titulo,
                        descripcion
                 FROM anotaciones
                 WHERE estudiante_id = ?
                   AND visible_apoderado = TRUE
                   AND fecha >= ?::date AND fecha < ?::date
                 ORDER BY fecha DESC, creado_en DESC`,
                [req.estudiante.id, from, to],
            ),
        ]);

        const attendanceRows = attendanceTable[0];
        const arrivalMap = new Map(arrivalRows[0].map((row) => [row.fecha, row]));
        const exitMap = new Map(exitRows[0].map((row) => [row.fecha, row]));
        const holidays = holidayRows[0];
        const tests = testRows[0];
        const annotations = annotationRows[0];

        const attendanceMap = new Map(attendanceRows.map((row) => [row.fecha, row.estado]));

        const eventsByDate = new Map();
        function pushEvent(fecha, event) {
            if (!eventsByDate.has(fecha)) {
                eventsByDate.set(fecha, []);
            }
            eventsByDate.get(fecha).push(event);
        }

        for (const [fecha, state] of attendanceMap.entries()) {
            const arrival = arrivalMap.get(fecha);
            const exit = exitMap.get(fecha);
            pushEvent(fecha, {
                tipo: 'asistencia',
                subtipo: state,
                titulo: state === 'ausente' ? 'Ausencia' : state === 'justificado' ? 'Justificado' : 'Asistencia',
                descripcion: arrival?.hora_ingreso ? `Ingreso ${arrival.hora_ingreso}` : 'Registro diario',
                color: state === 'ausente' ? '#ef4444' : state === 'justificado' ? '#60a5fa' : '#12b886',
                detalle: {
                    hora_ingreso: arrival?.hora_ingreso || null,
                    minutos_retraso: arrival?.minutos_retraso || 0,
                    justificado: Boolean(arrival?.justificado),
                    hora_salida: exit?.hora_salida || null,
                },
            });
        }

        for (const item of holidays) {
            pushEvent(item.fecha, {
                tipo: 'feriado',
                subtipo: item.alcance,
                titulo: item.nombre,
                descripcion: item.descripcion || 'Feriado escolar',
                color: '#f59e0b',
            });
        }

        for (const item of tests) {
            pushEvent(item.fecha, {
                tipo: 'prueba',
                subtipo: item.materia_nombre,
                titulo: item.titulo,
                descripcion: [item.materia_nombre, item.hora_inicio, item.sala].filter(Boolean).join(' · '),
                color: '#60a5fa',
                detalle: {
                    materia_id: item.materia_id,
                    materia_nombre: item.materia_nombre,
                    hora_inicio: item.hora_inicio,
                    hora_fin: item.hora_fin,
                    sala: item.sala,
                    tipo: item.tipo,
                },
            });
        }

        for (const item of annotations) {
            pushEvent(item.fecha, {
                tipo: 'anotacion',
                subtipo: item.gravedad,
                titulo: item.titulo,
                descripcion: item.descripcion,
                color: item.gravedad === 'alta' ? '#ef4444' : item.gravedad === 'baja' ? '#12b886' : '#94a3b8',
                detalle: {
                    gravedad: item.gravedad,
                },
            });
        }

        const dates = [...new Set([
            ...attendanceMap.keys(),
            ...holidays.map((row) => row.fecha),
            ...tests.map((row) => row.fecha),
            ...annotations.map((row) => row.fecha),
        ])].sort();

        const result = {
            estudiante: {
                ...req.estudiante,
                foto_url: buildAbsoluteUploadUrl(req, req.estudiante.foto_url),
                curso: buildCoursePayload(req.estudiante),
            },
            mes: month,
            resumen: {
                feriados: holidays.length,
                pruebas: tests.length,
                anotaciones: annotations.length,
                dias_con_eventos: dates.length,
            },
            dias: dates.map((date) => {
                const eventos = (eventsByDate.get(date) || []).sort((a, b) => {
                    const order = { feriado: 0, prueba: 1, anotacion: 2, asistencia: 3 };
                    return (order[a.tipo] ?? 99) - (order[b.tipo] ?? 99);
                });
                return {
                    fecha: date,
                    estado_asistencia: attendanceMap.get(date) || null,
                    tiene_salida: Boolean(exitMap.get(date)),
                    eventos,
                    colores: [...new Set(eventos.map((event) => event.color).filter(Boolean))],
                };
            }),
            feriados: holidays,
            pruebas: tests,
            anotaciones: annotations,
        };

        cache.set(cacheKey, result);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/estudiantes/:id/anotaciones', requireOwnedStudent, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id,
                    TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha,
                    tipo,
                    gravedad,
                    titulo,
                    descripcion,
                    TO_CHAR(creado_en, 'YYYY-MM-DD"T"HH24:MI:SS') AS creado_en
             FROM anotaciones
             WHERE estudiante_id = ? AND visible_apoderado = TRUE
             ORDER BY fecha DESC, creado_en DESC`,
            [req.estudiante.id],
        );

        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/estudiantes/:id/atrasos', requireOwnedStudent, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha, hora_ingreso, es_atraso, justificado,
                    justificacion_descripcion, minutos_retraso
             FROM asistencia
             WHERE estudiante_id = ? AND es_atraso = TRUE
             ORDER BY fecha DESC`,
            [req.estudiante.id],
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/estudiantes/:id/salidas', requireOwnedStudent, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha, hora_salida, motivo, es_medico, observaciones
             FROM salidas_anticipadas
             WHERE estudiante_id = ?
             ORDER BY fecha DESC`,
            [req.estudiante.id],
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/solicitudes/justificacion', (req, res, next) => {
    upload.single('evidencia')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, async (req, res) => {
    const asistenciaId = Number(req.body.asistencia_id);
    const estudianteId = Number(req.body.estudiante_id);
    const motivo = String(req.body.motivo || '').trim();
    if (!asistenciaId || !estudianteId || motivo.length < 3) {
        return res.status(400).json({ error: 'Debes indicar asistencia, estudiante y un motivo válido.' });
    }

    try {
        const estudiante = await getApoderadoByStudentId(req.apoderado.id, estudianteId);
        if (!estudiante) {
            return res.status(403).json({ error: 'No puedes acceder a este estudiante.' });
        }

        const evidenciaUrl = req.file ? req.file.path.replace(/\\/g, '/') : null;
        const [rows] = await pool.query(
            `INSERT INTO solicitudes_justificacion (asistencia_id, estudiante_id, apoderado_id, motivo, evidencia_url)
             VALUES (?, ?, ?, ?, ?)
             RETURNING id, estado, creado_en`,
            [asistenciaId, estudianteId, req.apoderado.id, motivo, evidenciaUrl],
        );

        await enviarPushApoderado(req.apoderado.id, {
            estudianteId,
            titulo: 'Solicitud enviada',
            mensaje: 'Tu justificación fue enviada a inspectoría.',
            tipo: 'solicitud-justificacion',
            data: { solicitudId: rows[0]?.id || null },
        });

        res.status(201).json({
            ...rows[0],
            evidencia_url: buildAbsoluteUploadUrl(req, evidenciaUrl),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/solicitudes/justificacion', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT sj.id, sj.asistencia_id, sj.estudiante_id, sj.motivo, sj.evidencia_url, sj.estado,
                    sj.comentario_revision, TO_CHAR(sj.creado_en, 'YYYY-MM-DD"T"HH24:MI:SS') AS creado_en,
                    e.nombre, e.apellido
             FROM solicitudes_justificacion sj
             JOIN estudiantes e ON e.id = sj.estudiante_id
             WHERE sj.apoderado_id = ?
             ORDER BY sj.creado_en DESC`,
            [req.apoderado.id],
        );
        res.json(rows.map((row) => ({
            ...row,
            evidencia_url: buildAbsoluteUploadUrl(req, row.evidencia_url),
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/solicitudes/salida', async (req, res) => {
    try {
        const datosNormalizados = normalizarDatos(req.body || {});
        const validacion = validarSalidaAnticipada(datosNormalizados);

        if (!validacion.valido) {
            return res.status(400).json({
                error: 'Revisa los datos de la solicitud.',
                detalles: validacion.errores,
            });
        }

        if (!esHoraSalidaValida(datosNormalizados.hora_salida)) {
            return res.status(400).json({
                error: 'La hora de salida debe ser posterior a las 08:00.',
            });
        }

        const estudianteId = datosNormalizados.estudiante_id;
        const fecha = datosNormalizados.fecha;
        const horaSalida = datosNormalizados.hora_salida;
        const motivo = datosNormalizados.motivo;

        const estudiante = await getApoderadoByStudentId(req.apoderado.id, estudianteId);
        if (!estudiante) {
            return res.status(403).json({ error: 'No puedes acceder a este estudiante.' });
        }

        const [rows] = await pool.query(
            `INSERT INTO solicitudes_salida (estudiante_id, apoderado_id, fecha, hora_salida, motivo, es_medico)
             VALUES (?, ?, ?, ?, ?, ?)
             RETURNING id, estado, creado_en`,
            [estudianteId, req.apoderado.id, fecha, horaSalida, motivo, Boolean(datosNormalizados.es_medico)],
        );

        await enviarPushApoderado(req.apoderado.id, {
            estudianteId,
            titulo: 'Solicitud enviada',
            mensaje: 'Tu solicitud de salida fue enviada para revisión.',
            tipo: 'solicitud-salida',
            data: { solicitudId: rows[0]?.id || null },
        });

        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('[apoderados] Error en solicitud de salida:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/solicitudes/salida', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT ss.id, ss.estudiante_id, ss.fecha, ss.hora_salida, ss.motivo, ss.es_medico, ss.estado,
                    ss.comentario_revision, TO_CHAR(ss.creado_en, 'YYYY-MM-DD"T"HH24:MI:SS') AS creado_en,
                    e.nombre, e.apellido
             FROM solicitudes_salida ss
             JOIN estudiantes e ON e.id = ss.estudiante_id
             WHERE ss.apoderado_id = ?
             ORDER BY ss.creado_en DESC`,
            [req.apoderado.id],
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/notificaciones', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, estudiante_id, titulo, mensaje, tipo, leida, data,
                    TO_CHAR(creado_en, 'YYYY-MM-DD"T"HH24:MI:SS') AS creado_en
             FROM notificaciones_apoderado
             WHERE apoderado_id = ?
             ORDER BY creado_en DESC`,
            [req.apoderado.id],
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/notificaciones/:id/leer', async (req, res) => {
    try {
        await pool.query(
            'UPDATE notificaciones_apoderado SET leida = TRUE WHERE id = ? AND apoderado_id = ?',
            [req.params.id, req.apoderado.id],
        );
        res.json({ message: 'Notificación actualizada.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/notificaciones/leer-todas', async (req, res) => {
    try {
        await pool.query(
            'UPDATE notificaciones_apoderado SET leida = TRUE WHERE apoderado_id = ?',
            [req.apoderado.id],
        );
        res.json({ message: 'Notificaciones actualizadas.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/anuncios', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, titulo, mensaje, tipo, activo_desde, activo_hasta, created_at
             FROM anuncios
             WHERE activo_desde <= CURRENT_DATE AND (activo_hasta IS NULL OR activo_hasta >= CURRENT_DATE)
             ORDER BY created_at DESC`,
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/push-token', async (req, res) => {
    const token = String(req.body.token || '').trim();
    const plataforma = String(req.body.plataforma || 'android').trim();
    if (!token) {
        return res.status(400).json({ error: 'Token requerido.' });
    }

    try {
        await pool.query(
            `INSERT INTO apoderado_push_tokens (apoderado_id, token, plataforma)
             VALUES (?, ?, ?)
             ON CONFLICT (apoderado_id, token)
             DO UPDATE SET plataforma = EXCLUDED.plataforma`,
            [req.apoderado.id, token, plataforma],
        );
        res.json({ message: 'Token registrado.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
