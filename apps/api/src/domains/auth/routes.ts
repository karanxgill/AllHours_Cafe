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
import { z } from "zod";

export const authRouter = Router();

const profileSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  phoneNumber: z.string().trim().max(50).optional().nullable(),
});

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
    setSessionCookie(response, user.id, false);
    response
      .status(201)
      .json({ message: "Account created and signed in.", user });
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

authRouter.get("/profile", async (request, response) => {
  const userId = readSessionUserId(request);
  if (userId === null) {
    response.status(401).json({ error: { code: "AUTH_REQUIRED", message: "Sign in to view your profile." } });
    return;
  }
  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        createdAt: true,
        orders: {
          orderBy: { orderDate: "desc" },
          include: { orderItems: { orderBy: { id: "asc" } } },
        },
      },
    });
    if (!user) {
      response.status(401).json({ error: { code: "AUTH_REQUIRED", message: "Sign in to view your profile." } });
      return;
    }
    response.json({
      profile: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt.toISOString(),
      },
      orders: user.orders.map((order) => ({
        id: order.id,
        orderDate: order.orderDate.toISOString(),
        total: Number(order.total),
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        items: order.orderItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          total: Number(item.total),
        })),
      })),
    });
  } catch (error) {
    console.error("Customer profile lookup failed:", error instanceof Error ? error.message : "Unknown error");
    response.status(500).json({ error: { code: "PROFILE_LOOKUP_FAILED", message: "Your profile is temporarily unavailable." } });
  }
});

authRouter.patch("/profile", async (request, response) => {
  if (invalidOrigin(request, response)) return;
  const userId = readSessionUserId(request);
  if (userId === null) {
    response.status(401).json({ error: { code: "AUTH_REQUIRED", message: "Sign in to update your profile." } });
    return;
  }
  const parsed = profileSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: { code: "INVALID_PROFILE", message: "Enter a name and a valid phone number." } });
    return;
  }
  try {
    const profile = await prisma.user.update({
      where: { id: userId },
      data: { fullName: parsed.data.fullName, phoneNumber: parsed.data.phoneNumber?.trim() || null },
      select: { id: true, fullName: true, email: true, phoneNumber: true, createdAt: true },
    });
    response.json({ profile: { ...profile, createdAt: profile.createdAt.toISOString() } });
  } catch (error) {
    console.error("Customer profile update failed:", error instanceof Error ? error.message : "Unknown error");
    response.status(500).json({ error: { code: "PROFILE_UPDATE_FAILED", message: "Your profile could not be saved." } });
  }
});

authRouter.post("/logout", (request, response) => {
  if (invalidOrigin(request, response)) return;
  clearSessionCookie(response);
  response.status(204).end();
});
