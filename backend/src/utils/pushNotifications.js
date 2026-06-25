const axios = require('axios');
const pool = require('../db');

async function persistNotification(apoderadoId, payload) {
    const [rows] = await pool.query(
        `INSERT INTO notificaciones_apoderado (apoderado_id, estudiante_id, titulo, mensaje, tipo, data)
         VALUES (?, ?, ?, ?, ?, ?::jsonb)
         RETURNING id`,
        [
            apoderadoId,
            payload.estudianteId || null,
            payload.titulo,
            payload.mensaje,
            payload.tipo || 'general',
            JSON.stringify(payload.data || {}),
        ],
    );

    return rows[0]?.id || null;
}

async function enviarPushApoderado(apoderadoId, payload) {
    const notificationId = await persistNotification(apoderadoId, payload);
    const [tokens] = await pool.query(
        'SELECT token FROM apoderado_push_tokens WHERE apoderado_id = ?',
        [apoderadoId],
    );

    if (tokens.length === 0) {
        return { notificationId, sent: 0 };
    }

    const messages = tokens.map((entry) => ({
        to: entry.token,
        sound: 'default',
        title: payload.titulo,
        body: payload.mensaje,
        data: {
            ...payload.data,
            notificationId,
            tipo: payload.tipo || 'general',
        },
    }));

    try {
        await axios.post('https://exp.host/--/api/v2/push/send', messages, {
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            timeout: 8000,
        });
    } catch (error) {
        console.warn('[push] No se pudo enviar push a apoderado:', error.message);
    }

    return { notificationId, sent: messages.length };
}

async function notifyManyApoderados(apoderadoIds, payload) {
    const uniqueIds = [...new Set((apoderadoIds || []).filter(Boolean))];
    for (const apoderadoId of uniqueIds) {
        await enviarPushApoderado(apoderadoId, payload);
    }
}

async function notifyAllApoderados(payload) {
    const [rows] = await pool.query('SELECT id FROM apoderados WHERE activo = TRUE');
    return notifyManyApoderados(rows.map((row) => row.id), payload);
}

module.exports = {
    enviarPushApoderado,
    notifyManyApoderados,
    notifyAllApoderados,
};
