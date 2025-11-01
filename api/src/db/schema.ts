import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  date,
  pgEnum,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  googleId: text('google_id').unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  phone: text('phone').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => {
    return {
      userIdx: index('session_user_idx').on(table.userId),
    };
  }
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  customers: many(customers),
  treatments: many(treatments),
}));

export const petTypeEnum = pgEnum('pet_type', ['dog', 'cat']);
export const petGenderEnum = pgEnum('pet_gender', ['male', 'female']);
export const visitStatusEnum = pgEnum('visit_status', ['scheduled', 'completed', 'cancelled']);

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    address: text('address'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      userIdx: index('customer_user_idx').on(table.userId),
      customersUserPhoneUnique: uniqueIndex('customers_user_id_phone_unique').on(
        table.userId,
        table.phone
      ),
    };
  }
);

export const pets = pgTable(
  'pets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    name: text('name').notNull(),
    type: petTypeEnum('type').notNull(),
    dateOfBirth: date('date_of_birth', { mode: 'date' }),
    breed: text('breed'),
    imageUrl: text('image_url'),
    gender: petGenderEnum('gender').notNull(),
    isSterilized: boolean('is_sterilized'),
    isCastrated: boolean('is_castrated'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      customerIdx: index('pet_customer_idx').on(table.customerId),
    };
  }
);

export const customersRelations = relations(customers, ({ one, many }) => ({
  user: one(users, {
    fields: [customers.userId],
    references: [users.id],
  }),
  pets: many(pets),
  appointments: many(appointments),
  visits: many(visits),
}));

export const petsRelations = relations(pets, ({ one, many }) => ({
  customer: one(customers, {
    fields: [pets.customerId],
    references: [customers.id],
  }),
  visits: many(visits),
  appointments: many(appointments),
}));

export const treatments = pgTable(
  'treatments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    defaultIntervalMonths: integer('default_interval_months'),
    price: integer('price'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      userIdx: index('treatment_user_idx').on(table.userId),
    };
  }
);

export const visits = pgTable(
  'visits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    petId: uuid('pet_id')
      .notNull()
      .references(() => pets.id),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    status: visitStatusEnum('status').notNull().default('scheduled'),
    scheduledStartAt: timestamp('scheduled_start_at', { withTimezone: true }).notNull(),
    scheduledEndAt: timestamp('scheduled_end_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    title: text('title'),
    description: text('description'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      petIdx: index('visit_pet_idx').on(table.petId),
      customerIdx: index('visit_customer_idx').on(table.customerId),
      statusIdx: index('visit_status_idx').on(table.status),
    };
  }
);

// Visit <-> Treatments (junction) with next due date
export const visitTreatments = pgTable(
  'visit_treatments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    visitId: uuid('visit_id')
      .notNull()
      .references(() => visits.id),
    treatmentId: uuid('treatment_id')
      .notNull()
      .references(() => treatments.id),
    priceCents: integer('price_cents'),
    nextDueDate: date('next_due_date', { mode: 'date' }),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      visitIdx: index('visit_treatment_visit_idx').on(table.visitId),
      treatmentIdx: index('visit_treatment_treatment_idx').on(table.treatmentId),
    };
  }
);

export const visitNotes = pgTable(
  'visit_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    visitId: uuid('visit_id')
      .notNull()
      .references(() => visits.id),
    note: text('note').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      visitIdx: index('visit_note_visit_idx').on(table.visitId),
    };
  }
);

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    petId: uuid('pet_id')
      .notNull()
      .references(() => pets.id),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }),
    title: text('title').notNull(),
    notes: text('notes'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      petIdx: index('appointment_pet_idx').on(table.petId),
      customerIdx: index('appointment_customer_idx').on(table.customerId),
    };
  }
);

export const treatmentsRelations = relations(treatments, ({ one, many }) => ({
  user: one(users, {
    fields: [treatments.userId],
    references: [users.id],
  }),
  visitTreatments: many(visitTreatments),
}));

export const visitsRelations = relations(visits, ({ one, many }) => ({
  pet: one(pets, {
    fields: [visits.petId],
    references: [pets.id],
  }),
  visitTreatments: many(visitTreatments),
  customer: one(customers, {
    fields: [visits.customerId],
    references: [customers.id],
  }),
  notes: many(visitNotes),
}));

export const visitTreatmentsRelations = relations(visitTreatments, ({ one }) => ({
  visit: one(visits, {
    fields: [visitTreatments.visitId],
    references: [visits.id],
  }),
  treatment: one(treatments, {
    fields: [visitTreatments.treatmentId],
    references: [treatments.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  pet: one(pets, {
    fields: [appointments.petId],
    references: [pets.id],
  }),
  customer: one(customers, {
    fields: [appointments.customerId],
    references: [customers.id],
  }),
}));

export const visitNotesRelations = relations(visitNotes, ({ one }) => ({
  visit: one(visits, {
    fields: [visitNotes.visitId],
    references: [visits.id],
  }),
}));
