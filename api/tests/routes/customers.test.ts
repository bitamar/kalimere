import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/app.js';
import { resetDb, seedCustomer, seedPet } from '../utils/db.js';
import { injectAuthed } from '../utils/inject.js';
import type {
  CustomerPetsResponse,
  CustomerResponse,
  CustomersListResponse,
  PetResponse,
} from '@kalimere/types/customers';
import { db } from '../../src/db/client.js';
import { users } from '../../src/db/schema.js';
import * as sessionModule from '../../src/auth/session.js';

vi.mock('openid-client', () => ({
  discovery: vi.fn().mockResolvedValue({}),
  ClientSecretPost: (secret: string) => ({ secret }),
  authorizationCodeGrant: vi.fn(),
}));

function getJson<T>(response: Awaited<ReturnType<typeof injectAuthed>>) {
  return { statusCode: response.statusCode, body: response.json() as T };
}

describe('routes/customers', () => {
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

  async function createAuthedUser() {
    const [user] = await db
      .insert(users)
      .values({
        email: `test-${randomUUID()}@example.com`,
        name: 'Test User',
      })
      .returning();

    const sessionId = `session-${randomUUID()}`;
    const now = new Date();
    vi.spyOn(sessionModule, 'getSession').mockResolvedValue({
      id: sessionId,
      user,
      createdAt: now,
      lastAccessedAt: now,
    });

    return { user, sessionId };
  }

  it('returns the pet data after adding a pet', async () => {
    const { user, sessionId } = await createAuthedUser();
    const customer = await seedCustomer(user.id, { name: 'Lola' });

    const response = await injectAuthed(app, sessionId, {
      method: 'POST',
      url: `/customers/${customer.id}/pets`,
      payload: { name: 'Milo', type: 'dog', gender: 'male' },
    });

    const result = getJson<PetResponse>(response);

    expect(result.statusCode).toBe(201);
    expect(result.body).toMatchObject({
      pet: {
        name: 'Milo',
        type: 'dog',
        customerId: customer.id,
        id: expect.any(String),
      },
    });

    const petsResponse = await injectAuthed(app, sessionId, {
      method: 'GET',
      url: `/customers/${customer.id}/pets`,
    });

    const petsResult = getJson<CustomerPetsResponse>(petsResponse);
    expect(petsResult.statusCode).toBe(200);
    expect(petsResult.body.pets).toEqual([
      expect.objectContaining({
        name: 'Milo',
        type: 'dog',
        customerId: customer.id,
      }),
    ]);

    const listResponse = await injectAuthed(app, sessionId, {
      method: 'GET',
      url: '/customers',
    });

    const listResult = getJson<CustomersListResponse>(listResponse);
    expect(listResult.statusCode).toBe(200);
    expect(listResult.body.customers).toEqual([
      expect.objectContaining({ id: customer.id, name: 'Lola', petsCount: 1 }),
    ]);
  });

  it('updates a pet and returns the updated data', async () => {
    const { user, sessionId } = await createAuthedUser();
    const customer = await seedCustomer(user.id, { name: 'Owner' });
    const pet = await seedPet(customer.id, { name: 'Rex', type: 'dog', gender: 'male' });

    const response = await injectAuthed(app, sessionId, {
      method: 'PUT',
      url: `/customers/${customer.id}/pets/${pet.id}`,
      payload: { name: 'Rexy', breed: 'Labrador' },
    });

    const result = getJson<PetResponse>(response);
    expect(result.statusCode).toBe(200);
    expect(result.body.pet).toMatchObject({
      id: pet.id,
      name: 'Rexy',
      breed: 'Labrador',
      type: 'dog',
      gender: 'male',
    });

    const petsResponse = await injectAuthed(app, sessionId, {
      method: 'GET',
      url: `/customers/${customer.id}/pets`,
    });

    const petsResult = getJson<CustomerPetsResponse>(petsResponse);
    expect(petsResult.body.pets).toEqual([
      expect.objectContaining({ id: pet.id, name: 'Rexy', breed: 'Labrador' }),
    ]);
  });

  it('returns full customer payload after creation', async () => {
    const { sessionId } = await createAuthedUser();
    const response = await injectAuthed(app, sessionId, {
      method: 'POST',
      url: '/customers',
      payload: { name: 'Nova', email: 'nova@example.com' },
    });

    const result = getJson<CustomerResponse>(response);
    expect(result.statusCode).toBe(201);
    expect(result.body.customer).toMatchObject({
      name: 'Nova',
      email: 'nova@example.com',
      petsCount: 0,
    });
  });

  it('returns the requested customer', async () => {
    const { user, sessionId } = await createAuthedUser();
    const customer = await seedCustomer(user.id, { name: 'Target' });
    await seedPet(customer.id, { name: 'Counted' });

    const response = await injectAuthed(app, sessionId, {
      method: 'GET',
      url: `/customers/${customer.id}`,
    });

    const result = getJson<CustomerResponse>(response);
    expect(result.statusCode).toBe(200);
    expect(result.body.customer).toMatchObject({
      id: customer.id,
      name: 'Target',
      petsCount: 1,
    });
  });

  it('returns full customer payload after update', async () => {
    const { user, sessionId } = await createAuthedUser();
    const customer = await seedCustomer(user.id, { name: 'Old Name' });

    const response = await injectAuthed(app, sessionId, {
      method: 'PUT',
      url: `/customers/${customer.id}`,
      payload: { name: 'New Name' },
    });

    const result = getJson<CustomerResponse>(response);
    expect(result.statusCode).toBe(200);
    expect(result.body.customer).toMatchObject({
      id: customer.id,
      name: 'New Name',
      petsCount: 0,
    });
  });

  it('excludes soft deleted pets from counts', async () => {
    const { user, sessionId } = await createAuthedUser();
    const customer = await seedCustomer(user.id, { name: 'Counted' });

    await seedPet(customer.id, { name: 'Active' });
    const deletedPet = await seedPet(customer.id, { name: 'Deleted' });

    await injectAuthed(app, sessionId, {
      method: 'DELETE',
      url: `/customers/${customer.id}/pets/${deletedPet.id}`,
    });

    const listResponse = await injectAuthed(app, sessionId, {
      method: 'GET',
      url: '/customers',
    });

    const listResult = getJson<CustomersListResponse>(listResponse);
    expect(listResult.statusCode).toBe(200);
    expect(listResult.body.customers).toEqual([
      expect.objectContaining({
        id: customer.id,
        name: 'Counted',
        petsCount: 1,
      }),
    ]);

    const updateResponse = await injectAuthed(app, sessionId, {
      method: 'PUT',
      url: `/customers/${customer.id}`,
      payload: { name: 'Renamed' },
    });

    const updateResult = getJson<CustomerResponse>(updateResponse);
    expect(updateResult.statusCode).toBe(200);
    expect(updateResult.body.customer).toMatchObject({
      id: customer.id,
      name: 'Renamed',
      petsCount: 1,
    });
  });

  it('generates a presigned upload URL for pet images', async () => {
    const { user, sessionId } = await createAuthedUser();
    const customer = await seedCustomer(user.id, { name: 'Owner' });
    const pet = await seedPet(customer.id, { name: 'Rex', type: 'dog', gender: 'male' });

    const response = await injectAuthed(app, sessionId, {
      method: 'POST',
      url: `/customers/${customer.id}/pets/${pet.id}/image/upload-url`,
      payload: { contentType: 'image/jpeg' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { url: string; key: string };
    expect(body.url).toMatch(/^https?:\/\//);
    const [userSegment, customerSegment, petSegment, fileName] = body.key.split('/');
    expect(userSegment).toBe(user.id);
    expect(customerSegment).toBe(customer.id);
    expect(petSegment).toBe(pet.id);
    expect(fileName?.startsWith('profile-')).toBe(true);
  });
  it('rejects pet images with arbitrary S3 keys', async () => {
    const { user, sessionId } = await createAuthedUser();
    const customer = await seedCustomer(user.id, { name: 'Owner' });
    const pet = await seedPet(customer.id, { name: 'Rex', type: 'dog', gender: 'male' });

    const response = await injectAuthed(app, sessionId, {
      method: 'PUT',
      url: `/customers/${customer.id}/pets/${pet.id}`,
      payload: { imageUrl: 'arbitrary/other-user/file.jpg' },
    });

    expect(response.statusCode).toBe(400);
    const error = response.json() as { error: string; message: string };
    expect(error.error).toBe('invalid_storage_key');
  });

  it('rejects pet images with keys from different pets', async () => {
    const { user, sessionId } = await createAuthedUser();
    const customer = await seedCustomer(user.id, { name: 'Owner' });
    const pet1 = await seedPet(customer.id, { name: 'Rex', type: 'dog', gender: 'male' });
    const pet2 = await seedPet(customer.id, { name: 'Buddy', type: 'dog', gender: 'male' });

    // Get valid key for pet1
    const uploadUrlResponse = await injectAuthed(app, sessionId, {
      method: 'POST',
      url: `/customers/${customer.id}/pets/${pet1.id}/image/upload-url`,
      payload: { contentType: 'image/jpeg' },
    });
    const { key } = uploadUrlResponse.json() as { url: string; key: string };

    // Try to use pet1's key for pet2
    const response = await injectAuthed(app, sessionId, {
      method: 'PUT',
      url: `/customers/${customer.id}/pets/${pet2.id}`,
      payload: { imageUrl: key },
    });

    expect(response.statusCode).toBe(400);
    const error = response.json() as { error: string; message: string };
    expect(error.error).toBe('invalid_storage_key');
  });
});
