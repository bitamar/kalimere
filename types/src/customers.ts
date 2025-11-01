import { z } from 'zod';
import {
  nonEmptyString,
  nullableEmail,
  nullableString,
  optionalNullableBoolean,
  optionalNullableDateInput,
  optionalNullableEmail,
  optionalNullableString,
  uuidSchema,
} from './common.js';

const allowedImageMimeTypes = ['image/png', 'image/jpeg', 'image/webp'] as const;

const imageDataUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value.startsWith('data:')) return false;
    const match = /^data:([^;]+);base64,/.exec(value);
    if (!match) return false;
    return (allowedImageMimeTypes as readonly string[]).includes(match[1] ?? '');
  }, "Invalid image data URL");

export const customerSchema = z.object({
  id: uuidSchema,
  name: z.string().trim(),
  email: nullableEmail,
  phone: nullableString,
  address: nullableString,
  petsCount: z.number().int().nonnegative(),
});

export const customersListResponseSchema = z.object({
  customers: z.array(customerSchema),
});

export const createCustomerBodySchema = z
  .object({
    name: nonEmptyString,
    email: optionalNullableEmail,
    phone: optionalNullableString,
    address: optionalNullableString,
  })
  .strict();

export const customerResponseSchema = z.object({
  customer: customerSchema,
});

export const updateCustomerParamsSchema = z.object({
  id: uuidSchema,
});

export const updateCustomerBodySchema = z
  .object({
    name: nonEmptyString.optional(),
    email: optionalNullableEmail,
    phone: optionalNullableString,
    address: optionalNullableString,
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

export const deleteCustomerParamsSchema = z.object({
  id: uuidSchema,
});

const petTypeSchema = z.enum(['dog', 'cat']);
const petGenderSchema = z.enum(['male', 'female']);

export const createPetParamsSchema = z.object({
  id: uuidSchema,
});

export const createPetBodySchema = z
  .object({
    name: nonEmptyString,
    type: petTypeSchema,
    gender: petGenderSchema,
    dateOfBirth: optionalNullableDateInput,
    breed: optionalNullableString,
    isSterilized: optionalNullableBoolean,
    isCastrated: optionalNullableBoolean,
  })
  .strict();

export const petSchema = z.object({
  id: uuidSchema,
  customerId: uuidSchema,
  name: nonEmptyString,
  type: petTypeSchema,
  gender: petGenderSchema,
  dateOfBirth: z.union([z.string(), z.null()]),
  breed: nullableString,
  isSterilized: z.union([z.boolean(), z.null()]),
  isCastrated: z.union([z.boolean(), z.null()]),
  imageUrl: z.union([z.string(), z.null()]),
});

export const petResponseSchema = z.object({
  pet: petSchema,
});

export const customerPetsParamsSchema = z.object({
  id: uuidSchema,
});

export const customerPetParamsSchema = z.object({
  customerId: uuidSchema,
  petId: uuidSchema,
});

export const customerPetsResponseSchema = z.object({
  pets: z.array(petSchema),
});

export const updatePetBodySchema = z
  .object({
    name: nonEmptyString.optional(),
    type: petTypeSchema.optional(),
    gender: petGenderSchema.optional(),
    dateOfBirth: optionalNullableDateInput,
    breed: optionalNullableString,
    isSterilized: optionalNullableBoolean,
    isCastrated: optionalNullableBoolean,
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

export const updatePetImageBodySchema = z
  .object({
    dataUrl: imageDataUrlSchema,
  })
  .strict();

export type Customer = z.infer<typeof customerSchema>;
export type CustomersListResponse = z.infer<typeof customersListResponseSchema>;
export type CustomerResponse = z.infer<typeof customerResponseSchema>;
export type CreateCustomerBody = z.infer<typeof createCustomerBodySchema>;
export type UpdateCustomerParams = z.infer<typeof updateCustomerParamsSchema>;
export type UpdateCustomerBody = z.infer<typeof updateCustomerBodySchema>;
export type DeleteCustomerParams = z.infer<typeof deleteCustomerParamsSchema>;
export type Pet = z.infer<typeof petSchema>;
export type PetResponse = z.infer<typeof petResponseSchema>;
export type CreatePetParams = z.infer<typeof createPetParamsSchema>;
export type CreatePetBody = z.infer<typeof createPetBodySchema>;
export type CustomerPetsParams = z.infer<typeof customerPetsParamsSchema>;
export type CustomerPetParams = z.infer<typeof customerPetParamsSchema>;
export type CustomerPetsResponse = z.infer<typeof customerPetsResponseSchema>;
export type UpdatePetBody = z.infer<typeof updatePetBodySchema>;
export type UpdatePetImageBody = z.infer<typeof updatePetImageBodySchema>;
