import { z } from 'zod';
import {
  createCustomer,
  findActiveCustomersByUserId,
  findCustomerByIdForUser,
  softDeleteCustomerById,
  updateCustomerById,
  type CustomerInsert,
} from '../repositories/customer-repository.js';
import {
  countPetsForCustomer,
  countPetsForCustomerIds,
  createPet,
  findActivePetsByCustomerId,
  findPetByIdForCustomer,
  updatePetById,
  softDeletePetById,
  type PetInsert,
  type PetRecord,
} from '../repositories/pet-repository.js';
import { badRequest, notFound } from '../lib/app-error.js';
import {
  customerSchema,
  petSchema,
  type CreateCustomerBody,
  type UpdateCustomerBody,
  type CreatePetBody,
  type UpdatePetBody,
} from '@kalimere/types/customers';

type CustomerDto = z.infer<typeof customerSchema>;
type PetDto = z.infer<typeof petSchema>;

type CustomerRecord = Awaited<ReturnType<typeof findActiveCustomersByUserId>>[number];

function cleanNullableString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildCustomer(record: CustomerRecord, petsCount: number): CustomerDto {
  return {
    id: record.id,
    name: record.name.trim(),
    email: cleanNullableString(record.email),
    phone: cleanNullableString(record.phone),
    address: cleanNullableString(record.address),
    petsCount,
  };
}

function normalizeDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function serializePet(record: PetRecord): PetDto {
  return {
    id: record.id,
    customerId: record.customerId,
    name: record.name.trim(),
    type: record.type,
    gender: record.gender,
    dateOfBirth: normalizeDate(record.dateOfBirth ?? null),
    breed: cleanNullableString(record.breed),
    isSterilized: record.isSterilized ?? null,
    isCastrated: record.isCastrated ?? null,
    imageUrl: record.imageUrl ?? null,
  };
}

const allowedImageMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

function normalizeImageDataUrl(raw: string): string {
  const value = raw.trim();
  const match = /^data:([^;]+);base64,(.+)$/i.exec(value);
  if (!match) {
    throw badRequest({
      code: 'invalid_image_data',
      message: 'Invalid image data URL format',
    });
  }

  const mimeType = (match[1] ?? '').toLowerCase();
  if (!allowedImageMimeTypes.has(mimeType)) {
    throw badRequest({
      code: 'unsupported_image_type',
      message: 'Unsupported image type',
    });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[2] ?? '', 'base64');
  } catch (error) {
    throw badRequest({
      code: 'invalid_image_data',
      message: 'Image data must be valid base64',
      cause: error,
    });
  }

  if (buffer.length === 0) {
    throw badRequest({
      code: 'invalid_image_data',
      message: 'Image data cannot be empty',
    });
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw badRequest({
      code: 'image_too_large',
      message: 'Image exceeds the 2MB size limit',
    });
  }

  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

export async function listCustomersForUser(userId: string) {
  const records = await findActiveCustomersByUserId(userId);
  const counts = await countPetsForCustomerIds(records.map((record) => record.id));
  return records.map((record) => buildCustomer(record, counts.get(record.id) ?? 0));
}

export async function createCustomerForUser(userId: string, input: CreateCustomerBody) {
  const record = await createCustomer({
    userId,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
  });
  if (!record) throw new Error('Failed to create customer');
  return buildCustomer(record, 0);
}

export async function getCustomerForUser(userId: string, customerId: string) {
  const record = await findCustomerByIdForUser(userId, customerId);
  if (!record) throw notFound();
  const petsCount = await countPetsForCustomer(record.id);
  return buildCustomer(record, petsCount);
}

export async function updateCustomerForUser(
  userId: string,
  customerId: string,
  input: UpdateCustomerBody
) {
  const updates: Partial<CustomerInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.email !== undefined) updates.email = input.email ?? null;
  if (input.phone !== undefined) updates.phone = input.phone ?? null;
  if (input.address !== undefined) updates.address = input.address ?? null;

  const record = await updateCustomerById(customerId, userId, updates);
  if (!record) throw notFound();
  const petsCount = await countPetsForCustomer(record.id);
  return buildCustomer(record, petsCount);
}

export async function deleteCustomerForUser(userId: string, customerId: string) {
  const record = await softDeleteCustomerById(customerId, userId);
  if (!record) throw notFound();
  return { ok: true } as const;
}

export async function listPetsForCustomer(customerId: string) {
  const records = await findActivePetsByCustomerId(customerId);
  return records.map((record) => serializePet(record));
}

export async function getPetForCustomer(customerId: string, petId: string) {
  const record = await findPetByIdForCustomer(customerId, petId);
  if (!record) throw notFound();
  return serializePet(record);
}

export async function createPetForCustomer(customerId: string, input: CreatePetBody) {
  const values: Partial<PetInsert> = {
    customerId,
    name: input.name,
    type: input.type,
    gender: input.gender,
    breed: input.breed ?? null,
    isSterilized: input.isSterilized ?? null,
    isCastrated: input.isCastrated ?? null,
    imageUrl: null,
  };

  if (typeof input.dateOfBirth === 'string') {
    values.dateOfBirth = new Date(input.dateOfBirth);
  } else {
    values.dateOfBirth = null;
  }

  const record = await createPet(values as PetInsert);
  if (!record) throw new Error('Failed to create pet');
  return serializePet(record);
}

export async function updatePetForCustomer(
  customerId: string,
  petId: string,
  input: UpdatePetBody
) {
  const record = await findPetByIdForCustomer(customerId, petId);
  if (!record) throw notFound();

  const updates: Partial<PetInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.type !== undefined) updates.type = input.type;
  if (input.gender !== undefined) updates.gender = input.gender;
  if (input.breed !== undefined) updates.breed = input.breed ?? null;
  if (input.isSterilized !== undefined) updates.isSterilized = input.isSterilized ?? null;
  if (input.isCastrated !== undefined) updates.isCastrated = input.isCastrated ?? null;
  if (input.dateOfBirth !== undefined) {
    updates.dateOfBirth =
      typeof input.dateOfBirth === 'string' ? new Date(input.dateOfBirth) : null;
  }

  const updated = await updatePetById(petId, updates);
  if (!updated) throw new Error('Failed to update pet');
  return serializePet(updated);
}

export async function updatePetImageForCustomer(
  customerId: string,
  petId: string,
  dataUrl: string
) {
  const record = await findPetByIdForCustomer(customerId, petId);
  if (!record) throw notFound();

  const normalized = normalizeImageDataUrl(dataUrl);
  const updated = await updatePetById(petId, { imageUrl: normalized });
  if (!updated) throw new Error('Failed to update pet image');
  return serializePet(updated);
}

export async function removePetImageForCustomer(customerId: string, petId: string) {
  const record = await findPetByIdForCustomer(customerId, petId);
  if (!record) throw notFound();

  const updated = await updatePetById(petId, { imageUrl: null });
  if (!updated) throw new Error('Failed to remove pet image');
  return serializePet(updated);
}

export async function deletePetForCustomer(customerId: string, petId: string) {
  const record = await findPetByIdForCustomer(customerId, petId);
  if (!record) throw notFound();
  await softDeletePetById(petId);
  return { ok: true } as const;
}
