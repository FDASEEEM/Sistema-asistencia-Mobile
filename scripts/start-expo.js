const { networkInterfaces } = require("os");
const fs = require("fs");
const { execSync, spawn } = require("child_process");

function findLanIp() {
  try {
    const nets = networkInterfaces();

    for (const net of Object.values(nets)) {
      for (const entry of net || []) {
        if (entry.family === "IPv4" && !entry.internal) {
          return entry.address;
        }
      }
    }
  } catch (_) {}

  const commands = [
    "hostname -i",
    "ip -4 addr show scope global | awk '{print $2}' | cut -d/ -f1 | head -n1",
  ];

  for (const command of commands) {
    try {
      const output = execSync(command, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        shell: "/bin/bash",
      })
        .trim()
        .split(/\s+/)
        .find((item) => /^\d+\.\d+\.\d+\.\d+$/.test(item) && item !== "127.0.0.1");

      if (output) {
        return output;
      }
    } catch (_) {}
  }

  return null;
}

function findAdbPath() {
  const candidates = [
    process.env.ANDROID_SDK_ROOT ? `${process.env.ANDROID_SDK_ROOT}\\platform-tools\\adb.exe` : null,
    process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}\\platform-tools\\adb.exe` : null,
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Android\\Sdk\\platform-tools\\adb.exe` : null,
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

const modeArg = process.argv[2] || "tunnel";
const adbPath = findAdbPath();
const lanIp = findLanIp();
const apiPort = Number(process.env.EXPO_API_PORT || 4100);
const expoPort = Number(process.env.EXPO_PORT || (modeArg === "emu" ? 8082 : 8081));
const expoMode = modeArg === "emu" ? "localhost" : modeArg === "lan" || modeArg === "render" ? "lan" : "tunnel";
const renderApiUrl = "https://sistema-asistencia-mobile.onrender.com/api";
const apiUrl =
  modeArg === "render" || modeArg === "emu"
    ? renderApiUrl
    : process.env.EXPO_PUBLIC_API_URL ||
      (lanIp ? `http://${lanIp}:${apiPort}/api` : undefined);

if (!apiUrl) {
  console.error("No pude detectar una IP local para la API. Define EXPO_PUBLIC_API_URL manualmente.");
  process.exit(1);
}

function configureAdbReverse() {
  if (modeArg !== "emu" || !adbPath) {
    return;
  }

  try {
    execSync(`"${adbPath}" reverse tcp:${expoPort} tcp:${expoPort}`, {
      stdio: "ignore",
    });
    console.log(`[mobile] adb reverse configurado para ${expoPort}`);
  } catch (error) {
    console.warn(`[mobile] No se pudo configurar adb reverse: ${error.message}`);
  }
}

configureAdbReverse();

console.log(`[mobile] modo Expo: ${expoMode}`);
console.log(`[mobile] API URL: ${apiUrl}`);

const isWin = process.platform === 'win32';
const command = isWin ? 'npx.cmd' : 'npx';
const args = ["expo", "start", `--${expoMode}`, "--port", String(expoPort)];

if (modeArg === "emu") {
  args.push("--dev-client");
  args.push("--android");
}

const child = spawn(
  command,
  args,
  {
    stdio: "inherit",
    shell: isWin, // Importante en Windows
    env: {
      ...process.env,
      EXPO_NO_DEPENDENCY_VALIDATION: "1",
      EXPO_PUBLIC_API_URL: apiUrl,
      EXPO_PUBLIC_API_URL_ANDROID: apiUrl,
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
