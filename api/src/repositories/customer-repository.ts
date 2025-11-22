import { and, count, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { customers } from '../db/schema.js';

export type CustomerRecord = (typeof customers)['$inferSelect'];
export type CustomerInsert = (typeof customers)['$inferInsert'];

export async function findActiveCustomersByUserId(userId: string) {
  return db.query.customers.findMany({
    where: and(eq(customers.userId, userId), eq(customers.isDeleted, false)),
    columns: { id: true, name: true, email: true, phone: true, address: true },
  });
}

export async function findCustomerByIdForUser(userId: string, customerId: string) {
  return db.query.customers.findFirst({
    where: and(
      eq(customers.id, customerId),
      eq(customers.userId, userId),
      eq(customers.isDeleted, false)
    ),
  });
}

export async function createCustomer(values: CustomerInsert) {
  const rows = await db.insert(customers).values(values).returning({
    id: customers.id,
    name: customers.name,
    email: customers.email,
    phone: customers.phone,
    address: customers.address,
  });
  return rows[0] ?? null;
}

export async function updateCustomerById(
  customerId: string,
  userId: string,
  updates: Partial<CustomerInsert>
) {
  const rows = await db
    .update(customers)
    .set(updates)
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.isDeleted, false),
        eq(customers.userId, userId)
      )
    )
    .returning({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
      address: customers.address,
    });
  return rows[0] ?? null;
}

export async function softDeleteCustomerById(customerId: string, userId: string) {
  const rows = await db
    .update(customers)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.userId, userId),
        eq(customers.isDeleted, false)
      )
    )
    .returning({ id: customers.id });
  return rows[0] ?? null;
}

export async function countActiveCustomersByUserId(userId: string) {
  const [row] = await db
    .select({ count: count(customers.id) })
    .from(customers)
    .where(and(eq(customers.userId, userId), eq(customers.isDeleted, false)));
  return row?.count ?? 0;
}
