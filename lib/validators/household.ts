import { z } from "zod";
import { kidAgeSchema, uuidSchema } from "./index";
import { emailSchema } from "./auth";

const householdNameSchema = z
  .string()
  .trim()
  .min(1, "Household name is required")
  .max(80, "Household name is too long");

export const createHouseholdSchema = z.object({
  name: householdNameSchema,
});
export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;

export const updateHouseholdSchema = z.object({
  name: householdNameSchema,
});
export type UpdateHouseholdInput = z.infer<typeof updateHouseholdSchema>;

export const addAdultByEmailSchema = z.object({
  email: emailSchema,
});
export type AddAdultByEmailInput = z.infer<typeof addAdultByEmailSchema>;

const kidNameSchema = z
  .string()
  .trim()
  .min(1, "Kid's name is required")
  .max(40, "Name is too long");

export const addKidSchema = z.object({
  displayName: kidNameSchema,
  ageYears: kidAgeSchema,
});
export type AddKidInput = z.infer<typeof addKidSchema>;

export const memberIdSchema = z.object({
  memberId: uuidSchema,
});
