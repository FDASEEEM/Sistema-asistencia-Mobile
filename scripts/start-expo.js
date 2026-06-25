const { networkInterfaces } = require("os");
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

const mode = process.argv[2] === "lan" ? "lan" : "tunnel";
const lanIp = findLanIp();
const apiPort = Number(process.env.EXPO_API_PORT || 4000);
const expoPort = Number(process.env.EXPO_PORT || 8081);
const apiUrl = process.env.EXPO_PUBLIC_API_URL || (lanIp ? `http://${lanIp}:${apiPort}/api` : undefined);

if (!apiUrl) {
  console.error("No pude detectar una IP local para la API. Define EXPO_PUBLIC_API_URL manualmente.");
  process.exit(1);
}

console.log(`[mobile] modo Expo: ${mode}`);
console.log(`[mobile] API URL: ${apiUrl}`);

const isWin = process.platform === 'win32';
const command = isWin ? 'npx.cmd' : 'npx';
const args = ["expo", "start", `--${mode}`, "--port", String(expoPort)];

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
