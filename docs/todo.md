## Architecture Improvements (DO NOW)

### devex
- [x] Webstorm complaints: TS1192: Module "node:crypto" has no default export.
- [x] fix all the places with one letter local vars. prefer destructure or full names
- [ ] a lot of deprecated zod methods, fix them
- [x] can we remove all the typeof whatever === 'string' checks and rely on zod?
- [x] fix browser build typing leak in GlobalLoadingIndicator

### Backend Critical
- [x] remove duplicate name constraint on treatment
- [x] bug - after adding a pet, the customer is returned without their pets _(done: API now returns updated customer including pets; covered by tests)_
- [x] add request/response validation (Zod or similar) - currently using manual validation
- [x] centralized error handling middleware - errors are handled inconsistently _(done: central error plugin + shared `AppError` utility)_
- [x] move sessions from in-memory to database - will lose all sessions on restart _(done: sessions persisted via Postgres with expiry upkeep)_
- [x] API request/response schemas shared with frontend (tRPC or shared types) _(done: shared Zod schemas + frontend runtime validation)_
- [x] structured logging with context (request IDs, user IDs) _(done: request logger now includes request/user/session IDs with lifecycle hooks)_
- [x] don't pass internal error messages outside on prod
- [x] fix pets summary on the customers ep - now the customers list always shows 0 pets it should have just a count for now
- [x] 90% coverage + show status on pr
- [x] simplify allowed origins logic - each env should only support its own frontend (localhost, pr env, prod)

### Frontend Critical
- [x] add state management library (TanStack Query) — see plan below
- [x] centralized error handling and toast notifications - errors just throw
- [x] loading states coordination - currently each component manages its own
- [x] optimistic updates for better UX - currently wait for server on every action
- [x] proper error boundaries for React - currently errors crash the app
- [x] abort pending requests on navigation - currently requests keep running

### Frontend: TanStack Query Adoption (NOW)
- [x] add `@tanstack/react-query` and `@tanstack/react-query-devtools` to `front`
- [x] wrap app with `QueryClientProvider` in `front/src/main.tsx` (defaults: `queries.retry=false`, sensible `staleTime`, `refetchOnWindowFocus=true`)
- [x] add React Query Devtools in development only
- [x] define query keys: `customers`, `customer:id`, `pets:customerId`, `treatments`, `settings`, `me`
- [x] plumb `AbortSignal` through: pass `signal` from `useQuery` to `fetchJson` (`RequestInit.signal`)
- [x] migrate pages to `useQuery`/`useMutation` with invalidation instead of manual `refresh`/`useEffect`
- [x] pages migration order: Treatments → Customers → CustomerDetail (incl. pets) → PetDetail → Settings → Auth `/me`
- [x] invalidate on mutations: treatments → `treatments`; customers CRUD → `customers`; add/delete pet → `pets:customerId` and relevant `customer:id`; settings update → `settings` and `me`
- [x] replace all usages of `useListState` and remove the hook after migration
- [x] add global success/error toasts for mutations (consider `@mantine/notifications`)
- [x] add error boundaries around routed content
- [x] update `front/src/test/utils/renderWithProviders.tsx` to include `QueryClientProvider` (set `retry=false` in tests)
- [x] document query key conventions and invalidation rules

### DevOps / Infrastructure (DO NOW)
- [x] support PR environments - OAuth redirects to prod instead of staying on PR env (e.g., front-kalimere-pr-1.up.railway.app/login redirects to prod)
- [x] run all tests on prs 
- [x] switch API tests to pg-mem (or similar) for local runs

### Security & Data Integrity (DO NOW)
- [x] add rate limiting middleware (fastify-rate-limit)
- [x] validate user ownership in middleware - currently each route does it manually
- [x] add indexes on foreign keys (petId, customerId, userId) - currently slow queries
- [ ] add database constraints for data integrity (CHECK constraints)
- [ ] sanitize user inputs (prevent XSS, SQL injection via ORM)
- [ ] add CSRF protection for state-changing operations

### Code Organization
- [x] separate validation logic from route handlers (create validation schemas)
- [x] create service layer - currently business logic in route handlers
- [x] create repository layer - currently direct DB access in routes
- [x] fix type sharing between frontend/backend (dedicated `@kalimere/types` package)

## MVP / Core Features
- [ ] pets view
- [ ] make sure all queries can only return data belonging to the current user (Auth)

## Visit Roadmap

### Core Experience
- [x] allow to record/schedule a visit to a pet
- [x] Visit entity - user can record / schedule visits to pets. visit has list of treatments, each one should be able to override default price and default recurring date. should have list of notes
- [ ] all visits view for the user, with a calendar
- [ ] visit status tracking (scheduled, completed, cancelled)
- [ ] create future visits, probably a nightly job
- [ ] recurring visit scheduling

### Treatments & Records
- [ ] edit/cancel visits
- [ ] edit/update treatment records
- [ ] upload files to visits (x-rays, test results)
- [ ] auto-generate visit summaries from notes

### Communication & Reminders
- [ ] on a visit, allow to tick a reminder option
- [ ] send automated reminders (email/SMS)
- [ ] on the customer level, allow a checkbox for sending whatsapp reminders for visits
- [ ] on the customer level, show a log of activity including whatsapp reminders, and incoming whatsapp messages

### Discovery & Insights
- [ ] filter/sort visits (by date, status, customer)
- [ ] filter/sort customers by recent visit activity
- [ ] dashboard with key stats (visits this week, revenue, upcoming appointments)
- [ ] charts for visit trends

### Billing & Paperwork
- [ ] create an invoice for a visit
- [ ] Invoice entity - user can create an invoice for a visit, with treatments, prices, total, paid/unpaid status
- [ ] export visit details / invoice

## Phase 1 - Polish & Essential Features

### UI/UX Polish
- [x] only show the delete button when hovering over a card
- [ ] make sure loading spinner behaviour is consistent
- [ ] slide animation between customers > customer > pets
- [x] confirmation dialogs for destructive actions (delete customer, pet)
- [x] error states (empty states when no data, error messages)
- [x] toast notifications for success/error actions

### Search & Filtering
- [ ] search in customers view - by pet name, phone number etc
- [ ] search in pets view
- [ ] filter/sort customers (by date added, name, engagement)

### Data Management
- [x] edit customer details
- [x] edit pet details

## Phase 2 - Advanced Features

### Billing & Exports
- [ ] export customer/pet data (CSV/PDF)
- [ ] payment tracking (paid/unpaid status)
- [ ] pricing management for treatments

### File Management
- [ ] upload/attach files to pets (medical records, photos)
- [ ] image preview/gallery for pet photos

### Dashboard & Analytics
- [ ] recent activity feed

## Phase 3 - LLM Features
- [ ] connect the api to a llm
- [ ] generate a unique icon for each pet and customer
- [ ] treatment recommendations based on symptoms

## Phase 4 - Advanced Admin & Polish

### Auth & Security
- [ ] allow the admin to impersonate users
- [ ] user profile management
- [ ] password reset flow
- [ ] session timeout handling

### Settings & Configuration
- [ ] business settings (clinic name, logo, contact info)
- [ ] customizable invoice templates
- [ ] notification preferences
- [ ] timezone settings

### Technical Improvements
- [ ] error logging/monitoring (Sentry or similar)
- [ ] database backup automation
- [ ] mobile responsiveness improvements
- [ ] accessibility improvements (keyboard nav, ARIA labels)
- [ ] performance optimization (lazy loading, caching)

## Future 
- [ ] multi-user/clinic support
- [ ] inventory management for medications
- [ ] integrated SMS/email client
