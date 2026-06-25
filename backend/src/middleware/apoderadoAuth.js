const jwt = require('jsonwebtoken');
const pool = require('../db');
const { APODERADOS_JWT_SECRET } = require('../utils/apoderados');

async function apoderadoAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Acceso no autorizado. Inicia sesión.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, APODERADOS_JWT_SECRET);
        if (decoded.tipo !== 'apoderado') {
            return res.status(401).json({ error: 'Token inválido para apoderados.' });
        }

        const [rows] = await pool.query(
            `SELECT id, nombre, apellido, email, telefono, activo
             FROM apoderados
             WHERE id = ?`,
            [decoded.id],
        );

        if (rows.length === 0 || !rows[0].activo) {
            return res.status(403).json({ error: 'Apoderado desactivado.' });
        }

        req.apoderado = rows[0];
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido o expirado. Inicia sesión de nuevo.' });
    }
}

module.exports = { apoderadoAuth };
