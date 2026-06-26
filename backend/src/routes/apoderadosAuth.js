const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { validate } = require('../middleware/validate');
const { apoderadoAuth } = require('../middleware/apoderadoAuth');
const { generateOpaqueToken, refreshExpiresAt, signApoderadoToken } = require('../utils/apoderados');

const router = express.Router();

const loginLimiter = process.env.NODE_ENV === 'production'
    ? rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Demasiados intentos de inicio de sesion.' },
    })
    : (req, res, next) => next();

router.post('/login', loginLimiter, validate('login'), async (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password;
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    try {
        const [rows] = await pool.query(
            `SELECT id, nombre, apellido, email, telefono, activo, password_hash
             FROM apoderados
             WHERE email = ?`,
            [email],
        );

        const apoderado = rows[0];
        if (!apoderado || !apoderado.activo) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        const matches = await bcrypt.compare(password, apoderado.password_hash);
        if (!matches) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        const accessToken = signApoderadoToken(apoderado);
        const refreshToken = generateOpaqueToken();
        const expiraEn = refreshExpiresAt();

        await pool.query(
            `INSERT INTO apoderado_refresh_tokens (apoderado_id, token, expira_en, ip, user_agent)
             VALUES (?, ?, ?, ?, ?)`,
            [apoderado.id, refreshToken, expiraEn.toISOString(), ip, userAgent],
        );

        res.json({
            token: accessToken,
            refreshToken,
            apoderado: {
                id: apoderado.id,
                nombre: apoderado.nombre,
                apellido: apoderado.apellido,
                email: apoderado.email,
                telefono: apoderado.telefono,
            },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/refresh', async (req, res) => {
    const refreshToken = req.body?.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ error: 'No hay sesion activa.' });
    }

    try {
        const [rows] = await pool.query(
            `SELECT art.apoderado_id, art.token, a.id, a.nombre, a.apellido, a.email, a.telefono, a.activo
             FROM apoderado_refresh_tokens art
             JOIN apoderados a ON a.id = art.apoderado_id
             WHERE art.token = ? AND art.revocado = FALSE AND art.expira_en > NOW()`,
            [refreshToken],
        );

        const tokenRow = rows[0];
        if (!tokenRow) {
            return res.status(401).json({ error: 'Sesion expirada. Inicia sesion de nuevo.' });
        }

        if (!tokenRow.activo) {
            await pool.query('UPDATE apoderado_refresh_tokens SET revocado = TRUE WHERE token = ?', [refreshToken]);
            return res.status(403).json({ error: 'Apoderado desactivado.' });
        }

        await pool.query('UPDATE apoderado_refresh_tokens SET revocado = TRUE WHERE token = ?', [refreshToken]);

        const newRefreshToken = generateOpaqueToken();
        const expiraEn = refreshExpiresAt();
        await pool.query(
            `INSERT INTO apoderado_refresh_tokens (apoderado_id, token, expira_en, ip, user_agent)
             VALUES (?, ?, ?, ?, ?)`,
            [
                tokenRow.id,
                newRefreshToken,
                expiraEn.toISOString(),
                req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null,
                req.headers['user-agent'] || null,
            ],
        );

        res.json({
            token: signApoderadoToken(tokenRow),
            refreshToken: newRefreshToken,
            apoderado: {
                id: tokenRow.id,
                nombre: tokenRow.nombre,
                apellido: tokenRow.apellido,
                email: tokenRow.email,
                telefono: tokenRow.telefono,
            },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/logout', async (req, res) => {
    const refreshToken = req.body?.refreshToken;
    if (refreshToken) {
        try {
            await pool.query('UPDATE apoderado_refresh_tokens SET revocado = TRUE WHERE token = ?', [refreshToken]);
        } catch (_) {}
    }

    res.json({ message: 'Sesion cerrada correctamente.' });
});

router.get('/me', apoderadoAuth, async (req, res) => {
    res.json({ apoderado: req.apoderado });
});

router.put('/me', apoderadoAuth, async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const telefono = String(req.body?.telefono || '').trim();
    const password = String(req.body?.password || '').trim();
    const newPassword = String(req.body?.newPassword || '').trim();
    const revokeOtherSessions = Boolean(req.body?.revokeOtherSessions);

    if (!email || !password) {
        return res.status(400).json({ error: 'Correo y clave son requeridos para actualizar el perfil.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Debes ingresar un correo valido.' });
    }

    if (newPassword && newPassword.length < 8) {
        return res.status(400).json({ error: 'La nueva clave debe tener al menos 8 caracteres.' });
    }

    try {
        const [rows] = await pool.query(
            `SELECT id, password_hash
             FROM apoderados
             WHERE id = ?`,
            [req.apoderado.id],
        );

        const current = rows[0];
        if (!current) {
            return res.status(404).json({ error: 'Apoderado no encontrado.' });
        }

        const matches = await bcrypt.compare(password, current.password_hash);
        if (!matches) {
            return res.status(401).json({ error: 'La clave actual no es correcta.' });
        }

        const [duplicateRows] = await pool.query(
            `SELECT id
             FROM apoderados
             WHERE email = ? AND id <> ?`,
            [email, req.apoderado.id],
        );

        if (duplicateRows.length > 0) {
            return res.status(400).json({ error: 'Ese correo ya esta registrado por otro apoderado.' });
        }

        const nextPasswordHash = newPassword ? await bcrypt.hash(newPassword, 10) : null;

        await pool.query(
            `UPDATE apoderados
             SET email = ?, telefono = ?, password_hash = COALESCE(?, password_hash), actualizado_en = NOW()
             WHERE id = ?`,
            [email, telefono || null, nextPasswordHash, req.apoderado.id],
        );

        if (revokeOtherSessions) {
            await pool.query(
                `UPDATE apoderado_refresh_tokens
                 SET revocado = TRUE
                 WHERE apoderado_id = ?`,
                [req.apoderado.id],
            );
        }

        const [updatedRows] = await pool.query(
            `SELECT id, nombre, apellido, email, telefono, activo
             FROM apoderados
             WHERE id = ?`,
            [req.apoderado.id],
        );

        res.json({ apoderado: updatedRows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
