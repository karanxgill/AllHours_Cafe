import { env } from "./env.js";

const allowedOrigins = new Set(env.WEB_ORIGIN);

if (env.NODE_ENV === "development") {
  for (const hostname of ["localhost", "127.0.0.1"]) {
    for (let port = 5173; port <= 5180; port += 1) {
      allowedOrigins.add(`http://${hostname}:${port}`);
    }
  }
}

export function isAllowedWebOrigin(origin: string): boolean {
  return allowedOrigins.has(origin);
}
