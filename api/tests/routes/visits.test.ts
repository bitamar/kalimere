import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/app.js';
import {
  createTestUserWithSession,
  resetDb,
  seedCustomer,
  seedPet,
  seedTreatment,
} from '../utils/db.js';
import { injectAuthed } from '../utils/inject.js';
import type {
  VisitResponse,
  VisitWithDetailsResponse,
  VisitsListResponse,
} from '@kalimere/types/visits';

vi.mock('openid-client', () => ({
  discovery: vi.fn().mockResolvedValue({}),
  ClientSecretPost: (secret: string) => ({ secret }),
  authorizationCodeGrant: vi.fn(),
}));

function getJson<T>(response: Awaited<ReturnType<typeof injectAuthed>>) {
  return { statusCode: response.statusCode, body: response.json() as T };
}

describe('routes/visits', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await resetDb();
  });

  it('allows an authenticated user to create, list, read, and update visits', async () => {
    const { user, session } = await createTestUserWithSession();
    const customer = await seedCustomer(user.id, { name: 'Jessie Pawson' });
    const pet = await seedPet(customer.id, { name: 'Mochi', type: 'dog' });
    const treatment = await seedTreatment(user.id, { name: 'Vaccination', price: 7800 });

    const createResponse = await injectAuthed(app, session.id, {
      method: 'POST',
      url: '/visits',
      payload: {
        customerId: customer.id,
        petId: pet.id,
        scheduledStartAt: '2025-08-02T09:00:00.000Z',
        title: '  Booster Shot  ',
        notes: [{ note: '  Bring treats  ' }],
        treatments: [
          {
            treatmentId: treatment.id,
            priceCents: 8200,
            nextDueDate: '2026-08-02',
          },
        ],
      },
    });

    const createResult = getJson<VisitResponse>(createResponse);
    expect(createResult.statusCode).toBe(201);
    expect(createResult.body.visit).toMatchObject({
      customerId: customer.id,
      petId: pet.id,
      title: 'Booster Shot',
      description: null,
      status: 'scheduled',
    });

    const listResponse = await injectAuthed(app, session.id, {
      method: 'GET',
      url: `/customers/${customer.id}/pets/${pet.id}/visits`,
    });
    const listResult = getJson<VisitsListResponse>(listResponse);
    expect(listResult.statusCode).toBe(200);
    expect(listResult.body.visits).toHaveLength(1);
    expect(listResult.body.visits[0]).toMatchObject({
      customerId: customer.id,
      petId: pet.id,
    });

    const visitId = createResult.body.visit.id;

    const showResponse = await injectAuthed(app, session.id, {
      method: 'GET',
      url: `/visits/${visitId}`,
    });
    const showResult = getJson<VisitWithDetailsResponse>(showResponse);
    expect(showResult.statusCode).toBe(200);
    expect(showResult.body.visit.notes[0].note).toBe('Bring treats');
    expect(showResult.body.visit.treatments[0]).toMatchObject({
      treatmentId: treatment.id,
      priceCents: 8200,
      nextDueDate: '2026-08-02',
    });

    const updateResponse = await injectAuthed(app, session.id, {
      method: 'PUT',
      url: `/visits/${visitId}`,
      payload: {
        status: 'completed',
        completedAt: '2025-08-02T09:45:00.000Z',
        scheduledEndAt: null,
        notes: [{ note: 'Follow-up booked' }],
      },
    });
    const updateResult = getJson<VisitWithDetailsResponse>(updateResponse);
    expect(updateResult.statusCode).toBe(200);
    expect(updateResult.body.visit).toMatchObject({
      status: 'completed',
      completedAt: '2025-08-02T09:45:00.000Z',
      title: 'Booster Shot',
    });
    expect(updateResult.body.visit.notes.some((note) => note.note === 'Follow-up booked')).toBe(
      true
    );
  });

  it('denies access to visits owned by another user', async () => {
    const owner = await createTestUserWithSession();
    const intruder = await createTestUserWithSession();
    const customer = await seedCustomer(owner.user.id, { name: 'Primary Owner' });
    const pet = await seedPet(customer.id, { name: 'Nibbles', type: 'cat' });

    const createResponse = await injectAuthed(app, owner.session.id, {
      method: 'POST',
      url: '/visits',
      payload: {
        customerId: customer.id,
        petId: pet.id,
        scheduledStartAt: '2025-09-12T11:00:00.000Z',
      },
    });

    const visitId = (createResponse.json() as VisitResponse).visit.id;

    const listResponse = await injectAuthed(app, intruder.session.id, {
      method: 'GET',
      url: `/customers/${customer.id}/pets/${pet.id}/visits`,
    });
    expect(listResponse.statusCode).toBe(404);

    const showResponse = await injectAuthed(app, intruder.session.id, {
      method: 'GET',
      url: `/visits/${visitId}`,
    });
    expect(showResponse.statusCode).toBe(404);

    const updateResponse = await injectAuthed(app, intruder.session.id, {
      method: 'PUT',
      url: `/visits/${visitId}`,
      payload: { status: 'cancelled' },
    });
    expect(updateResponse.statusCode).toBe(404);
  });
});
