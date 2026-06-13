# Tasks: Multi-Account Multi-Campaign

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1000–1100 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3 → PR4 → PR5 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Resolved — auto-chain, feature-branch-chain
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Data model: schema + migration + seed | ✅ PR 1 DONE | Base: feature branch; tests included |
| 2 | Core backend: ClientManager, per-account scheduler, warmup, completion | PR 2 | Base: PR 1; sender/warmup refactored |
| 3 | API layer + worker wiring | PR 3 | Base: PR 2; accounts CRUD, campaigns/contacts updated |
| 4 | UI: shadcn/ui pages for accounts, campaigns, contacts | ✅ PR 4 DONE | Base: PR 3; tokens-only, no hardcoded colors |
| 5 | Test suite update + cleanup (delete client.ts) | PR 5 | Base: PR 4; 4 existing tests updated, 3 new test files |

## Phase 1: Data Model ✅

- [x] T01 **[TDD: RED→GREEN]** Write migration integration test: seed default account from AppConfig, verify Campaign.whatsappAccountId backfill — Commit: `05a2d79`
- [x] T02 **[TDD: GREEN]** Modify `prisma/schema.prisma`: add WhatsAppAccount + ContactList models, add whatsappAccountId/contactListId/order to Campaign, add contactListId to Contact — Migrated via `20260613025400_multi_account` — Commit: `70b6ae6`
- [x] T03 Generate migration via `prisma migrate dev --name multi_account` and write seed script (`prisma/seed.ts`) that creates default WhatsAppAccount from AppConfig + backfills existing Campaigns + Contacts — Commit: `4d915f7`

## Phase 2: Core Backend ✅

- [x] T04 **[TDD: RED→GREEN]** Create `src/lib/whatsapp/client-manager.ts`: Map<string, ClientSession> with getClient(id)/isReady(id)/getStatus(id)/getQr(id)/initializeAll()/destroy(id). Per-session paths at `./wa-sessions/{id}/`. Write client-manager.test.ts. — Commit: `c2114b4`
- [x] T05 **[TDD: REFACTOR]** Refactor `src/lib/whatsapp/sender.ts`: accept `client` param instead of calling internal `getClient()`. Update sendMessageSequence signature. — Commit: `ffce9f3`
- [x] T06 **[TDD: RED→GREEN]** Refactor `src/lib/scheduler/warmup.ts`: all functions accept `accountId`, query via campaign→account join. Write per-account-warmup.test.ts. — Commit: `eaac9bf`
- [x] T07 **[TDD: RED→GREEN]** Refactor `src/lib/scheduler/processContact.ts`: accept `campaignId`, add exported `checkCompletion(campaignId)` (PENDING=0 + reset stuck PROCESSING>10min → DONE). Write completion.test.ts. — Commit: `46d4e54`
- [x] T08 **[TDD: REFACTOR]** Refactor `src/lib/scheduler/index.ts`: `startScheduler(accountId)` with per-account cron, per-account ready/window/limit checks, `findActiveCampaign(accountId)` ordered by `order`, `stopScheduler(accountId)`. — Commit: `3617f34`

## Phase 3: API Layer ✅

- [x] T09 **[TDD: RED→GREEN]** Create `src/app/api/accounts/route.ts` (GET list + POST create), `src/app/api/accounts/[id]/route.ts` (PATCH/DELETE), `src/app/api/accounts/[id]/status/route.ts` (GET status+QR). — Commit: `e5d70cf`
- [x] T10 Update `src/app/api/campaigns/route.ts`: POST accepts `whatsappAccountId`, `contactListId`; GET returns campaigns expanded with account info. — Commit: `d4c4e17`
- [x] T11 Update `src/app/api/contacts/route.ts`: POST accepts `contactListId`; GET filters by `?contactListId=`. Keep backward-compat when listId omitted. — Commit: `c82e18d`
- [x] T12 Update `src/app/api/config/route.ts`: remove `waAccountStartDate`, `dailyLimit`, `sendWindow*` fields from POST/GET — these moved to WhatsAppAccount. — Commit: `007d587`
- [x] T13 Update `src/app/api/stats/route.ts` and `src/app/api/wa-status/route.ts`: per-account breakdowns, wa-status accepts `?accountId=`. — Commit: `3630e68`

## Phase 4: UI (shadcn/ui tokens ONLY, no hardcoded colors) ✅

- [x] T14 Add account management tab to `src/app/settings/page.tsx`: table of WhatsAppAccount rows (name, status badge, dailyLimit, window), add/edit dialog using shadcn Dialog + Form + Input. Use `bg-primary`, `text-muted-foreground`, `border-border` tokens. — Commit: `e96c704`
- [x] T15 Update `src/app/campaigns/page.tsx`: campaign table shows account column, create form adds account Select + order input. Use shadcn Table + Select + Badge for status. — Commit: `b267c5a`
- [x] T16 Update `src/app/contacts/page.tsx`: import form adds ContactList Select, table filters by list. Use shadcn Select for listId dropdown. Created `/api/contact-lists` endpoint. — Commit: `f22a354`

## Phase 5: Worker Integration + Cleanup ✅

- [x] T17 Update `src/worker/index.ts`: `clientManager.initializeAll()` → per-ready event → `startScheduler(accountId)`. On disconnect → `stopScheduler(accountId)`. — Commit: `e1ec4b2`
- [x] T18 Delete `src/lib/whatsapp/client.ts`. Verify all imports point to client-manager throughout codebase. — Commit: `b09168b`
- [x] T19 Update existing 4 tests (`scheduler.test.ts`, `warmup.test.ts`, `processContact.test.ts`, `interpolate.test.ts`) for new function signatures. Run `pnpm test` — all must pass. — Commit: `65d0233`
- [x] T20 **[TDD: GREEN→REFACTOR]** Run full suite: `pnpm test`. Fix any failures. Verify backward compat: single-account setup works post-migration. — Commit: `8c1ad3c`
