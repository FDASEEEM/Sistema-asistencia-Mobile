# Sistema-asistencia-Mobile

Proyecto mobile de apoderados con dos flujos de trabajo:

- Celular fisico con Expo Go y Render
- Emulador Android con `dev client`

## Estructura

- `src/`: app movil
- `backend/`: API de apoderados
- `android/`: proyecto nativo Android para el emulador
- `scripts/start-expo.js`: arranque segun modo

## Requisitos de Windows

Instala esto una vez por PC:

- Node.js 22 o superior
- Git
- Android Studio
- JDK de Android Studio
- Emulador Android con una imagen x86_64 o arm64

Variables utiles:

- `JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`
- SDK Android en la ruta de tu usuario, por ejemplo `C:\Users\TU_USUARIO\AppData\Local\Android\Sdk`

## Preparacion inicial

1. Clona el repo.
2. Instala dependencias:

```bash
npm install
```

3. Verifica Android Studio y SDK.
4. Asegura que exista `android/local.properties` con la ruta real de tu SDK:

```text
sdk.dir=C:\Users\TU_USUARIO\AppData\Local\Android\Sdk
```

5. Configura `JAVA_HOME` si `npx expo run:android` falla por Java.

## Backend

La app apunta a Render por defecto:

```text
https://sistema-asistencia-mobile.onrender.com/api
```

No necesitas backend local para usar la app en celular o emulador.

## Celular fisico

Usa este modo cuando quieras abrir la app en tu telefono:

```bash
npm run start:render
```

Luego escanea el QR con Expo Go.

## Emulador Android

Este proyecto usa `expo-dev-client` para el emulador.

Primera vez en una PC nueva:

```bash
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
npx expo run:android --port 8082
```

Eso:

- Compila la app nativa
- Instala el APK debug en el emulador
- Deja listo el dev client

Despues, para abrir el emulador:

```bash
npm run start:emu
```

## Comandos

- `npm run start:render`: celular fisico
- `npm run start:emu`: emulador Android
- `npm run android`: build nativa Android
- `npm run web`: web

## Recuperacion rapida

Si algo falla en una PC nueva:

1. Revisa que Android Studio tenga un emulador creado.
2. Revisa que `JAVA_HOME` apunte al JBR de Android Studio.
3. Revisa `android/local.properties`.
4. Ejecuta `npx expo run:android --port 8082` una vez.
5. Luego usa `npm run start:emu`.

## Render

El backend vive en Render y el blueprint esta en `render.yaml`.

Variables obligatorias en Render:

```text
PG_URI=postgres://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
APODERADOS_JWT_SECRET=un-secreto-largo-y-unico
```

## Notas

- El emulador ya no depende de Expo Go.
- El QR y el emulador usan modos distintos.
- Si cambias de PC, lo mas importante es reinstalar Android Studio, configurar `JAVA_HOME` y reconstruir el dev client una vez.
