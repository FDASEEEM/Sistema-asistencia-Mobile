const appName = 'Sistema Cesar Apoderados';
const appSlug = 'sistema-cesar-apoderados';
const androidPackage = 'com.sistemacesar.apoderados';
const version = '1.0.0';
const projectId = '5d7a5508-21d9-49ef-9eb5-4a9a8fe251af';
const owner = process.env.EXPO_OWNER || 'fdaseem';
const publicApiUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_URL_ANDROID ||
  'https://sistema-asistencia-mobile.onrender.com/api';

module.exports = () => ({
  expo: {
    name: appName,
    slug: appSlug,
    version,
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    plugins: ['expo-font'],
    assetBundlePatterns: ['**/*'],
    owner,
    extra: {
      eas: {
        projectId: process.env.EXPO_PROJECT_ID || process.env.EXPO_PUBLIC_EAS_PROJECT_ID || projectId,
      },
      apiUrl: process.env.EXPO_PUBLIC_API_URL || publicApiUrl,
    },
    android: {
      package: androidPackage,
      versionCode: Number(process.env.EXPO_ANDROID_VERSION_CODE || process.env.GITHUB_RUN_NUMBER || 1),
      // The current school backend is served from an internal HTTP address.
      // Keep this until the backend is exposed through HTTPS.
      usesCleartextTraffic: true,
    },
  },
});
