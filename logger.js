const APP_TAG = "PercoBot";

function timestamp() {
  return new Date().toISOString();
}

function safeStringify(value) {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}\n${value.stack ?? ""}`.trim();
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function write(level, message, ...meta) {
  const base = `[${timestamp()}] [${APP_TAG}] [${level}] ${message}`;
  if (meta.length === 0) {
    process.stdout.write(`${base}\n`);
    return;
  }

  const details = meta.map((item) => safeStringify(item)).join(" ");
  process.stdout.write(`${base} ${details}\n`);
}

export function log(message, ...meta) {
  write("INFO", message, ...meta);
}

export function info(message, ...meta) {
  write("INFO", message, ...meta);
}

export function warn(message, ...meta) {
  write("WARN", message, ...meta);
}

export function error(message, ...meta) {
  write("ERROR", message, ...meta);
}

export function debug(message, ...meta) {
  if (process.env.LOG_LEVEL === "debug") {
    write("DEBUG", message, ...meta);
  }
}
