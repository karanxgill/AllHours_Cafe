import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { hasAllowedOrigin } from "../auth/session.js";

export const contactsRouter = Router();

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(255)
    .transform((value) => value.toLowerCase()),
  subject: z.string().trim().min(1, "Subject is required.").max(200),
  message: z.string().trim().min(1, "Message is required.").max(2000),
});

contactsRouter.post("/", async (request, response) => {
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
  const parsed = contactSchema.safeParse(request.body);
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

  try {
    const contact = await prisma.contact.create({
      data: { ...parsed.data, isRead: false },
    });
    response
      .status(201)
      .json({
        message: "Thanks for reaching out. Your message has been received.",
        id: contact.id,
      });
  } catch (error) {
    console.error(
      "Contact submission failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(500)
      .json({
        error: {
          code: "CONTACT_SUBMISSION_FAILED",
          message:
            "We could not send your message right now. Please try again.",
        },
      });
  }
});
