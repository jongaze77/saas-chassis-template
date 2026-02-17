# SaaS Chassis Template — Project Instructions

## 1. Technology Stack

- **Framework:** Next.js 16 (App Router, Server Components, Server Actions)
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL via Neon, Prisma ORM with split schema files
- **Auth:** Auth.js v5 (NextAuth) with Credentials provider
- **Email:** Resend (transactional) + Inngest (async dispatch)
- **UI:** shadcn/ui + Tailwind CSS v4 + Radix UI primitives
- **Testing:** Vitest (unit/integration), Playwright (E2E)
- **Deployment:** Vercel

## 2. Critical Implementation Rules

- **Server Actions pattern:** Rate limit → Validate (Zod) → Auth check → Execute → Capture audit event → Return `ActionResult<T>`
- **Error handling:** Use `actionSuccess()` / `actionError()` from `@/lib/errors`. Never expose internal errors to clients.
- **Error sanitisation:** Client components must use `ALLOWED_ERROR_MESSAGES` Set to whitelist displayable errors. Unknown errors → generic fallback.
- **PII masking:** Always use `maskEmail()` / `maskIp()` from `@/lib/pii` in log messages. Never log raw email addresses or IPs.
- **Session tokens:** Only log first 8 characters as prefix for correlation.
- **Tenant scoping:** Use `createTenantScopedClient(accountId)` for all user-facing queries. Use `withoutTenantScope()` only for Inngest jobs and cross-account operations.

## 3. Database & Prisma Rules

- **Split schema:** Models live in `prisma/schema/` — one file per domain area (e.g., `accounts.prisma`, `events.prisma`, `enums.prisma`).
- **Naming:** All models use `@@map("snake_case")` table names. All fields use `@map("snake_case")` column names. IDs use `@default(cuid())`.
- **Migrations:** Run `npx prisma migrate dev` for development. Run `npx prisma generate` after schema changes.
- **Tenant scoping:** `TENANT_SCOPED_MODELS` in `src/lib/db.ts` defines which models get automatic `accountId` filtering.
- **Relations:** Always specify `onDelete: Cascade` for child models owned by Account/User.

## 4. API Patterns

- **Server Actions** are the primary API surface — no REST API routes needed for standard CRUD.
- **Rate limiting:** All Server Actions must check rate limits as the FIRST step using `checkRateLimit()` from `@/lib/rateLimit`.
- **Validation:** Use Zod schemas from `src/lib/validators/` for all input validation.
- **Audit events:** Create `Event` records in the same transaction as the mutating operation.

## 5. Testing Rules

- **Co-location:** Tests live in `__tests__/` directories alongside the code they test.
- **Mocking:** Use `vi.mock()` at file top level. Mock external dependencies (db, auth, email) — never call real services.
- **Factory pattern:** Use `vi.fn()` with typed return values. Keep mock setup close to usage.
- **Test structure:** `describe()` blocks group related tests. Each `it()` tests one behaviour.
- **No snapshots:** Prefer explicit assertions over snapshot tests.

## 6. Code Quality

- **Imports:** Use `@/` path alias. Group: external → internal → relative. Alphabetise within groups.
- **Components:** Server Components by default. Only add `"use client"` when hooks or browser APIs are needed.
- **Accessibility:** All interactive elements must meet WCAG 2.1 AA. Use semantic HTML, `role` attributes, `aria-live` for dynamic content.
- **Touch targets:** Minimum 48x48px for interactive elements (mobile).
- **No console.log:** Use structured `logger` from `@/lib/logger`.

## 7. Development Workflow

- **Security middleware stack:** Edge middleware (cookie check) → Server Component (session validation) → Server Action (rate limit + auth + validation)
- **Feature flags:** Use `src/lib/featureFlags.ts` for toggling features per environment.
- **App config:** All branding lives in `src/lib/config.ts` — update once to rebrand the entire app.
- **Email templates:** Inline styles only (email clients don't support CSS). Templates in `src/lib/email/templates/`.
