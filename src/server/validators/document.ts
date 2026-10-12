import "./zod-hebrew";
import { z } from "zod";
import {
  DOCUMENT_CATEGORIES,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
} from "@/lib/client-documents";

const category = z
  .union([z.enum(DOCUMENT_CATEGORIES), z.literal("")])
  .optional()
  .transform((v) => (v ? v : null));

const description = z
  .string()
  .trim()
  .max(MAX_DESCRIPTION_LENGTH, `תיאור — עד ${MAX_DESCRIPTION_LENGTH} תווים`)
  .optional()
  .default("");

/** The non-file fields of an upload ("מסמכים" on the client card). */
export const documentUploadSchema = z.object({
  clientId: z.string().min(1, "מזהה לקוח חסר"),
  category,
  description,
});

/** Rename / description / category of an uploaded document. */
export const documentUpdateSchema = z.object({
  id: z.string().min(1, "מזהה מסמך חסר"),
  name: z
    .string()
    .trim()
    .min(1, "נא לכתוב שם לקובץ")
    .max(MAX_NAME_LENGTH, `שם הקובץ — עד ${MAX_NAME_LENGTH} תווים`),
  category,
  description,
});
