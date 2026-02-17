# SaaS Chassis Template

A production-ready SaaS platform foundation built with Next.js, featuring multi-tenant auth, email pipeline, dashboard shell, security middleware, and audit events.

## What's Included

- **Authentication:** Register, email verification, login, logout, password reset, email change
- **Multi-tenant architecture:** Account-based tenant scoping with automatic query filtering
- **Email pipeline:** Resend + Inngest async dispatch with retry and error isolation
- **Dashboard shell:** Responsive sidebar layout with breadcrumbs, skip links, and reduced motion support
- **Security:** Rate limiting, CSRF protection, PII masking, error sanitisation
- **Audit events:** Typed event system with actor tracking and event chains
- **Testing:** Vitest unit/integration tests with comprehensive mocking patterns

## Prerequisites

- **Node.js** 20+
- **PostgreSQL** (recommended: [Neon](https://neon.tech) for serverless Postgres)
- **Inngest** account (for async job processing)
- **Resend** account (for transactional email)

## Getting Started

### 1. Clone and install

```bash
git clone <your-repo-url>
cd <your-project>
npm install
```

### 2. Configure environment

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_URL` | Neon direct connection string (for migrations) |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3001` for local dev |
| `RESEND_API_KEY` | From [Resend dashboard](https://resend.com) |
| `INNGEST_EVENT_KEY` | From [Inngest dashboard](https://inngest.com) |
| `INNGEST_SIGNING_KEY` | From Inngest dashboard |

### 3. Set up the database

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. Start the Inngest dev server

In a separate terminal:

```bash
npx inngest-cli@latest dev
```

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) to see the app.

## Customisation

### Rebrand the app

Edit `src/lib/config.ts` to change the app name, slug, and description. All pages, emails, and the sidebar automatically use these values.

```typescript
export const appConfig = {
  name: "Your App Name",
  slug: "your-app-slug",
  shortName: "YA",
  description: "Your app description",
  email: {
    from: `Your App Name <onboarding@resend.dev>`,
  },
} as const;
```

### Add navigation items

Edit `src/components/shared/AppSidebar.tsx` — add entries to the `navItems` array.

### Add feature flags

Edit `src/lib/featureFlags.ts` — add typed flags to the `FeatureFlags` interface and `featureFlags` object.

### Add Prisma models

Create new `.prisma` files in `prisma/schema/`. Run `npx prisma migrate dev` to create migrations, then `npx prisma generate` to update the client.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server on port 3001 |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest tests |
| `npm run test:watch` | Run tests in watch mode |

## Deploying to Vercel

1. Push your repo to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add all environment variables from `.env.example`
4. Set `NEXTAUTH_URL` to your production domain
5. Deploy

## Architecture

```
src/
  actions/          # Server Actions (auth, settings)
  app/              # Next.js App Router pages
    (auth)/         # Auth pages (login, register, verify)
    (dashboard)/    # Dashboard pages (behind auth)
    api/            # API routes (Inngest webhook)
  components/       # React components
    auth/           # Auth forms
    dashboard/      # Dashboard components
    settings/       # Settings forms
    shared/         # Sidebar, breadcrumb, error boundary
    ui/             # shadcn/ui primitives
  lib/              # Shared utilities
    config.ts       # App branding config
    auth.ts         # Auth.js configuration
    db.ts           # Prisma client with tenant scoping
    email/          # Resend client + email templates
    inngest/        # Inngest client + async functions
    rateLimit.ts    # Rate limiting configuration
    logger.ts       # Structured logging with PII masking
prisma/
  schema/           # Split Prisma schema files
```

## License

MIT
