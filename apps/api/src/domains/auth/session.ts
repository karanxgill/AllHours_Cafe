import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { isAllowedWebOrigin } from "../../config/origins.js";

const COOKIE_NAME = "ahc_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;

type SessionPayload = { sub: number; exp: number };

function signature(value: string): string {
  return createHmac("sha256", env.SESSION_SECRET)
    .update(value)
    .digest("base64url");
}

function cookieOptions(maxAge?: number): string {
  const parts = [`${COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (env.NODE_ENV === "production") parts.push("Secure");
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  return parts.join("; ");
}

export function setSessionCookie(
  response: Response,
  userId: number,
  rememberMe: boolean,
): void {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    } satisfies SessionPayload),
  ).toString("base64url");
  const value = `${payload}.${signature(payload)}`;
  const options = cookieOptions(
    rememberMe ? SESSION_SECONDS : undefined,
  ).replace(`${COOKIE_NAME}=`, `${COOKIE_NAME}=${value}`);
  response.append("Set-Cookie", options);
}

export function clearSessionCookie(response: Response): void {
  response.append(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
}

export function readSessionUserId(request: Request): number | null {
  const rawCookie = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!rawCookie) return null;

  const value = rawCookie.slice(COOKIE_NAME.length + 1);
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;
  const payload = value.slice(0, separator);
  const receivedSignature = Buffer.from(value.slice(separator + 1));
  const expectedSignature = Buffer.from(signature(payload));
  if (
    receivedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(receivedSignature, expectedSignature)
  )
    return null;

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (
      !Number.isSafeInteger(session.sub) ||
      session.sub <= 0 ||
      !Number.isFinite(session.exp) ||
      session.exp <= Date.now() / 1000
    )
      return null;
    return session.sub;
  } catch {
    return null;
  }
}

export function hasAllowedOrigin(request: Request): boolean {
  const origin = request.get("origin");
  return !origin || isAllowedWebOrigin(origin);
}
