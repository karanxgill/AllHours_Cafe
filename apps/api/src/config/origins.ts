import { env } from "./env.js";

const allowedOrigins = new Set(env.WEB_ORIGIN);

if (env.NODE_ENV === "development") {
  for (const origin of env.WEB_ORIGIN) {
    const configured = new URL(origin);
    if (
      configured.hostname === "localhost" ||
      configured.hostname === "127.0.0.1"
    ) {
      for (let port = 5173; port <= 5180; port += 1) {
        allowedOrigins.add(
          `${configured.protocol}//${configured.hostname}:${port}`,
        );
      }
    }
  }
}

export function isAllowedWebOrigin(origin: string): boolean {
  return allowedOrigins.has(origin);
}
