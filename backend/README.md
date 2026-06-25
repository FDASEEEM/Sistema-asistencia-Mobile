# Sistema Cesar Mobile Backend

Backend independiente para la app movil de apoderados.

Este servicio contiene solo la API movil:

- `POST /api/apoderados/auth/login`
- `POST /api/apoderados/auth/refresh`
- `POST /api/apoderados/auth/logout`
- `GET /api/apoderados/auth/me`
- `PUT /api/apoderados/auth/me`
- `GET /api/apoderados/estudiantes`
- `GET /api/apoderados/estudiantes/:id/resumen`
- `GET /api/apoderados/estudiantes/:id/asistencia-mensual`
- `GET /api/apoderados/estudiantes/:id/atrasos`
- `GET /api/apoderados/estudiantes/:id/salidas`
- `GET/POST /api/apoderados/solicitudes/justificacion`
- `GET/POST /api/apoderados/solicitudes/salida`
- `GET /api/apoderados/notificaciones`
- `GET /api/apoderados/anuncios`
- `PUT /api/apoderados/push-token`

## Base de datos

Por defecto se conecta al schema:

```text
test_pruebas
```

Esto viene definido por `APODERADOS_PG_SCHEMA`. Si la variable no existe, el backend usa `test_pruebas`.

El backend prepara automaticamente las tablas minimas que necesita la app movil:

- `usuarios`
- `cursos`
- `estudiantes`
- `asistencia`
- `tabla_asistencia_registros`
- `salidas_anticipadas`
- `anuncios`
- `apoderados`
- `estudiante_apoderado`
- `apoderado_refresh_tokens`
- `apoderado_push_tokens`
- `solicitudes_justificacion`
- `solicitudes_salida`
- `notificaciones_apoderado`

El arranque ejecuta este bootstrap salvo que definas:

```text
MOBILE_RUN_MIGRATIONS=false
```

## Variables

Copia `.env.example` a `.env` para desarrollo local.

Variables principales:

```text
PORT=4100
PG_URI=postgres://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
APODERADOS_PG_SCHEMA=test_pruebas
APODERADOS_JWT_SECRET=change-me
```

## Desarrollo

```bash
npm install
npm run dev
```

Verificacion rapida:

```bash
curl http://localhost:4100/health
```

Debe responder el schema configurado.

Preparar schema manualmente:

```bash
npm run migrate
```

## Seed de pruebas

```bash
npm run seed:demo
```

El seed usa el mismo schema configurado por `APODERADOS_PG_SCHEMA`.
Si no existen estudiantes ligados a apoderados, crea un curso y estudiantes demo.

## Render

El repo ya trae un `render.yaml` en la raiz con el servicio configurado para Render.

Variables que debes completar en Render:

```text
PG_URI=postgres://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
APODERADOS_JWT_SECRET=un-secreto-largo-y-unico
```

Variables que ya quedan fijadas por el blueprint:

```text
NODE_ENV=production
APODERADOS_PG_SCHEMA=test_pruebas
MOBILE_RUN_MIGRATIONS=true
PG_SSL=true
CORS_ORIGINS=
```

Cuando despliegues el backend, la app movil debe compilarse con esta URL publica:

```text
EXPO_PUBLIC_API_URL=https://sistema-cesar-mobile-api.onrender.com/api
```

El APK generado por GitHub Actions ya usa esa URL por defecto.
