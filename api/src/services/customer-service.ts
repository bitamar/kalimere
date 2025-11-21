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

import { buildPetScopePrefix, s3Service } from './s3.js';

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

async function serializePet(record: PetRecord): Promise<PetDto> {
  let imageUrl: string | null = null;
  if (record.imageUrl) {
    imageUrl = await s3Service.getPresignedDownloadUrl(record.imageUrl);
  }

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
    imageUrl,
  };
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
  return Promise.all(records.map((record) => serializePet(record)));
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

async function validatePetImageKey(
  userId: string,
  customerId: string,
  petId: string,
  key: string
): Promise<boolean> {
  const prefix = buildPetScopePrefix({
    userId,
    customerId,
    petId,
  });

  const expectedPrefix = `${prefix}/profile-`;
  return key.startsWith(expectedPrefix);
}

export async function updatePetForCustomer(
  customerId: string,
  petId: string,
  input: UpdatePetBody,
  userId: string
) {
  const record = await findPetByIdForCustomer(customerId, petId);
  if (!record) throw notFound();

  const updates: Partial<PetInsert> = { updatedAt: new Date() };
  let imageToDelete: string | null = null;
  if (input.name !== undefined) updates.name = input.name;
  if (input.type !== undefined) updates.type = input.type;
  if (input.gender !== undefined) updates.gender = input.gender;
  if (input.breed !== undefined) updates.breed = input.breed ?? null;
  if (input.isSterilized !== undefined) updates.isSterilized = input.isSterilized ?? null;
  if (input.isCastrated !== undefined) updates.isCastrated = input.isCastrated ?? null;
  if (input.imageUrl !== undefined) {
    if (input.imageUrl === null) {
      imageToDelete = record.imageUrl ?? null;
      updates.imageUrl = null;
    } else {
      const isValid = await validatePetImageKey(userId, customerId, petId, input.imageUrl);
      if (!isValid) {
        throw badRequest({
          message: 'Invalid storage key for this pet',
          code: 'invalid_storage_key',
        });
      }
      imageToDelete =
        record.imageUrl && record.imageUrl !== input.imageUrl ? record.imageUrl : null;
      updates.imageUrl = input.imageUrl;
    }
  }
  if (input.dateOfBirth !== undefined) {
    updates.dateOfBirth =
      typeof input.dateOfBirth === 'string' ? new Date(input.dateOfBirth) : null;
  }

  const updated = await updatePetById(petId, updates);
  if (!updated) throw new Error('Failed to update pet');

  if (imageToDelete) {
    await s3Service.deleteObject(imageToDelete);
  }

  return serializePet(updated);
}

export async function deletePetForCustomer(customerId: string, petId: string) {
  const record = await findPetByIdForCustomer(customerId, petId);
  if (!record) throw notFound();
  await softDeletePetById(petId);
  return { ok: true } as const;
}

export async function getPetImageUploadUrl(
  userId: string,
  customerId: string,
  petId: string,
  contentType: string
) {
  const customer = await findCustomerByIdForUser(userId, customerId);
  if (!customer) throw notFound();

  const prefix = buildPetScopePrefix({
    userId,
    customerId: customer.id,
    petId,
  });
  const key = `${prefix}/profile-${Date.now()}`;
  const url = await s3Service.getPresignedUploadUrl(key, contentType);
  return { url, key };
}
