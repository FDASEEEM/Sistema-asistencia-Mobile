const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const db = require('./db');
const { ensureMobileSchema } = require('./schema');
const apoderadosAuthRoutes = require('./routes/apoderadosAuth');
const apoderadosRoutes = require('./routes/apoderados');

const app = express();
const PORT = process.env.PORT || 4100;
const uploadsDir = path.join(__dirname, '..', 'uploads');
const jwtSecret = process.env.APODERADOS_JWT_SECRET || process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error(
    'Falta APODERADOS_JWT_SECRET (o JWT_SECRET). Configuralo en Render antes de iniciar el backend.',
  );
}

fs.mkdirSync(uploadsDir, { recursive: true });

app.set('trust proxy', 1);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - start;
    const level = elapsed > 1000 ? 'warn' : 'info';
    console[level](`[mobile-api] ${req.method} ${req.originalUrl} - ${elapsed}ms (${res.statusCode})`);
  });
  next();
});

app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(compression({ level: 6, threshold: 1024 }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PER_MINUTE || 240),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Intenta de nuevo en un minuto.' },
});
app.use('/api', limiter);

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use('/api', cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadsDir));

app.get('/health', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT current_schema() AS schema, NOW() AS now');
    res.json({
      ok: true,
      service: 'sistema-cesar-mobile-api',
      schema: rows[0]?.schema || db.schemaName,
      configuredSchema: db.schemaName,
      now: rows[0]?.now,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message, configuredSchema: db.schemaName });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT current_schema() AS schema, NOW() AS now');
    res.json({
      ok: true,
      service: 'sistema-cesar-mobile-api',
      schema: rows[0]?.schema || db.schemaName,
      configuredSchema: db.schemaName,
      now: rows[0]?.now,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message, configuredSchema: db.schemaName });
  }
});

app.use('/api/apoderados/auth', apoderadosAuthRoutes);
app.use('/api/apoderados', apoderadosRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Ruta movil no encontrada.',
    path: req.originalUrl,
  });
});

app.use((err, req, res, next) => {
  console.error('[mobile-api:error]', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
  });
});

app.listen(PORT, async () => {
  try {
    if (process.env.MOBILE_RUN_MIGRATIONS !== 'false') {
      await ensureMobileSchema();
      console.log('[mobile-api] Schema movil verificado');
    }
    const [rows] = await db.query('SELECT current_schema() AS schema');
    console.log(`[mobile-api] DB lista en schema ${rows[0]?.schema || db.schemaName}`);
  } catch (error) {
    console.warn(`[mobile-api] No se pudo verificar DB al iniciar: ${error.message}`);
  }
  console.log(`[mobile-api] Servidor movil corriendo en puerto ${PORT}`);
});
