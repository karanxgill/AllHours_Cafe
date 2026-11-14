import { Router } from "express";
import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../db/prisma.js";
import { hasAllowedOrigin, readSessionUserId } from "../auth/session.js";
import { z } from "zod";

export const reservationsRouter = Router();

const reservationSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(100),
    phoneNumber: z
      .string()
      .trim()
      .min(5, "Enter a valid phone number.")
      .max(50),
    reservationDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date."),
    reservationTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a valid time."),
    reservationDateTime: z.string().datetime({ offset: true }),
    timezoneOffsetMinutes: z.number().int().min(-840).max(840),
    numberOfGuests: z.number().int().min(1).max(20),
    specialRequests: z.string().trim().max(500).optional().default(""),
  })
  .superRefine((value, context) => {
    const instant = new Date(value.reservationDateTime);
    if (Number.isNaN(instant.getTime()) || instant <= new Date()) {
      context.addIssue({
        code: "custom",
        path: ["reservationDate"],
        message: "Choose a reservation time in the future.",
      });
    }
    const [year, month, day] = value.reservationDate.split("-").map(Number);
    const [hour, minute] = value.reservationTime.split(":").map(Number);
    const expectedInstant =
      Date.UTC(year, month - 1, day, hour, minute) +
      value.timezoneOffsetMinutes * 60_000;
    if (Math.abs(expectedInstant - instant.getTime()) > 60_000) {
      context.addIssue({
        code: "custom",
        path: ["reservationDateTime"],
        message: "Reservation date and time do not match.",
      });
    }
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (
      candidate.getUTCFullYear() !== year ||
      candidate.getUTCMonth() !== month - 1 ||
      candidate.getUTCDate() !== day
    ) {
      context.addIssue({
        code: "custom",
        path: ["reservationDate"],
        message: "Choose a valid calendar date.",
      });
    }
  });

reservationsRouter.post("/", async (request, response) => {
  if (!hasAllowedOrigin(request)) {
    response
      .status(403)
      .json({
        error: {
          code: "INVALID_ORIGIN",
          message: "Request origin is not allowed.",
        },
      });
    return;
  }
  const userId = readSessionUserId(request);
  if (userId === null) {
    response
      .status(401)
      .json({
        error: {
          code: "AUTH_REQUIRED",
          message: "Sign in before requesting a reservation.",
        },
      });
    return;
  }
  const parsed = reservationSchema.safeParse(request.body);
  if (!parsed.success) {
    response
      .status(400)
      .json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Check the reservation details and try again.",
          fields: parsed.error.flatten().fieldErrors,
        },
      });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, isActive: true },
    });
    if (!user?.isActive) {
      response
        .status(401)
        .json({
          error: {
            code: "AUTH_REQUIRED",
            message: "Sign in before requesting a reservation.",
          },
        });
      return;
    }
    const [year, month, day] = parsed.data.reservationDate
      .split("-")
      .map(Number);
    const [hour, minute] = parsed.data.reservationTime.split(":").map(Number);
    const reservation = await prisma.reservation.create({
      data: {
        name: parsed.data.name,
        email: user.email,
        phoneNumber: parsed.data.phoneNumber,
        numberOfGuests: parsed.data.numberOfGuests,
        reservationDate: new Date(Date.UTC(year, month - 1, day)),
        reservationTime: new Date(Date.UTC(1970, 0, 1, hour, minute)),
        specialRequests: parsed.data.specialRequests || null,
        isConfirmed: false,
        paymentStatus: "Pending",
        paymentMethod: "Pending",
        paymentAmount: new Prisma.Decimal("500.00"),
      },
    });
    response
      .status(201)
      .json({ reservation: serializeReservation(reservation) });
  } catch (error) {
    console.error(
      "Reservation creation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(500)
      .json({
        error: {
          code: "RESERVATION_FAILED",
          message: "We could not save your reservation request right now.",
        },
      });
  }
});

reservationsRouter.get("/:id", async (request, response) => {
  const userId = readSessionUserId(request);
  if (userId === null) {
    response
      .status(401)
      .json({
        error: {
          code: "AUTH_REQUIRED",
          message: "Sign in to view this reservation.",
        },
      });
    return;
  }
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    response
      .status(400)
      .json({
        error: {
          code: "INVALID_RESERVATION",
          message: "Reservation not found.",
        },
      });
    return;
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, isActive: true },
    });
    if (!user?.isActive) {
      response
        .status(401)
        .json({
          error: {
            code: "AUTH_REQUIRED",
            message: "Sign in to view this reservation.",
          },
        });
      return;
    }
    const reservation = await prisma.reservation.findFirst({
      where: { id, email: user.email },
    });
    if (!reservation) {
      response
        .status(404)
        .json({
          error: {
            code: "RESERVATION_NOT_FOUND",
            message: "Reservation not found.",
          },
        });
      return;
    }
    response.json({ reservation: serializeReservation(reservation) });
  } catch (error) {
    console.error(
      "Reservation lookup failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(500)
      .json({
        error: {
          code: "RESERVATION_LOOKUP_FAILED",
          message: "This reservation is temporarily unavailable.",
        },
      });
  }
});

function serializeReservation(
  reservation: Prisma.ReservationGetPayload<object>,
) {
  return {
    id: reservation.id,
    name: reservation.name,
    email: reservation.email,
    phoneNumber: reservation.phoneNumber,
    numberOfGuests: reservation.numberOfGuests,
    reservationDate: reservation.reservationDate.toISOString().slice(0, 10),
    reservationTime: `${String(reservation.reservationTime.getUTCHours()).padStart(2, "0")}:${String(reservation.reservationTime.getUTCMinutes()).padStart(2, "0")}`,
    specialRequests: reservation.specialRequests,
    createdAt: reservation.createdAt.toISOString(),
    isConfirmed: reservation.isConfirmed,
    paymentStatus: reservation.paymentStatus,
    paymentMethod: reservation.paymentMethod,
    paymentAmount: Number(reservation.paymentAmount),
  };
}
