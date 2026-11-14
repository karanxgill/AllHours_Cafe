import { Router } from "express";
import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../db/prisma.js";

export const menuRouter = Router();

menuRouter.get("/categories", async (_request, response) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true, imageUrl: true },
    });
    response.json({ categories });
  } catch (error) {
    console.error(
      "Menu categories lookup failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(500)
      .json({
        error: {
          code: "MENU_LOOKUP_FAILED",
          message: "Menu is temporarily unavailable.",
        },
      });
  }
});

menuRouter.get("/items", async (request, response) => {
  const categoryIdValue = request.query.categoryId;
  const categoryId =
    typeof categoryIdValue === "string" && categoryIdValue !== "all"
      ? Number(categoryIdValue)
      : undefined;
  if (
    categoryId !== undefined &&
    (!Number.isInteger(categoryId) || categoryId < 1)
  ) {
    response
      .status(400)
      .json({
        error: {
          code: "INVALID_CATEGORY",
          message: "Choose a valid menu category.",
        },
      });
    return;
  }

  const search =
    typeof request.query.search === "string"
      ? request.query.search.trim().slice(0, 100)
      : "";
  const where: Prisma.MenuItemWhereInput = {
    isActive: true,
    category: { isActive: true },
    ...(categoryId ? { categoryId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { category: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(request.query.vegetarian === "true" ? { isVegetarian: true } : {}),
    ...(request.query.vegan === "true" ? { isVegan: true } : {}),
    ...(request.query.glutenFree === "true" ? { isGlutenFree: true } : {}),
  };

  try {
    const records = await prisma.menuItem.findMany({
      where,
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        isVegetarian: true,
        isVegan: true,
        isGlutenFree: true,
        categoryId: true,
        spicyLevel: true,
        category: { select: { name: true } },
      },
    });
    response.json({
      items: records.map((item) => ({ ...item, price: Number(item.price) })),
    });
  } catch (error) {
    console.error(
      "Menu items lookup failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(500)
      .json({
        error: {
          code: "MENU_LOOKUP_FAILED",
          message: "Menu items are temporarily unavailable.",
        },
      });
  }
});
