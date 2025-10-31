import { z } from 'zod';
import {
  isoDateTime,
  nullableIsoDateTime,
  nullableNumber,
  nullableString,
  nonEmptyString,
  optionalNullableIsoDateTime,
  optionalNullableDateInput,
  optionalNullableNumber,
  optionalNullableString,
  uuidSchema,
} from './common.js';

export const visitStatusSchema = z.enum(['scheduled', 'completed', 'cancelled']);

export const visitTreatmentSchema = z.object({
  id: uuidSchema,
  visitId: uuidSchema,
  treatmentId: uuidSchema,
  priceCents: nullableNumber,
  nextDueDate: z.union([z.string(), z.null()]),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const visitNoteSchema = z.object({
  id: uuidSchema,
  visitId: uuidSchema,
  note: nonEmptyString,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const visitSchema = z.object({
  id: uuidSchema,
  petId: uuidSchema,
  customerId: uuidSchema,
  status: visitStatusSchema,
  scheduledStartAt: isoDateTime,
  scheduledEndAt: nullableIsoDateTime,
  completedAt: nullableIsoDateTime,
  title: nullableString,
  description: nullableString,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const visitWithDetailsSchema = visitSchema.extend({
  treatments: z.array(visitTreatmentSchema),
  notes: z.array(visitNoteSchema),
});

export const visitResponseSchema = z.object({
  visit: visitSchema,
});

export const visitWithDetailsResponseSchema = z.object({
  visit: visitWithDetailsSchema,
});

export const visitsListResponseSchema = z.object({
  visits: z.array(visitSchema),
});

const visitTreatmentInputSchema = z
  .object({
    treatmentId: uuidSchema,
    priceCents: optionalNullableNumber,
    nextDueDate: optionalNullableDateInput,
  })
  .strict();

const visitNoteInputSchema = z
  .object({
    note: nonEmptyString,
  })
  .strict();

export const createVisitBodySchema = z
  .object({
    petId: uuidSchema,
    customerId: uuidSchema,
    scheduledStartAt: isoDateTime,
    scheduledEndAt: optionalNullableIsoDateTime,
    status: visitStatusSchema.optional(),
    completedAt: optionalNullableIsoDateTime,
    title: optionalNullableString,
    description: optionalNullableString,
    treatments: z.array(visitTreatmentInputSchema).optional(),
    notes: z.array(visitNoteInputSchema).optional(),
  })
  .strict();

export const updateVisitParamsSchema = z.object({
  id: uuidSchema,
});

export const updateVisitBodySchema = z
  .object({
    status: visitStatusSchema.optional(),
    scheduledStartAt: isoDateTime.optional(),
    scheduledEndAt: optionalNullableIsoDateTime,
    completedAt: optionalNullableIsoDateTime,
    title: optionalNullableString,
    description: optionalNullableString,
    treatments: z.array(visitTreatmentInputSchema).optional(),
    notes: z.array(visitNoteInputSchema).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!Object.values(data).some((value) => value !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided',
        path: [],
      });
    }
  });

export const visitParamsSchema = z.object({
  id: uuidSchema,
});

export type VisitStatus = z.infer<typeof visitStatusSchema>;
export type VisitTreatment = z.infer<typeof visitTreatmentSchema>;
export type VisitNote = z.infer<typeof visitNoteSchema>;
export type Visit = z.infer<typeof visitSchema>;
export type VisitWithDetails = z.infer<typeof visitWithDetailsSchema>;
export type VisitResponse = z.infer<typeof visitResponseSchema>;
export type VisitWithDetailsResponse = z.infer<typeof visitWithDetailsResponseSchema>;
export type VisitsListResponse = z.infer<typeof visitsListResponseSchema>;
export type CreateVisitBody = z.infer<typeof createVisitBodySchema>;
export type UpdateVisitParams = z.infer<typeof updateVisitParamsSchema>;
export type UpdateVisitBody = z.infer<typeof updateVisitBodySchema>;
export type VisitParams = z.infer<typeof visitParamsSchema>;
