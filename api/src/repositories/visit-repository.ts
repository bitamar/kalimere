import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { customers, pets, visitNotes, visitTreatments, visits } from '../db/schema.js';

export type VisitRecord = (typeof visits)['$inferSelect'];
export type VisitInsert = (typeof visits)['$inferInsert'];
export type VisitTreatmentRecord = (typeof visitTreatments)['$inferSelect'];
export type VisitTreatmentInsert = (typeof visitTreatments)['$inferInsert'];
export type VisitNoteRecord = (typeof visitNotes)['$inferSelect'];
export type VisitNoteInsert = (typeof visitNotes)['$inferInsert'];

export async function createVisit(values: VisitInsert) {
  const rows = await db.insert(visits).values(values).returning();
  return rows[0] ?? null;
}

export async function updateVisitById(visitId: string, updates: Partial<VisitInsert>) {
  const [row] = await db
    .update(visits)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(visits.id, visitId), eq(visits.isDeleted, false)))
    .returning();
  return row ?? null;
}

export async function findActiveVisitsByPetId(petId: string) {
  return db.query.visits.findMany({
    where: and(eq(visits.petId, petId), eq(visits.isDeleted, false)),
    orderBy: (table, { desc }) => desc(table.scheduledStartAt),
  });
}

export async function findVisitWithCustomerById(visitId: string) {
  const rows = await db
    .select({ visit: visits, customer: customers, pet: pets })
    .from(visits)
    .leftJoin(customers, eq(customers.id, visits.customerId))
    .leftJoin(pets, eq(pets.id, visits.petId))
    .where(and(eq(visits.id, visitId), eq(visits.isDeleted, false)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    ...row.visit,
    customer: row.customer ?? null,
    pet: row.pet ?? null,
  };
}

export async function findVisitWithDetailsById(visitId: string) {
  const base = await findVisitWithCustomerById(visitId);
  if (!base) return null;

  const [treatments, notes] = await Promise.all([
    db
      .select()
      .from(visitTreatments)
      .where(and(eq(visitTreatments.visitId, visitId), eq(visitTreatments.isDeleted, false)))
      .orderBy(asc(visitTreatments.createdAt)),
    db
      .select()
      .from(visitNotes)
      .where(eq(visitNotes.visitId, visitId))
      .orderBy(asc(visitNotes.createdAt)),
  ]);

  return {
    ...base,
    visitTreatments: treatments,
    notes,
  };
}

export async function createVisitTreatments(values: VisitTreatmentInsert[]) {
  if (values.length === 0) return [] as VisitTreatmentRecord[];
  return db.insert(visitTreatments).values(values).returning();
}

export async function createVisitNotes(values: VisitNoteInsert[]) {
  if (values.length === 0) return [] as VisitNoteRecord[];
  return db.insert(visitNotes).values(values).returning();
}
