import {
  createVisit,
  createVisitImages,
  createVisitNotes,
  createVisitTreatments,
  deleteVisitImage as deleteVisitImageRepo,
  findActiveVisitsByPetId,
  findVisitImageById,
  findVisitWithCustomerById,
  findVisitWithDetailsById,
  updateVisitById,
  type VisitInsert,
  type VisitRecord,
  type VisitTreatmentRecord,
  type VisitNoteRecord,
  type VisitImageRecord,
} from '../repositories/visit-repository.js';

import { findCustomerByIdForUser } from '../repositories/customer-repository.js';
import { findPetByIdForCustomer } from '../repositories/pet-repository.js';
import { findTreatmentByIdForUser } from '../repositories/treatment-repository.js';
import { badRequest, notFound } from '../lib/app-error.js';
import {
  type CreateVisitBody,
  type UpdateVisitBody,
  type Visit,
  type VisitWithDetails,
  type VisitTreatment,
  type VisitNote,
  type VisitImage,
} from '@kalimere/types/visits';
import { buildPetScopePrefix, s3Service } from './s3.js';

function cleanNullableString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toIsoString(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toNullableIsoString(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return toIsoString(value);
}

function toDateOnlyValue(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDateOnly(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function serializeVisit(record: VisitRecord): Visit {
  return {
    id: record.id,
    petId: record.petId,
    customerId: record.customerId,
    status: record.status,
    scheduledStartAt: toIsoString(record.scheduledStartAt),
    scheduledEndAt: toNullableIsoString(record.scheduledEndAt),
    completedAt: toNullableIsoString(record.completedAt),
    title: cleanNullableString(record.title),
    description: cleanNullableString(record.description),
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt),
  };
}

function serializeVisitTreatment(record: VisitTreatmentRecord): VisitTreatment {
  return {
    id: record.id,
    visitId: record.visitId,
    treatmentId: record.treatmentId,
    priceCents: record.priceCents ?? null,
    nextDueDate: formatDateOnly(record.nextDueDate),
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt),
  };
}

function serializeVisitNote(record: VisitNoteRecord): VisitNote {
  return {
    id: record.id,
    visitId: record.visitId,
    note: record.note,
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt),
  };
}

async function serializeVisitImage(record: VisitImageRecord): Promise<VisitImage> {
  return {
    id: record.id,
    visitId: record.visitId,
    url: await s3Service.getPresignedDownloadUrl(record.storageKey),
    originalName: record.originalName,
    contentType: record.contentType,
    createdAt: toIsoString(record.createdAt),
  };
}

async function serializeVisitWithDetails(
  record: NonNullable<Awaited<ReturnType<typeof findVisitWithDetailsById>>>
): Promise<VisitWithDetails> {
  const base = serializeVisit(record);
  const images = await Promise.all(record.images.map((img) => serializeVisitImage(img)));
  return {
    ...base,
    treatments: record.visitTreatments.map((item) => serializeVisitTreatment(item)),
    notes: record.notes.map((item) => serializeVisitNote(item)),
    images,
  };
}

async function ensureCustomerAndPetOwnership(userId: string, customerId: string, petId: string) {
  const customer = await findCustomerByIdForUser(userId, customerId);
  if (!customer) throw notFound();

  const pet = await findPetByIdForCustomer(customer.id, petId);
  if (!pet) throw notFound();

  return { customer, pet } as const;
}

async function ensureTreatmentsBelongToUser(
  userId: string,
  treatments: ReadonlyArray<{ treatmentId: string }> | undefined
) {
  if (!treatments || treatments.length === 0) return;

  const ids = new Set<string>();
  for (const treatment of treatments) {
    if (typeof treatment.treatmentId !== 'string' || treatment.treatmentId.length === 0) {
      throw notFound();
    }
    ids.add(treatment.treatmentId);
  }

  await Promise.all(
    Array.from(ids).map(async (treatmentId) => {
      const record = await findTreatmentByIdForUser(userId, treatmentId);
      if (!record) throw notFound();
    })
  );
}

export async function listVisitsForPet(petId: string) {
  const records = await findActiveVisitsByPetId(petId);
  return records.map((record) => serializeVisit(record));
}

export async function createVisitForUser(userId: string, input: CreateVisitBody) {
  const { customer, pet } = await ensureCustomerAndPetOwnership(
    userId,
    input.customerId,
    input.petId
  );

  await ensureTreatmentsBelongToUser(userId, input.treatments);

  const values: Partial<VisitInsert> = {
    petId: pet.id,
    customerId: customer.id,
    status: input.status ?? 'scheduled',
    scheduledStartAt: new Date(input.scheduledStartAt),
    title: cleanNullableString(input.title),
    description: cleanNullableString(input.description),
  };

  if (input.scheduledEndAt !== undefined) {
    values.scheduledEndAt = input.scheduledEndAt ? new Date(input.scheduledEndAt) : null;
  }

  if (input.completedAt !== undefined) {
    values.completedAt = input.completedAt ? new Date(input.completedAt) : null;
  }

  const record = await createVisit(values as VisitInsert);
  if (!record) throw new Error('Failed to create visit');

  const visitId = record.id;

  const treatmentsToCreate =
    input.treatments?.map((treatment) => ({
      visitId,
      treatmentId: treatment.treatmentId,
      priceCents: treatment.priceCents ?? null,
      nextDueDate: toDateOnlyValue(treatment.nextDueDate),
    })) ?? [];

  if (treatmentsToCreate.length > 0) {
    await createVisitTreatments(treatmentsToCreate);
  }

  const notesToCreate =
    input.notes?.map((note) => ({
      visitId,
      note: note.note.trim(),
    })) ?? [];

  if (notesToCreate.length > 0) {
    await createVisitNotes(notesToCreate);
  }

  return serializeVisit(record);
}

async function ensureVisitBelongsToUser(userId: string, visitId: string) {
  const visit = await findVisitWithCustomerById(visitId);
  if (!visit || !visit.customer || visit.customer.userId !== userId || !visit.pet) {
    throw notFound();
  }
  return visit;
}

export async function getVisitForUser(userId: string, visitId: string) {
  await ensureVisitBelongsToUser(userId, visitId);
  const record = await findVisitWithDetailsById(visitId);
  if (!record) throw notFound();
  return serializeVisitWithDetails(record);
}

export async function updateVisitForUser(userId: string, visitId: string, input: UpdateVisitBody) {
  await ensureVisitBelongsToUser(userId, visitId);

  await ensureTreatmentsBelongToUser(userId, input.treatments);

  const updates: Partial<VisitInsert> = {};

  if (input.status !== undefined) updates.status = input.status;
  if (input.scheduledStartAt !== undefined) {
    updates.scheduledStartAt = new Date(input.scheduledStartAt);
  }
  if (input.scheduledEndAt !== undefined) {
    updates.scheduledEndAt = input.scheduledEndAt ? new Date(input.scheduledEndAt) : null;
  }
  if (input.completedAt !== undefined) {
    updates.completedAt = input.completedAt ? new Date(input.completedAt) : null;
  }
  if (input.title !== undefined) {
    updates.title = cleanNullableString(input.title);
  }
  if (input.description !== undefined) {
    updates.description = cleanNullableString(input.description);
  }

  if (Object.keys(updates).length > 0) {
    const updated = await updateVisitById(visitId, updates);
    if (!updated) throw notFound();
  }

  const treatmentsToCreate =
    input.treatments?.map((treatment) => ({
      visitId,
      treatmentId: treatment.treatmentId,
      priceCents: treatment.priceCents ?? null,
      nextDueDate: toDateOnlyValue(treatment.nextDueDate),
    })) ?? [];

  if (treatmentsToCreate.length > 0) {
    await createVisitTreatments(treatmentsToCreate);
  }

  const notesToCreate =
    input.notes?.map((note) => ({
      visitId,
      note: note.note.trim(),
    })) ?? [];

  if (notesToCreate.length > 0) {
    await createVisitNotes(notesToCreate);
  }

  const record = await findVisitWithDetailsById(visitId);
  if (!record) throw notFound();
  return serializeVisitWithDetails(record);
}

export async function getVisitImageUploadUrl(userId: string, visitId: string, contentType: string) {
  const visit = await ensureVisitBelongsToUser(userId, visitId);
  const { customer, pet } = visit;
  if (!customer || !pet) throw notFound();

  const prefix = buildPetScopePrefix({
    userId,
    customerId: customer.id,
    petId: pet.id,
  });

  const uuid = crypto.randomUUID();
  const key = `${prefix}/visits/${visit.id}/${uuid}`;
  const url = await s3Service.getPresignedUploadUrl(key, contentType);
  return { url, key, uuid };
}

export async function deleteVisitImage(userId: string, visitId: string, imageId: string) {
  await ensureVisitBelongsToUser(userId, visitId);

  const image = await findVisitImageById(imageId);
  if (!image || image.visitId !== visitId) {
    throw notFound();
  }

  // Delete from S3 first
  try {
    await s3Service.deleteObject(image.storageKey);
  } catch (error) {
    console.error(`Failed to delete object from S3: ${image.storageKey}`, error);
    // We continue with soft delete even if S3 delete fails, to keep DB consistent
  }

  const deleted = await deleteVisitImageRepo(imageId);
  if (!deleted) throw new Error('Failed to delete visit image');
  return serializeVisitImage(deleted);
}

async function validateVisitImageKey(
  userId: string,
  visit: NonNullable<Awaited<ReturnType<typeof findVisitWithCustomerById>>>,
  key: string
): Promise<boolean> {
  const { customer, pet } = visit;
  if (!customer || !pet) return false;

  const prefix = buildPetScopePrefix({
    userId,
    customerId: customer.id,
    petId: pet.id,
  });

  const expectedPrefix = `${prefix}/visits/${visit.id}/`;
  return key.startsWith(expectedPrefix);
}

export async function addVisitImage(
  userId: string,
  visitId: string,
  key: string,
  originalName?: string,
  contentType?: string
) {
  const visit = await ensureVisitBelongsToUser(userId, visitId);

  // Validate that the key matches the expected pattern for this visit
  const isValid = await validateVisitImageKey(userId, visit, key);
  if (!isValid) {
    throw badRequest({
      message: 'Invalid storage key for this visit',
      code: 'invalid_storage_key',
    });
  }

  const [image] = await createVisitImages([
    {
      visitId,
      storageKey: key,
      originalName,
      contentType,
    },
  ]);
  if (!image) throw new Error('Failed to create visit image');
  return serializeVisitImage(image);
}
