import { and, asc, count, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { customers, pets, visitImages, visitNotes, visitTreatments, visits } from '../db/schema.js';

export type VisitRecord = (typeof visits)['$inferSelect'];
export type VisitInsert = (typeof visits)['$inferInsert'];
export type VisitTreatmentRecord = (typeof visitTreatments)['$inferSelect'];
export type VisitTreatmentInsert = (typeof visitTreatments)['$inferInsert'];
export type VisitNoteRecord = (typeof visitNotes)['$inferSelect'];
export type VisitNoteInsert = (typeof visitNotes)['$inferInsert'];
export type VisitImageRecord = (typeof visitImages)['$inferSelect'];
export type VisitImageInsert = (typeof visitImages)['$inferInsert'];

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

  const [treatments, notes, images] = await Promise.all([
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
    db
      .select()
      .from(visitImages)
      .where(and(eq(visitImages.visitId, visitId), eq(visitImages.isDeleted, false)))
      .orderBy(asc(visitImages.createdAt)),
  ]);

  return {
    ...base,
    visitTreatments: treatments,
    notes,
    images,
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

export async function createVisitImages(values: VisitImageInsert[]) {
  if (values.length === 0) return [] as VisitImageRecord[];
  return db.insert(visitImages).values(values).returning();
}

export async function deleteVisitImage(imageId: string) {
  const [row] = await db
    .update(visitImages)
    .set({ isDeleted: true })
    .where(and(eq(visitImages.id, imageId), eq(visitImages.isDeleted, false)))
    .returning();
  return row ?? null;
}

export async function findVisitImageById(imageId: string) {
  const [row] = await db
    .select()
    .from(visitImages)
    .where(and(eq(visitImages.id, imageId), eq(visitImages.isDeleted, false)))
    .limit(1);
  return row ?? null;
}

export async function findUpcomingVisitsByUserId(userId: string, limit: number) {
  const rows = await db
    .select({ visit: visits, customer: customers, pet: pets })
    .from(visits)
    .innerJoin(customers, eq(customers.id, visits.customerId))
    .innerJoin(pets, eq(pets.id, visits.petId))
    .where(
      and(
        eq(customers.userId, userId),
        eq(visits.isDeleted, false),
        eq(visits.status, 'scheduled'),
        gte(visits.scheduledStartAt, new Date())
      )
    )
    .orderBy(asc(visits.scheduledStartAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row.visit,
    customer: row.customer,
    pet: row.pet,
  }));
}

export async function countVisitsByUserId(userId: string, range: { start: Date; end: Date }) {
  const [row] = await db
    .select({
      count: count(visits.id),
      revenue: sql<number>`coalesce(sum(${visitTreatments.priceCents}), 0)`,
    })
    .from(visits)
    .innerJoin(customers, eq(customers.id, visits.customerId))
    .leftJoin(visitTreatments, eq(visitTreatments.visitId, visits.id))
    .where(
      and(
        eq(customers.userId, userId),
        eq(visits.isDeleted, false),
        and(gte(visits.scheduledStartAt, range.start), lte(visits.scheduledStartAt, range.end))
      )
    );

  return {
    count: row?.count ?? 0,
    revenue: Number(row?.revenue ?? 0),
  };
}
