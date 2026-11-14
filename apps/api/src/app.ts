import cors from "cors";
import express from "express";
import { default as helmet } from "helmet";
import { env } from "./config/env.js";
import { isAllowedWebOrigin } from "./config/origins.js";
import { prisma } from "./db/prisma.js";
import { authRouter } from "./domains/auth/routes.js";
import { homeRouter } from "./domains/home/routes.js";
import { menuRouter } from "./domains/menu/routes.js";
import { ordersRouter } from "./domains/orders/routes.js";
import { reservationsRouter } from "./domains/reservations/routes.js";
import { contactsRouter } from "./domains/contacts/routes.js";
import { adminRouter } from "./domains/admin/routes.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) =>
      callback(null, !origin || isAllowedWebOrigin(origin)),
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok", service: "all-hours-cafe-api" });
});

app.get("/api/v1/health/database", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error(
      "Prisma database health check failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/home", homeRouter);
app.use("/api/v1/menu", menuRouter);
app.use("/api/v1/orders", ordersRouter);
app.use("/api/v1/reservations", reservationsRouter);
app.use("/api/v1/contacts", contactsRouter);
app.use("/api/v1/admin", adminRouter);

app.use((_req, res) => {
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "Route not found" } });
});
