import { z } from "zod";

/** Valid mark: null or integer 0-100 */
export const markValueSchema = z.nullable(z.number().int().min(0).max(100));

/** The 9 actual subject keys from the schema */
export const SUBJECT_KEYS = [
  "sinhala", "buddhism", "maths", "science", "english", "history",
  "categoryI", "categoryII", "categoryIII",
] as const;

export type SubjectKey = typeof SUBJECT_KEYS[number];

/** Term values matching the Prisma enum */
export const TERM_VALUES = ["TERM_1", "TERM_2", "TERM_3"] as const;

/** Marks object: all 9 subjects required (each nullable) */
export const marksObjectSchema = z.object({
  sinhala: markValueSchema,
  buddhism: markValueSchema,
  maths: markValueSchema,
  science: markValueSchema,
  english: markValueSchema,
  history: markValueSchema,
  categoryI: markValueSchema,
  categoryII: markValueSchema,
  categoryIII: markValueSchema,
});

/** POST /api/marks body */
export const singleMarkBodySchema = z.object({
  studentId: z.string().min(1),
  year: z.number().int(),
  term: z.enum(TERM_VALUES),
  marks: marksObjectSchema,
});

/** PATCH /api/marks/batch body */
export const batchUpsertBodySchema = z.object({
  classId: z.string().min(1),
  term: z.enum(TERM_VALUES),
  year: z.number().int(),
  subject: z.enum(SUBJECT_KEYS),
  entries: z.array(
    z.object({
      studentId: z.string().min(1),
      markValue: markValueSchema,
    })
  ).min(1).max(100),
});

/** GET /api/marks query params */
export const queryParamsSchema = z.object({
  studentId: z.string().optional(),
  classId: z.string().optional(),
  term: z.enum(TERM_VALUES).optional(),
  year: z.coerce.number().int().optional(),
});
