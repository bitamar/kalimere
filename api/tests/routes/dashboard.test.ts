import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/app.js';
import { createTestUserWithSession, resetDb, seedCustomer, seedPet } from '../utils/db.js';
import { injectAuthed } from '../utils/inject.js';
import { db } from '../../src/db/client.js';
import { visits } from '../../src/db/schema.js';

vi.mock('openid-client', () => ({
  discovery: vi.fn().mockResolvedValue({}),
  ClientSecretPost: (secret: string) => ({ secret }),
  authorizationCodeGrant: vi.fn(),
}));

function getJson<T>(response: Awaited<ReturnType<typeof injectAuthed>>) {
  return { statusCode: response.statusCode, body: response.json() as T };
}

describe('routes/dashboard', () => {
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

  it('returns correct stats', async () => {
    const { user, session } = await createTestUserWithSession();
    const customer1 = await seedCustomer(user.id, { name: 'Customer 1' });
    const customer2 = await seedCustomer(user.id, { name: 'Customer 2' });
    const pet1 = await seedPet(customer1.id, { name: 'Pet 1' });
    const pet2 = await seedPet(customer2.id, { name: 'Pet 2' });

    // Create visits
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Visit this month
    await db.insert(visits).values({
      customerId: customer1.id,
      petId: pet1.id,
      scheduledStartAt: new Date(startOfMonth.getTime() + 1000 * 60 * 60 * 24), // 1 day after start of month
      title: 'Visit 1',
      status: 'completed',
    });

    // Visit next month (should not be counted in visitsThisMonth)
    await db.insert(visits).values({
      customerId: customer2.id,
      petId: pet2.id,
      scheduledStartAt: new Date(now.getFullYear(), now.getMonth() + 2, 1),
      title: 'Visit 2',
      status: 'scheduled',
    });

    const response = await injectAuthed(app, session.id, {
      method: 'GET',
      url: '/api/dashboard/stats',
    });

    const result = getJson<{
      activeCustomers: number;
      activePets: number;
      visitsThisMonth: number;
      totalRevenue: number;
    }>(response);

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({
      activeCustomers: 2,
      activePets: 2,
      visitsThisMonth: 1,
      totalRevenue: 0,
    });
  });

  it('returns upcoming visits', async () => {
    const { user, session } = await createTestUserWithSession();
    const customer = await seedCustomer(user.id, { name: 'Customer 1' });
    const pet = await seedPet(customer.id, { name: 'Pet 1' });

    const now = new Date();
    const futureDate1 = new Date(now.getTime() + 1000 * 60 * 60 * 24); // 1 day from now
    const futureDate2 = new Date(now.getTime() + 1000 * 60 * 60 * 48); // 2 days from now
    const pastDate = new Date(now.getTime() - 1000 * 60 * 60 * 24); // 1 day ago

    // Future visit 1
    await db.insert(visits).values({
      customerId: customer.id,
      petId: pet.id,
      scheduledStartAt: futureDate1,
      title: 'Future Visit 1',
      status: 'scheduled',
    });

    // Future visit 2
    await db.insert(visits).values({
      customerId: customer.id,
      petId: pet.id,
      scheduledStartAt: futureDate2,
      title: 'Future Visit 2',
      status: 'scheduled',
    });

    // Past visit (should not be returned)
    await db.insert(visits).values({
      customerId: customer.id,
      petId: pet.id,
      scheduledStartAt: pastDate,
      title: 'Past Visit',
      status: 'completed',
    });

    const response = await injectAuthed(app, session.id, {
      method: 'GET',
      url: '/api/dashboard/upcoming',
    });

    const result = getJson<
      {
        id: string;
        petName: string;
        customerName: string;
        serviceType: string;
        date: string;
        status: string;
      }[]
    >(response);

    expect(result.statusCode).toBe(200);
    expect(result.body).toHaveLength(2);
    expect(result.body[0].serviceType).toBe('Future Visit 1');
    expect(result.body[1].serviceType).toBe('Future Visit 2');
  });
});
