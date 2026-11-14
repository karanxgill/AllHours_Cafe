import { config } from "dotenv";
import { z } from "zod";

config({ path: ".env" });

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(5001),
    WEB_ORIGIN: z
      .string()
      .default("http://localhost:5173")
      .transform((value) => value.split(",").map((origin) => origin.trim()))
      .pipe(z.array(z.string().url()).min(1)),
    DATABASE_URL: z.string().url({ error: "DATABASE_URL must be a valid URL." }),
    SESSION_SECRET: z
      .string()
      .min(32, "SESSION_SECRET must contain at least 32 characters."),
  })
  .superRefine((values, context) => {
    if (values.NODE_ENV === "production") {
      values.WEB_ORIGIN.forEach((origin, index) => {
        if (new URL(origin).protocol !== "https:") {
          context.addIssue({
            code: "custom",
            path: ["WEB_ORIGIN", index],
            message: "WEB_ORIGIN must use HTTPS in production.",
          });
        }
      });
    }
  });

export const env = envSchema.parse(process.env);
