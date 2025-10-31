import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { visitNotes, visitTreatments, visits } from '../db/schema.js';

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
  return db.query.visits.findFirst({
    where: and(eq(visits.id, visitId), eq(visits.isDeleted, false)),
    with: {
      customer: true,
      pet: true,
    },
  });
}

export async function findVisitWithDetailsById(visitId: string) {
  return db.query.visits.findFirst({
    where: and(eq(visits.id, visitId), eq(visits.isDeleted, false)),
    with: {
      customer: true,
      pet: true,
      visitTreatments: {
        where: eq(visitTreatments.isDeleted, false),
        orderBy: asc(visitTreatments.createdAt),
      },
      notes: {
        orderBy: asc(visitNotes.createdAt),
      },
    },
  });
}

export async function createVisitTreatments(values: VisitTreatmentInsert[]) {
  if (values.length === 0) return [] as VisitTreatmentRecord[];
  return db.insert(visitTreatments).values(values).returning();
}

export async function createVisitNotes(values: VisitNoteInsert[]) {
  if (values.length === 0) return [] as VisitNoteRecord[];
  return db.insert(visitNotes).values(values).returning();
}
