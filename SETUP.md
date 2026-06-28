# Setup Rapido

Guia corta para levantar el proyecto en una PC nueva.

## Lo que debes instalar

- Node.js 22+
- Git
- Android Studio
- JDK incluido en Android Studio
- Un emulador Android en Android Studio

## Lo que debes preparar

- Clonar el repo
- Ejecutar `npm install`
- Tener el SDK de Android configurado
- Tener `JAVA_HOME` apuntando al JBR de Android Studio si hace falta compilar Android

## Archivos importantes

- `android/local.properties`
- `package.json`
- `scripts/start-expo.js`

## Flujo de uso

### Celular fisico

```bash
npm run start:render
```

Abre Expo Go y escanea el QR.

### Emulador Android

Primera vez en una PC nueva:

```bash
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
npx expo run:android --port 8082
```

Despues:

```bash
npm run start:emu
```

## Si algo falla

1. Verifica que Android Studio tenga un emulador creado.
2. Verifica que `JAVA_HOME` exista.
3. Verifica que `android/local.properties` tenga la ruta correcta del SDK.
4. Repite `npx expo run:android --port 8082` una vez.

## Nota

Este archivo no incluye secretos, credenciales ni detalles de infraestructura.
