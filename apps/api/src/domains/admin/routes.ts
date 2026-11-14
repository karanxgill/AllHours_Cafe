import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { hasAllowedOrigin, readSessionUserId } from "../auth/session.js";

export const adminRouter = Router();

const categoryInput = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
});
const menuItemInput = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  price: z.number().finite().positive().max(100000),
  categoryId: z.number().int().positive(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  isVegetarian: z.boolean().default(false),
  isVegan: z.boolean().default(false),
  isGlutenFree: z.boolean().default(false),
  isActive: z.boolean().default(true),
  spicyLevel: z.string().trim().max(50).optional().nullable(),
  prepTimeMinutes: z.number().int().positive().max(1440).optional().nullable(),
  calories: z.number().finite().nonnegative().max(100000).optional().nullable(),
});
const orderStatusInput = z.object({
  orderStatus: z.enum([
    "Pending",
    "Confirmed",
    "Preparing",
    "Ready",
    "Delivered",
    "Completed",
    "Cancelled",
  ]),
});

adminRouter.use(async (request, response, next) => {
  const userId = readSessionUserId(request);
  if (!userId) {
    response
      .status(401)
      .json({
        error: {
          code: "AUTH_REQUIRED",
          message: "Sign in with an administrator account to continue.",
        },
      });
    return;
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true },
    });
    if (!user?.isActive || !["Admin", "SuperAdmin"].includes(user.role)) {
      response
        .status(403)
        .json({
          error: {
            code: "ADMIN_REQUIRED",
            message: "This area is available to administrators only.",
          },
        });
      return;
    }
    next();
  } catch (error) {
    console.error(
      "Admin authorization lookup failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(500)
      .json({
        error: {
          code: "ADMIN_UNAVAILABLE",
          message: "The admin service is temporarily unavailable.",
        },
      });
  }
});

adminRouter.get("/dashboard", async (_request, response) => {
  try {
    const [
      menuItems,
      categories,
      reservations,
      unreadContacts,
      orders,
      recentReservations,
      recentContacts,
    ] = await Promise.all([
      prisma.menuItem.count(),
      prisma.category.count(),
      prisma.reservation.count(),
      prisma.contact.count({ where: { isRead: false } }),
      prisma.order.count(),
      prisma.reservation.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          reservationDate: true,
          numberOfGuests: true,
          isConfirmed: true,
        },
      }),
      prisma.contact.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          subject: true,
          createdAt: true,
          isRead: true,
        },
      }),
    ]);
    response.json({
      metrics: { menuItems, categories, reservations, unreadContacts, orders },
      recentReservations,
      recentContacts,
    });
  } catch (error) {
    console.error(
      "Admin dashboard lookup failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(500)
      .json({
        error: {
          code: "ADMIN_DASHBOARD_FAILED",
          message: "The dashboard is temporarily unavailable.",
        },
      });
  }
});

adminRouter.get("/orders", async (_request, response) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { orderDate: "desc" },
      include: { orderItems: true },
    });
    response.json({
      orders: orders.map((order) => ({
        id: order.id,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        orderType: order.orderType,
        orderDate: order.orderDate.toISOString(),
        itemCount: order.orderItems.reduce(
          (count, item) => count + item.quantity,
          0,
        ),
        total: Number(order.total),
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
      })),
    });
  } catch (error) {
    console.error(
      "Admin order list failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(500)
      .json({
        error: {
          code: "ADMIN_ORDERS_FAILED",
          message: "Orders are temporarily unavailable.",
        },
      });
  }
});

adminRouter.get("/orders/:id", async (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    response
      .status(400)
      .json({
        error: { code: "INVALID_ORDER", message: "Choose a valid order." },
      });
    return;
  }
  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { orderItems: { orderBy: { id: "asc" } } },
    });
    if (!order) {
      response
        .status(404)
        .json({
          error: {
            code: "ORDER_NOT_FOUND",
            message: "That order could not be found.",
          },
        });
      return;
    }
    response.json({
      order: {
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
        deliveryTime: order.deliveryTime?.toISOString() ?? null,
        orderDate: order.orderDate.toISOString(),
        subTotal: Number(order.subTotal),
        deliveryFee: Number(order.deliveryFee),
        tax: Number(order.tax),
        total: Number(order.total),
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        items: order.orderItems.map((item) => ({
          id: item.id,
          name: item.name,
          price: Number(item.price),
          quantity: item.quantity,
          total: Number(item.total),
        })),
      },
    });
  } catch (error) {
    console.error(
      "Admin order detail failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(500)
      .json({
        error: {
          code: "ADMIN_ORDER_FAILED",
          message: "Order details are temporarily unavailable.",
        },
      });
  }
});

adminRouter.patch("/orders/:id/status", async (request, response) => {
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
  const id = Number(request.params.id);
  const parsed = orderStatusInput.safeParse(request.body);
  if (!Number.isSafeInteger(id) || id < 1 || !parsed.success) {
    response
      .status(400)
      .json({
        error: {
          code: "INVALID_ORDER_STATUS",
          message: "Choose a valid order status.",
        },
      });
    return;
  }
  try {
    const order = await prisma.order.update({
      where: { id },
      data: { orderStatus: parsed.data.orderStatus },
      select: { id: true, orderStatus: true },
    });
    response.json({ order });
  } catch (error) {
    console.error(
      "Admin order status update failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(404)
      .json({
        error: {
          code: "ORDER_NOT_FOUND",
          message: "That order could not be found.",
        },
      });
  }
});

adminRouter.get("/categories", async (_request, response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { menuItems: true } } },
    });
    response.json({ categories });
  } catch (error) {
    console.error(
      "Admin category lookup failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(500)
      .json({
        error: {
          code: "ADMIN_CATEGORIES_FAILED",
          message: "Categories are temporarily unavailable.",
        },
      });
  }
});

adminRouter.post("/categories", async (request, response) => {
  const parsed = categoryInput.safeParse(request.body);
  if (!parsed.success) {
    response
      .status(400)
      .json({
        error: {
          code: "INVALID_CATEGORY",
          message: "Check the category name, description, and image URL.",
        },
      });
    return;
  }
  try {
    const category = await prisma.category.create({
      data: {
        ...parsed.data,
        description: parsed.data.description || null,
        imageUrl: parsed.data.imageUrl || null,
      },
    });
    response.status(201).json({ category });
  } catch (error) {
    console.error(
      "Admin category creation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(500)
      .json({
        error: {
          code: "CATEGORY_CREATE_FAILED",
          message: "The category could not be saved.",
        },
      });
  }
});

adminRouter.put("/categories/:id", async (request, response) => {
  const id = Number(request.params.id);
  const parsed = categoryInput
    .extend({ isActive: z.boolean() })
    .safeParse(request.body);
  if (!Number.isInteger(id) || id < 1 || !parsed.success) {
    response
      .status(400)
      .json({
        error: {
          code: "INVALID_CATEGORY",
          message: "Check the category details and try again.",
        },
      });
    return;
  }
  try {
    const category = await prisma.category.update({
      where: { id },
      data: {
        ...parsed.data,
        description: parsed.data.description || null,
        imageUrl: parsed.data.imageUrl || null,
      },
    });
    response.json({ category });
  } catch (error) {
    console.error(
      "Admin category update failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(404)
      .json({
        error: {
          code: "CATEGORY_NOT_FOUND",
          message: "That category could not be found.",
        },
      });
  }
});

adminRouter.get("/menu-items", async (_request, response) => {
  try {
    const [items, categories] = await Promise.all([
      prisma.menuItem.findMany({
        orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
        include: { category: { select: { name: true } } },
      }),
      prisma.category.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, isActive: true },
      }),
    ]);
    response.json({
      items: items.map((item) => ({
        ...item,
        price: Number(item.price),
        calories: item.calories === null ? null : Number(item.calories),
      })),
      categories,
    });
  } catch (error) {
    console.error(
      "Admin menu lookup failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(500)
      .json({
        error: {
          code: "ADMIN_MENU_FAILED",
          message: "Menu items are temporarily unavailable.",
        },
      });
  }
});

adminRouter.post("/menu-items", async (request, response) => {
  const parsed = menuItemInput.safeParse(request.body);
  if (!parsed.success) {
    response
      .status(400)
      .json({
        error: {
          code: "INVALID_MENU_ITEM",
          message: "Check the required item details and try again.",
        },
      });
    return;
  }
  try {
    const { categoryId, ...data } = parsed.data;
    const item = await prisma.menuItem.create({
      data: {
        ...data,
        calories: data.calories ?? null,
        category: { connect: { id: categoryId } },
      },
    });
    response
      .status(201)
      .json({
        item: {
          ...item,
          price: Number(item.price),
          calories: item.calories === null ? null : Number(item.calories),
        },
      });
  } catch (error) {
    console.error(
      "Admin menu item creation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(400)
      .json({
        error: {
          code: "MENU_ITEM_CREATE_FAILED",
          message:
            "The item could not be saved. Confirm its category is available.",
        },
      });
  }
});

adminRouter.put("/menu-items/:id", async (request, response) => {
  const id = Number(request.params.id);
  const parsed = menuItemInput.safeParse(request.body);
  if (!Number.isInteger(id) || id < 1 || !parsed.success) {
    response
      .status(400)
      .json({
        error: {
          code: "INVALID_MENU_ITEM",
          message: "Check the item details and try again.",
        },
      });
    return;
  }
  try {
    const { categoryId, ...data } = parsed.data;
    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        ...data,
        calories: data.calories ?? null,
        category: { connect: { id: categoryId } },
      },
    });
    response.json({
      item: {
        ...item,
        price: Number(item.price),
        calories: item.calories === null ? null : Number(item.calories),
      },
    });
  } catch (error) {
    console.error(
      "Admin menu item update failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(404)
      .json({
        error: {
          code: "MENU_ITEM_NOT_FOUND",
          message: "That item or category could not be found.",
        },
      });
  }
});
