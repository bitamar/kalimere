import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  createTestUserWithSession,
  resetDb,
  seedCustomer,
  seedPet,
  seedTreatment,
} from '../utils/db.js';
import {
  createVisitForUser,
  getVisitForUser,
  getVisitImageUploadUrl,
  listVisitsForPet,
  updateVisitForUser,
  addVisitImage,
  deleteVisitImage,
} from '../../src/services/visit-service.js';
import { db } from '../../src/db/client.js';
import { visitImages, visitNotes, visitTreatments } from '../../src/db/schema.js';
import { s3Service } from '../../src/services/s3.js';

async function createUserWithRecords() {
  const { user } = await createTestUserWithSession();
  const customer = await seedCustomer(user.id, { name: 'Owner' });
  const pet = await seedPet(customer.id, { name: 'Fido', type: 'dog' });
  const treatment = await seedTreatment(user.id, { name: 'Heartworm prevention', price: 4200 });
  return { user, customer, pet, treatment } as const;
}

describe('visit-service', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetDb();
  });

  afterEach(async () => {
    await resetDb();
    vi.restoreAllMocks();
  });

  it('creates a visit with normalized fields and related records', async () => {
    const { user, customer, pet, treatment } = await createUserWithRecords();

    const visit = await createVisitForUser(user.id, {
      customerId: customer.id,
      petId: pet.id,
      scheduledStartAt: '2025-01-01T10:00:00.000Z',
      scheduledEndAt: '2025-01-01T10:30:00.000Z',
      completedAt: undefined,
      title: '  Annual Checkup  ',
      description: '   ',
      treatments: [
        {
          treatmentId: treatment.id,
          priceCents: 5150,
          nextDueDate: '2025-02-10',
        },
      ],
      notes: [{ note: '  Monitor weight  ' }],
    });

    expect(visit).toMatchObject({
      customerId: customer.id,
      petId: pet.id,
      status: 'scheduled',
      scheduledStartAt: '2025-01-01T10:00:00.000Z',
      scheduledEndAt: '2025-01-01T10:30:00.000Z',
      completedAt: null,
      title: 'Annual Checkup',
      description: null,
    });

    const treatmentsRows = await db.query.visitTreatments.findMany({
      where: eq(visitTreatments.visitId, visit.id),
    });
    expect(treatmentsRows).toHaveLength(1);
    expect(treatmentsRows[0]).toMatchObject({
      treatmentId: treatment.id,
      priceCents: 5150,
    });
    expect(new Date(treatmentsRows[0].nextDueDate ?? undefined).toISOString()).toBe(
      '2025-02-10T00:00:00.000Z'
    );

    const notesRows = await db.query.visitNotes.findMany({
      where: eq(visitNotes.visitId, visit.id),
    });
    expect(notesRows).toHaveLength(1);
    expect(notesRows[0].note).toBe('Monitor weight');
  });

  it('lists visits for a pet ordered by scheduled time', async () => {
    const { user, customer, pet, treatment } = await createUserWithRecords();

    const earlier = await createVisitForUser(user.id, {
      customerId: customer.id,
      petId: pet.id,
      scheduledStartAt: '2025-01-01T09:00:00.000Z',
      title: 'Morning visit',
    });

    const later = await createVisitForUser(user.id, {
      customerId: customer.id,
      petId: pet.id,
      scheduledStartAt: '2025-01-02T09:00:00.000Z',
      scheduledEndAt: null,
      completedAt: undefined,
      status: 'scheduled',
      title: 'Later visit',
      treatments: [
        {
          treatmentId: treatment.id,
          priceCents: null,
          nextDueDate: null,
        },
      ],
    });

    const visits = await listVisitsForPet(pet.id);
    expect(visits.map((item) => item.id)).toEqual([later.id, earlier.id]);
    expect(visits[0]).toMatchObject({
      title: 'Later visit',
      scheduledEndAt: null,
      customerId: customer.id,
    });
  });

  it('returns visit details with serialized treatments and notes for owner', async () => {
    const { user, customer, pet, treatment } = await createUserWithRecords();

    const visit = await createVisitForUser(user.id, {
      customerId: customer.id,
      petId: pet.id,
      scheduledStartAt: '2025-03-01T15:00:00.000Z',
      treatments: [
        {
          treatmentId: treatment.id,
          priceCents: 7600,
          nextDueDate: '2025-04-15',
        },
      ],
      notes: [{ note: 'Provide water frequently' }],
    });

    const details = await getVisitForUser(user.id, visit.id);

    expect(details).toMatchObject({
      id: visit.id,
      customerId: customer.id,
      petId: pet.id,
      treatments: [
        expect.objectContaining({
          treatmentId: treatment.id,
          priceCents: 7600,
          nextDueDate: '2025-04-15',
        }),
      ],
      notes: [expect.objectContaining({ note: 'Provide water frequently' })],
    });
  });

  it('updates visits, appends notes and treatments, and enforces ownership', async () => {
    const { user, customer, pet, treatment } = await createUserWithRecords();
    const visit = await createVisitForUser(user.id, {
      customerId: customer.id,
      petId: pet.id,
      scheduledStartAt: '2025-05-01T12:00:00.000Z',
      title: 'Initial title',
    });

    const appendedOnly = await updateVisitForUser(user.id, visit.id, {
      notes: [{ note: 'First follow-up' }],
    });
    expect(appendedOnly.notes.map((note) => note.note)).toContain('First follow-up');

    const updated = await updateVisitForUser(user.id, visit.id, {
      status: 'completed',
      scheduledStartAt: '2025-05-01T13:00:00.000Z',
      scheduledEndAt: null,
      completedAt: '2025-05-01T14:00:00.000Z',
      title: '   ',
      description: 'Return in two weeks',
      treatments: [
        {
          treatmentId: treatment.id,
          priceCents: 8800,
          nextDueDate: '2025-05-15',
        },
      ],
      notes: [{ note: 'Schedule booster' }],
    });

    expect(updated).toMatchObject({
      status: 'completed',
      scheduledStartAt: '2025-05-01T13:00:00.000Z',
      completedAt: '2025-05-01T14:00:00.000Z',
      title: null,
      description: 'Return in two weeks',
    });
    expect(updated.treatments.some((item) => item.nextDueDate === '2025-05-15')).toBe(true);
    expect(updated.notes.some((item) => item.note === 'Schedule booster')).toBe(true);

    const rows = await db.query.visitTreatments.findMany({
      where: eq(visitTreatments.visitId, visit.id),
    });
    expect(rows.length).toBeGreaterThanOrEqual(1);

    const otherUser = await createTestUserWithSession();
    await expect(getVisitForUser(otherUser.user.id, visit.id)).rejects.toHaveProperty(
      'statusCode',
      404
    );
    await expect(
      updateVisitForUser(otherUser.user.id, visit.id, { status: 'cancelled' })
    ).rejects.toHaveProperty('statusCode', 404);
  });

  it('rejects creation when customer or pet do not belong to user', async () => {
    const { customer, pet } = await createUserWithRecords();
    const { user: userB } = await createTestUserWithSession();

    await expect(
      createVisitForUser(userB.id, {
        customerId: customer.id,
        petId: pet.id,
        scheduledStartAt: '2025-07-01T10:00:00.000Z',
      })
    ).rejects.toHaveProperty('statusCode', 404);
  });

  it('rejects creating visits with treatments the user does not own', async () => {
    const { user } = await createTestUserWithSession();
    const customer = await seedCustomer(user.id, { name: 'Owner' });
    const pet = await seedPet(customer.id, { name: 'Fido', type: 'dog' });

    const { user: otherUser } = await createTestUserWithSession();
    const otherTreatment = await seedTreatment(otherUser.id, {
      name: 'External treatment',
      price: 1200,
    });

    await expect(
      createVisitForUser(user.id, {
        customerId: customer.id,
        petId: pet.id,
        scheduledStartAt: '2025-08-01T10:00:00.000Z',
        treatments: [
          {
            treatmentId: otherTreatment.id,
            priceCents: 1500,
            nextDueDate: '2025-08-10',
          },
        ],
      })
    ).rejects.toHaveProperty('statusCode', 404);
  });

  it('rejects updating visits when adding treatments the user does not own', async () => {
    const { user } = await createTestUserWithSession();
    const customer = await seedCustomer(user.id, { name: 'Owner' });
    const pet = await seedPet(customer.id, { name: 'Fido', type: 'dog' });

    const visit = await createVisitForUser(user.id, {
      customerId: customer.id,
      petId: pet.id,
      scheduledStartAt: '2025-09-01T09:00:00.000Z',
    });

    const { user: otherUser } = await createTestUserWithSession();
    const otherTreatment = await seedTreatment(otherUser.id, {
      name: 'External update treatment',
      price: 1800,
    });

    await expect(
      updateVisitForUser(user.id, visit.id, {
        treatments: [
          {
            treatmentId: otherTreatment.id,
            priceCents: 2200,
            nextDueDate: '2025-09-15',
          },
        ],
      })
    ).rejects.toHaveProperty('statusCode', 404);
  });

  it('scopes visit image upload keys under user/customer/pet visits folder', async () => {
    const { user, customer, pet } = await createUserWithRecords();
    const visit = await createVisitForUser(user.id, {
      customerId: customer.id,
      petId: pet.id,
      scheduledStartAt: '2026-01-01T10:00:00.000Z',
    });

    const mockUrl = 'https://s3-upload.example.com/visit';
    vi.spyOn(s3Service, 'getPresignedUploadUrl').mockResolvedValue(mockUrl);

    const { key, url } = await getVisitImageUploadUrl(user.id, visit.id, 'image/png');

    expect(url).toBe(mockUrl);
    const [userSegment, customerSegment, petSegment, visitsSegment, visitSegment, fileName] =
      key.split('/');
    expect(userSegment).toContain(user.email.split('@')[0]?.toLowerCase());
    expect(userSegment.endsWith(user.id)).toBe(true);
    expect(customerSegment.endsWith(customer.id)).toBe(true);
    expect(petSegment.startsWith(pet.name.toLowerCase())).toBe(true);
    expect(petSegment.endsWith(pet.id)).toBe(true);
    expect(visitsSegment).toBe('visits');
    expect(visitSegment).toBe(visit.id);
    expect(fileName?.length).toBeGreaterThan(10);
    expect(s3Service.getPresignedUploadUrl).toHaveBeenCalledWith(key, 'image/png');
  });

  it('rejects deleting visit images that do not belong to the visit', async () => {
    const { user: owner } = await createTestUserWithSession();
    const ownerCustomer = await seedCustomer(owner.id, { name: 'Owner' });
    const ownerPet = await seedPet(ownerCustomer.id, { name: 'Fido', type: 'dog' });
    const ownerVisit = await createVisitForUser(owner.id, {
      customerId: ownerCustomer.id,
      petId: ownerPet.id,
      scheduledStartAt: '2026-02-01T10:00:00.000Z',
    });

    vi.spyOn(s3Service, 'getPresignedDownloadUrl').mockResolvedValue('https://download.example');
    const ownerImage = await addVisitImage(
      owner.id,
      ownerVisit.id,
      'owner/key',
      'owner.png',
      'image/png'
    );

    const { user: other } = await createTestUserWithSession();
    const otherCustomer = await seedCustomer(other.id, { name: 'Other' });
    const otherPet = await seedPet(otherCustomer.id, { name: 'Buddy', type: 'cat' });
    const otherVisit = await createVisitForUser(other.id, {
      customerId: otherCustomer.id,
      petId: otherPet.id,
      scheduledStartAt: '2026-03-01T10:00:00.000Z',
    });

    const deleteSpy = vi.spyOn(s3Service, 'deleteObject').mockResolvedValue(undefined);
    await expect(deleteVisitImage(other.id, otherVisit.id, ownerImage.id)).rejects.toHaveProperty(
      'statusCode',
      404
    );
    expect(deleteSpy).not.toHaveBeenCalled();

    const [imageRow] = await db
      .select()
      .from(visitImages)
      .where(eq(visitImages.id, ownerImage.id))
      .limit(1);
    expect(imageRow?.isDeleted).toBe(false);
  });
});
