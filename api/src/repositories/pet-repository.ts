import { and, count, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { customers, pets } from '../db/schema.js';

export type PetRecord = (typeof pets)['$inferSelect'];
export type PetInsert = (typeof pets)['$inferInsert'];

export async function countPetsForCustomerIds(customerIds: string[]) {
  if (customerIds.length === 0) return new Map<string, number>();

  const rows = await db
    .select({ customerId: pets.customerId, count: count(pets.id) })
    .from(pets)
    .where(and(inArray(pets.customerId, customerIds), eq(pets.isDeleted, false)))
    .groupBy(pets.customerId);

  const counts = new Map<string, number>();
  for (const row of rows) {
    const customerId = row.customerId;
    if (!customerId) continue;
    const rawCount = row.count;
    const numericCount = Number(rawCount ?? 0);
    counts.set(customerId, Number.isNaN(numericCount) ? 0 : numericCount);
  }

  return counts;
}

export async function countPetsForCustomer(customerId: string) {
  const counts = await countPetsForCustomerIds([customerId]);
  return counts.get(customerId) ?? 0;
}

export async function findActivePetsByCustomerId(customerId: string) {
  return db.query.pets.findMany({
    where: and(eq(pets.customerId, customerId), eq(pets.isDeleted, false)),
    orderBy: (table, { asc }) => asc(table.createdAt),
  });
}

export async function findPetByIdForCustomer(customerId: string, petId: string) {
  return db.query.pets.findFirst({
    where: and(eq(pets.id, petId), eq(pets.customerId, customerId), eq(pets.isDeleted, false)),
  });
}

export async function createPet(values: PetInsert) {
  const rows = await db.insert(pets).values(values).returning();
  return rows[0] ?? null;
}

export async function updatePetById(petId: string, values: Partial<PetInsert>) {
  const [row] = await db
    .update(pets)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(pets.id, petId))
    .returning();
  return row ?? null;
}

export async function softDeletePetById(petId: string) {
  await db.update(pets).set({ isDeleted: true, updatedAt: new Date() }).where(eq(pets.id, petId));
}

export async function countActivePetsByUserId(userId: string) {
  const [row] = await db
    .select({ count: count(pets.id) })
    .from(pets)
    .innerJoin(customers, eq(customers.id, pets.customerId))
    .where(
      and(eq(customers.userId, userId), eq(pets.isDeleted, false), eq(customers.isDeleted, false))
    );
  return row?.count ?? 0;
}
