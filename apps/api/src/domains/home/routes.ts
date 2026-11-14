import { Router } from "express";
import { prisma } from "../../db/prisma.js";

export const homeRouter = Router();

homeRouter.get("/", async (_request, response) => {
  try {
    const records = await prisma.menuHighlight.findMany({
      where: { isActive: true, menuItem: { isActive: true } },
      orderBy: [{ section: "asc" }, { displayOrder: "asc" }],
      include: {
        menuItem: {
          select: {
            name: true,
            description: true,
            imageUrl: true,
            category: { select: { name: true } },
          },
        },
      },
    });

    const sections = new Map<
      string,
      Array<{
        id: number;
        title: string;
        description: string;
        imageUrl: string;
      }>
    >();

    for (const record of records) {
      const items = sections.get(record.section) ?? [];
      items.push({
        id: record.id,
        title: record.customTitle || record.menuItem.name,
        description:
          record.customDescription || record.menuItem.description || "",
        imageUrl:
          record.customImageUrl ||
          record.menuItem.imageUrl ||
          "/images/Items/placeholder.jpg",
      });
      sections.set(record.section, items);
    }

    response.json({
      highlights: [...sections].map(([section, items]) => ({ section, items })),
    });
  } catch (error) {
    console.error(
      "Home highlights lookup failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    response
      .status(500)
      .json({
        error: {
          code: "HOME_LOOKUP_FAILED",
          message: "Home page content is temporarily unavailable.",
        },
      });
  }
});
