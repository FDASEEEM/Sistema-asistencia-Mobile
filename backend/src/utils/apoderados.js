const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const NodeCache = require('node-cache');
const pool = require('../db');

const APODERADOS_JWT_SECRET = process.env.APODERADOS_JWT_SECRET || process.env.JWT_SECRET;
const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_DAYS = 30;
const apoderadosCache = new NodeCache({ stdTTL: 30, checkperiod: 60 });

function generateOpaqueToken() {
    return crypto.randomBytes(32).toString('hex');
}

function refreshExpiresAt() {
    const date = new Date();
    date.setDate(date.getDate() + REFRESH_EXPIRES_DAYS);
    return date;
}

function signApoderadoToken(apoderado) {
    return jwt.sign(
        {
            id: apoderado.id,
            tipo: 'apoderado',
            email: apoderado.email,
            nombre: apoderado.nombre,
            apellido: apoderado.apellido,
        },
        APODERADOS_JWT_SECRET,
        { expiresIn: ACCESS_EXPIRES_IN },
    );
}

async function getApoderadoByStudentId(apoderadoId, estudianteId) {
    const cacheKey = `student_${apoderadoId}_${estudianteId}`;
    const cached = apoderadosCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const [rows] = await pool.query(
        `SELECT e.id, e.nombre, e.apellido, e.rut, e.curso_id, e.foto_url, c.nombre AS curso_nombre
         FROM estudiante_apoderado ea
         JOIN estudiantes e ON e.id = ea.estudiante_id
         JOIN cursos c ON c.id = e.curso_id
         WHERE ea.apoderado_id = ? AND ea.estudiante_id = ? AND e.activo = TRUE`,
        [apoderadoId, estudianteId],
    );

    const estudiante = rows[0] || null;
    if (estudiante) {
        apoderadosCache.set(cacheKey, estudiante);
    }
    return estudiante;
}

async function requireOwnedStudent(req, res, next) {
    try {
        const estudianteId = Number(req.params.id || req.params.estudianteId || req.body.estudiante_id);
        if (!Number.isFinite(estudianteId) || estudianteId <= 0) {
            return res.status(400).json({ error: 'Estudiante inválido.' });
        }

        const estudiante = await getApoderadoByStudentId(req.apoderado.id, estudianteId);
        if (!estudiante) {
            return res.status(403).json({ error: 'No puedes acceder a este estudiante.' });
        }

        req.estudiante = estudiante;
        next();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

function buildAbsoluteUploadUrl(req, value) {
    if (!value) {
        return null;
    }

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    const normalized = String(value).replace(/\\/g, '/').replace(/^\/+/, '');
    return `${req.protocol}://${req.get('host')}/${normalized}`;
}

module.exports = {
    APODERADOS_JWT_SECRET,
    ACCESS_EXPIRES_IN,
    REFRESH_EXPIRES_DAYS,
    generateOpaqueToken,
    refreshExpiresAt,
    signApoderadoToken,
    getApoderadoByStudentId,
    requireOwnedStudent,
    buildAbsoluteUploadUrl,
    apoderadosCache,
};
