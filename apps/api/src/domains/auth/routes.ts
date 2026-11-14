import { Router } from "express";
import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../db/prisma.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  clearSessionCookie,
  hasAllowedOrigin,
  readSessionUserId,
  setSessionCookie,
} from "./session.js";
import { loginSchema, signupSchema } from "./validation.js";

export const authRouter = Router();

const publicUserSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
} as const;

function invalidOrigin(
  request: import("express").Request,
  response: import("express").Response,
): boolean {
  if (hasAllowedOrigin(request)) return false;
  response
    .status(403)
    .json({
      error: {
        code: "INVALID_ORIGIN",
        message: "Request origin is not allowed.",
      },
    });
  return true;
}

authRouter.post("/signup", async (request, response) => {
  if (invalidOrigin(request, response)) return;
  const parsed = signupSchema.safeParse(request.body);
  if (!parsed.success) {
    response
      .status(400)
      .json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Check the highlighted fields.",
          fields: parsed.error.flatten().fieldErrors,
        },
      });
    return;
  }

  const { fullName, email, password } = parsed.data;
  try {
    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash: await hashPassword(password),
        role: "User",
        isActive: true,
      },
      select: publicUserSelect,
    });
    response
      .status(201)
      .json({ message: "Account created. Please sign in.", user });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      response
        .status(409)
        .json({
          error: {
            code: "EMAIL_EXISTS",
            message: "An account with this email already exists.",
          },
        });
      return;
    }
    console.error(
      "Signup failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(500)
      .json({
        error: {
          code: "SIGNUP_FAILED",
          message: "We could not create your account right now.",
        },
      });
  }
});

authRouter.post("/login", async (request, response) => {
  if (invalidOrigin(request, response)) return;
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    response
      .status(400)
      .json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Enter a valid email and password.",
        },
      });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { ...publicUserSelect, passwordHash: true, isActive: true },
    });
    if (
      !user ||
      !user.isActive ||
      !(await verifyPassword(parsed.data.password, user.passwordHash))
    ) {
      response
        .status(401)
        .json({
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password.",
          },
        });
      return;
    }

    setSessionCookie(response, user.id, parsed.data.rememberMe);
    response.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(
      "Sign in failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(500)
      .json({
        error: {
          code: "LOGIN_FAILED",
          message: "We could not sign you in right now.",
        },
      });
  }
});

authRouter.get("/me", async (request, response) => {
  const userId = readSessionUserId(request);
  if (userId === null) {
    response.json({ user: null });
    return;
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ...publicUserSelect, isActive: true },
    });
    if (!user || !user.isActive) {
      clearSessionCookie(response);
      response.json({ user: null });
      return;
    }
    response.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(
      "Session lookup failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(503)
      .json({
        error: {
          code: "SESSION_LOOKUP_FAILED",
          message: "Account status is temporarily unavailable.",
        },
      });
  }
});

authRouter.post("/logout", (request, response) => {
  if (invalidOrigin(request, response)) return;
  clearSessionCookie(response);
  response.status(204).end();
});
