import { Router } from "express";
import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../db/prisma.js";
import { hasAllowedOrigin, readSessionUserId } from "../auth/session.js";
import { z } from "zod";

export const ordersRouter = Router();

const orderSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(50),
  customerName: z.string().trim().min(1).max(100),
  customerEmail: z.string().trim().email().max(255),
  customerPhone: z.string().trim().min(5).max(50),
  orderType: z.literal("Pickup"),
  deliveryTime: z.string().datetime().optional().or(z.literal("")),
  specialInstructions: z.string().trim().max(500).optional().default(""),
});

ordersRouter.post("/", async (request, response) => {
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
          message: "Sign in before placing your order.",
        },
      });
    return;
  }
  const parsed = orderSchema.safeParse(request.body);
  if (!parsed.success) {
    response
      .status(400)
      .json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Check the order details and try again.",
          fields: parsed.error.flatten().fieldErrors,
        },
      });
    return;
  }

  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });
    if (!currentUser?.isActive) {
      response
        .status(401)
        .json({
          error: {
            code: "AUTH_REQUIRED",
            message: "Sign in before placing your order.",
          },
        });
      return;
    }

    const quantities = new Map<number, number>();
    for (const line of parsed.data.items)
      quantities.set(
        line.menuItemId,
        (quantities.get(line.menuItemId) ?? 0) + line.quantity,
      );
    if ([...quantities.values()].some((quantity) => quantity > 99)) {
      response
        .status(400)
        .json({
          error: {
            code: "INVALID_QUANTITY",
            message: "Each item is limited to 99 per order.",
          },
        });
      return;
    }

    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: [...quantities.keys()] },
        isActive: true,
        category: { isActive: true },
      },
      select: { id: true, name: true, price: true },
    });
    if (menuItems.length !== quantities.size) {
      response
        .status(409)
        .json({
          error: {
            code: "MENU_CHANGED",
            message:
              "One or more cart items are no longer available. Refresh the menu and try again.",
          },
        });
      return;
    }

    const itemSnapshots = menuItems.map((item) => ({
      menuItemId: item.id,
      name: item.name,
      price: new Prisma.Decimal(item.price),
      quantity: quantities.get(item.id)!,
      total: new Prisma.Decimal(item.price).mul(quantities.get(item.id)!),
    }));
    const subtotalCents = itemSnapshots.reduce(
      (total, item) => total + Math.round(Number(item.total) * 100),
      0,
    );
    const taxCents = Math.round(subtotalCents * 0.05);
    const decimalFromCents = (cents: number) =>
      new Prisma.Decimal(cents).div(100);
    const subtotal = decimalFromCents(subtotalCents);
    const tax = decimalFromCents(taxCents);
    const deliveryFee = decimalFromCents(0);

    const order = await prisma.order.create({
      data: {
        userId,
        customerName: parsed.data.customerName,
        customerEmail: parsed.data.customerEmail.trim().toLowerCase(),
        customerPhone: parsed.data.customerPhone,
        deliveryAddress: "Cafe pickup",
        city: "Pickup",
        state: "Pickup",
        postalCode: "Pickup",
        specialInstructions: parsed.data.specialInstructions || null,
        orderType: "Pickup",
        deliveryTime: parsed.data.deliveryTime
          ? new Date(parsed.data.deliveryTime)
          : null,
        subTotal: subtotal,
        deliveryFee,
        tax,
        total: subtotal.add(tax).add(deliveryFee),
        paymentMethod: "Pay at cafe",
        paymentStatus: "Pending",
        orderStatus: "Pending",
        paymentDetails: "Payment collection is pending",
        orderItems: { create: itemSnapshots },
      },
      include: { orderItems: true },
    });
    response.status(201).json({ order: serializeOrder(order) });
  } catch (error) {
    console.error(
      "Order creation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(500)
      .json({
        error: {
          code: "ORDER_FAILED",
          message: "We could not place the order right now.",
        },
      });
  }
});

ordersRouter.get("/:id", async (request, response) => {
  const userId = readSessionUserId(request);
  if (userId === null) {
    response
      .status(401)
      .json({
        error: {
          code: "AUTH_REQUIRED",
          message: "Sign in to view this order.",
        },
      });
    return;
  }
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    response
      .status(400)
      .json({ error: { code: "INVALID_ORDER", message: "Order not found." } });
    return;
  }
  try {
    const order = await prisma.order.findFirst({
      where: { id, userId },
      include: { orderItems: true },
    });
    if (!order) {
      response
        .status(404)
        .json({
          error: { code: "ORDER_NOT_FOUND", message: "Order not found." },
        });
      return;
    }
    response.json({ order: serializeOrder(order) });
  } catch (error) {
    console.error(
      "Order lookup failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(500)
      .json({
        error: {
          code: "ORDER_LOOKUP_FAILED",
          message: "This order is temporarily unavailable.",
        },
      });
  }
});

function serializeOrder(
  order: Prisma.OrderGetPayload<{ include: { orderItems: true } }>,
) {
  return {
    id: order.id,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    orderType: order.orderType,
    deliveryAddress: order.deliveryAddress,
    city: order.city,
    state: order.state,
    postalCode: order.postalCode,
    specialInstructions: order.specialInstructions,
    orderDate: order.orderDate.toISOString(),
    subTotal: Number(order.subTotal),
    tax: Number(order.tax),
    deliveryFee: Number(order.deliveryFee),
    total: Number(order.total),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    items: order.orderItems.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.name,
      price: Number(item.price),
      quantity: item.quantity,
      total: Number(item.total),
    })),
  };
}
