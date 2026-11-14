import { z } from "zod";

const email = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(255)
  .transform((value) => value.toLowerCase());

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required.").max(100),
    email,
    password: z
      .string()
      .min(6, "Password must be at least 6 characters.")
      .max(100),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords do not match.",
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required."),
  rememberMe: z.boolean().default(false),
});
