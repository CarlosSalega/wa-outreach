# Tasks: Multi-Account Multi-Campaign

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1000–1100 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3 → PR4 → PR5 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Data model: schema + migration + seed | PR 1 | Base: feature branch; tests included |
| 2 | Core backend: ClientManager, per-account scheduler, warmup, completion | PR 2 | Base: PR 1; sender/warmup refactored |
| 3 | API layer + worker wiring | PR 3 | Base: PR 2; accounts CRUD, campaigns/contacts updated |
| 4 | UI: shadcn/ui pages for accounts, campaigns, contacts | PR 4 | Base: PR 3; tokens-only, no hardcoded colors |
| 5 | Test suite update + cleanup (delete client.ts) | PR 5 | Base: PR 4; 4 existing tests updated, 3 new test files |

## Phase 1: Data Model

- [x] T01 **[TDD: RED]** Write migration integration test: seed default account from AppConfig, verify Campaign.whatsappAccountId backfill
- [x] T02 **[TDD: GREEN]** Modify `prisma/schema.prisma`: add WhatsAppAccount + ContactList models, add whatsappAccountId/contactListId/order to Campaign, add contactListId to Contact, remove 4 fields from AppConfig
- [x] T03 Generate migration via `prisma migrate dev --name multi_account` and write seed script (`prisma/seed.ts`) that creates default WhatsAppAccount from AppConfig + backfills existing Campaigns + Contacts

## Phase 2: Core Backend

- [x] T04 **[TDD: RED→GREEN]** Create `src/lib/whatsapp/client-manager.ts`: Map<string, ClientSession> with getClient(id)/isReady(id)/getStatus(id)/getQr(id)/initializeAll()/destroy(id). Per-session paths at `./wa-sessions/{id}/`. Write client-manager.test.ts.
- [x] T05 **[TDD: REFACTOR]** Refactor `src/lib/whatsapp/sender.ts`: accept `client` param instead of calling internal `getClient()`. Update sendMessageSequence signature.
- [x] T06 **[TDD: RED→GREEN]** Refactor `src/lib/scheduler/warmup.ts`: all functions accept `accountId`, query via campaign→account join. Write per-account-warmup.test.ts.
- [x] T07 **[TDD: RED→GREEN]** Refactor `src/lib/scheduler/processContact.ts`: accept `campaignId`, add exported `checkCompletion(campaignId)` (PENDING=0 + reset stuck PROCESSING>10min → DONE). Write completion.test.ts.
- [x] T08 **[TDD: REFACTOR]** Refactor `src/lib/scheduler/index.ts`: `startScheduler(accountId)` with per-account cron, per-account ready/window/limit checks, `findActiveCampaign(accountId)` ordered by `order`, `stopScheduler(accountId)`.

## Phase 3: API Layer

- [x] T09 **[TDD: RED→GREEN]** Create `src/app/api/accounts/route.ts` (GET list + POST create), `src/app/api/accounts/[id]/route.ts` (PATCH/DELETE), `src/app/api/accounts/[id]/status/route.ts` (GET status+QR).
- [x] T10 Update `src/app/api/campaigns/route.ts`: POST accepts `whatsappAccountId`, `contactListId`; GET returns campaigns expanded with account info.
- [x] T11 Update `src/app/api/contacts/route.ts`: POST accepts `contactListId`; GET filters by `?contactListId=`. Keep backward-compat when listId omitted.
- [x] T12 Update `src/app/api/config/route.ts`: remove `waAccountStartDate`, `dailyLimit`, `sendWindow*` fields from POST/GET — these moved to WhatsAppAccount.
- [x] T13 Update `src/app/api/stats/route.ts` and `src/app/api/wa-status/route.ts`: per-account breakdowns, wa-status accepts `?accountId=`.

## Phase 4: UI (shadcn/ui tokens ONLY, no hardcoded colors)

- [ ] T14 Add account management tab to `src/app/settings/page.tsx`: table of WhatsAppAccount rows (name, status badge, dailyLimit, window), add/edit dialog using shadcn Dialog + Form + Input. Use `bg-primary`, `text-muted-foreground`, `border-border` tokens.
- [ ] T15 Update `src/app/campaigns/page.tsx`: campaign table shows account column, create form adds account Select + order input. Use shadcn Table + Select + Badge for status.
- [ ] T16 Update `src/app/contacts/page.tsx`: import form adds ContactList Select, table filters by list. Use shadcn Select for listId dropdown.

## Phase 5: Worker Integration + Cleanup

- [ ] T17 Update `src/worker/index.ts`: `clientManager.initializeAll()` → per-ready event → `startScheduler(accountId)`. On disconnect → `stopScheduler(accountId)`.
- [ ] T18 Delete `src/lib/whatsapp/client.ts`. Verify all imports point to client-manager throughout codebase.
- [ ] T19 Update existing 4 tests (`scheduler.test.ts`, `warmup.test.ts`, `processContact.test.ts`, `interpolate.test.ts`) for new function signatures. Run `pnpm test` — all must pass.
- [ ] T20 **[TDD: GREEN→REFACTOR]** Run full suite: `pnpm test`. Fix any failures. Verify backward compat: single-account setup works post-migration.
