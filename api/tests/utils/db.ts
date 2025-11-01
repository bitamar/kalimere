import { randomUUID } from 'node:crypto';
import { db } from '../../src/db/client.js';
import {
  appointments,
  customers,
  pets,
  sessions,
  users,
  visitNotes,
  visitTreatments,
  visits,
  treatments,
} from '../../src/db/schema.js';

export async function resetDb() {
  await db.delete(visitTreatments);
  await db.delete(visitNotes);
  await db.delete(appointments);
  await db.delete(visits);
  await db.delete(pets);
  await db.delete(treatments);
  await db.delete(customers);
  await db.delete(sessions);
  await db.delete(users);
}

export async function createTestUserWithSession() {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: `tester-${randomUUID()}@example.com`,
        name: 'Test User',
      })
      .returning();

    const now = new Date();
    const [session] = await tx
      .insert(sessions)
      .values({
        id: randomUUID(),
        userId: user.id,
        createdAt: now,
        lastAccessedAt: now,
        expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24),
      })
      .returning();

    return { user, session };
  });
}

export async function seedCustomer(userId: string, data: { name: string }) {
  const [customer] = await db.insert(customers).values({ userId, name: data.name }).returning();
  return customer;
}

export async function seedPet(customerId: string, data: { name: string; type?: 'dog' | 'cat' }) {
  const [pet] = await db
    .insert(pets)
    .values({
      customerId,
      name: data.name,
      type: data.type ?? 'dog',
      gender: 'male',
    })
    .returning();
  return pet;
}

export async function seedTreatment(
  userId: string,
  data: { name: string; price?: number | null; defaultIntervalMonths?: number | null }
) {
  const [treatment] = await db
    .insert(treatments)
    .values({
      userId,
      name: data.name,
      price: data.price ?? null,
      defaultIntervalMonths: data.defaultIntervalMonths ?? null,
    })
    .returning();

  return treatment;
}
