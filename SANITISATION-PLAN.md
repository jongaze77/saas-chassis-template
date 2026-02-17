# Reusable SaaS Template Plan

**Created:** 2026-02-16
**Trigger:** After Epic 1 completion (all 7 stories done + retrospective)
**Estimated effort:** 1-2 days
**Priority:** Post-Epic 1, before Epic 2

---

## What This Is

Extract the Epic 1 codebase into a reusable "SaaS Platform Chassis" template that can bootstrap future greenfield projects with a battle-tested foundation: multi-tenant auth, email pipeline, dashboard shell, security middleware, audit events, and AI-agent-friendly documentation.

## Why It's Worth Doing

- Every story went through 8 review cycles — security edge cases, accessibility gaps, race conditions, and PII leaks have been found and resolved
- The project-context.md (27 rules) is an AI agent manual that prevents implementation mistakes
- The BMAD workflow (sprint status, story format, review-fix cycle) transfers as a quality process
- Building auth + email + sessions + rate limiting from scratch takes weeks; this template gives it for free

## What Transfers Directly (No Changes Needed)

- Auth system: register, verify email, login, logout, password reset, session management
- Auth.js v5 Credentials provider workaround (custom Server Actions, documented)
- Prisma split schema with tenant scoping extension (`$allOperations` accountId injection)
- Server Action pattern: validate -> authorise -> execute -> capture event -> return
- Error handling: `ActionResult<T>`, error envelopes, client-side sanitisation whitelists
- Email pipeline: Resend + Inngest async dispatch with isolated error handling
- Structured logging with PII masking (`maskEmail()`, session token prefixes)
- Testing patterns: `vi.hoisted()`, factory approach, co-located `__tests__/` directories
- Component patterns: `useActionState`, error sanitisation Sets, accessibility (aria-live, role="alert", 48px touch targets)
- Middleware structure (Edge Runtime cookie check + Server Component session validation)
- CI/CD setup (GitHub Actions lint/type-check + Vercel deployment)
- Feature flags (typed, environment-based)

## What Needs Parameterisation

### App Identity (find-and-replace)
- `SEO PluginPress` / `seopluginpress` -> `{{APP_NAME}}` / `{{APP_SLUG}}`
- Email subjects: "Verify your email - SEO PluginPress" -> "Verify your email - {{APP_NAME}}"
- Email template branding (logo, colours, footer text)
- `NEXTAUTH_URL` and other env var documentation

### Prisma Schema (strip domain models)
- **Keep:** accounts, users, sessions, verification_tokens, events, account_summaries
- **Keep enums:** EventType (generic subset: USER_JOINED, USER_EMAIL_VERIFIED, USER_PASSWORD_RESET_REQUESTED, USER_PASSWORD_RESET_COMPLETED, SETTINGS_UPDATED), ActorType
- **Remove:** sites, pages, recommendations, sync-related models, triage-related enums
- **Keep structure:** split schema in `prisma/schema/`, @@map/@map on everything, cuid2 IDs

### Feature Flags
- Replace SEO-specific flags (FEATURE_ASSIGNMENTS, FEATURE_PERMISSIONS, FEATURE_BILLING, FEATURE_SELF_SERVICE) with generic placeholders or remove
- Keep the typed feature flag pattern in `src/lib/featureFlags.ts`

### Dashboard Content
- Empty state cards: replace SEO-specific copy ("No sites connected yet") with generic placeholders
- Sidebar navigation items: strip domain-specific routes
- Keep the responsive layout shell (sidebar, main content, mobile drawer)

### Project Context
- Parameterise project-context.md — mark project-specific rules vs universal rules
- Keep all 27 rules but generalise SEO-specific ones (e.g., "Plugin API" section becomes a placeholder)

## Architectural Decisions That Transfer (With Documented Trade-offs)

| Decision | Trade-off | Acceptable? |
|----------|-----------|-------------|
| **Inngest** for async processing | Vendor lock-in to Inngest. Alternative: generic queue abstraction | Yes — Inngest's step functions and retry are worth the coupling |
| **Neon** PostgreSQL | Branch-per-PR workflow is Neon-specific. Standard Postgres works but loses preview branching | Yes — swap Neon for any Postgres provider by changing connection string |
| **Auth.js v5 beta** | Credentials provider workaround needed (custom login/logout). May be fixed in future Auth.js releases | Yes — well-documented, tested, proven. Migration path is clear if Auth.js fixes it |
| **shadcn/ui** | Components are copied in, not imported. Portable but requires manual updates | Yes — ownership model is intentional |
| **Resend** for email | Vendor-specific but easily swappable (just change the send call in Inngest functions) | Yes — minimal coupling surface |

## Steps to Create the Template

### 1. Create template branch
```bash
git checkout -b template/saas-chassis
```

### 2. Strip domain-specific code
- Remove SEO-specific Prisma models (keep accounts, users, sessions, events)
- Remove domain-specific pages (keep auth pages + dashboard shell)
- Remove domain-specific components (keep auth + shared + ui)
- Remove domain-specific Inngest functions (keep email functions)
- Remove domain-specific validators (keep auth validators)
- Remove domain-specific Server Actions (keep auth actions)
- Clean up event types enum (keep auth-related, remove domain-specific)

### 3. Parameterise branding
- Replace all "SEO PluginPress" / "seopluginpress" with config-driven values
- Create `src/lib/config.ts` with app name, email from address, etc.
- Update email templates to read from config
- Update page titles, meta descriptions

### 4. Generalise project-context.md
- Section 1 (Technology Stack): keep as-is (fully reusable)
- Section 2 (Critical Implementation Rules): keep as-is (universal patterns)
- Section 3 (Database & Prisma Rules): remove domain model references
- Section 4 (API & Communication Rules): remove plugin API section, keep general patterns
- Section 5 (Testing Rules): keep as-is
- Section 6 (Code Quality): keep as-is
- Section 7 (Development Workflow): remove sync protocol, keep security middleware stack

### 5. Create setup documentation
- README with "Getting Started" for new projects
- Environment variable checklist
- Neon project setup steps
- Inngest dev server setup
- Resend API key setup
- First deployment to Vercel checklist

### 6. Create BMAD template artifacts
- Generic sprint-status.yaml with placeholder epics
- Generic epic template with "Platform Foundation" as Epic 1 (already done)
- Story template (already exists in BMAD)
- project-context.md template

### 7. Verify template works
- Clone fresh, run setup steps, verify auth flows work end-to-end
- Run all tests (should pass with generic config)
- Deploy to Vercel from template

## What NOT to Do

- Don't create the template DURING Epic 1 — finish the product first
- Don't abstract prematurely (no "template engine" or "scaffolding tool")
- Don't try to support multiple auth providers in the template — start with email/password, add OAuth later per project
- Don't create a monorepo template — keep it single-app (Next.js platform only)
- Don't strip the review cycle history from the original project — it's valuable context

## Future Enhancement (Not Now)

- `npx create-saas-chassis` CLI tool that prompts for app name, runs find-and-replace, initialises git
- Optional module system: "include billing?" / "include permissions?" toggles
- WordPress plugin template as a separate companion template
