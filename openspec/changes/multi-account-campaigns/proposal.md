# Proposal: Multi-Account Multi-Campaign WhatsApp Outreach

## Intent

Current system is locked to one WhatsApp account and one active campaign. Running all campaigns through one number hits the daily limit fast and raises ban risk. This change enables 2 WhatsApp accounts running parallel campaigns on different numbers with independent anti-ban warmup — doubling throughput while reducing per-account risk.

## Scope

### In Scope
- `WhatsAppAccount` model (name, session path, start date, daily limit, send window)
- `ContactList` model (named group, tied to one campaign)
- Multi-client manager replacing singleton — `Map<accountId, session>`
- Per-account warmup cycle (10/20/35/dailyLimit), independent start dates
- Campaign-to-account assignment (`whatsappAccountId`, `contactListId`, `order`)
- Scheduler: iterate active campaigns per account, process sequentially within account
- Campaign auto-completion: transition to DONE when all messages terminal (SENT | FAILED)
- API routes: multi-campaign list/create, contact import with list assignment
- UI: campaign table (multiple cards), account setup page, per-list contact import

### Out of Scope
- Dynamic account pooling or automatic failover between accounts
- Account health monitoring dashboard
- Parallel campaigns sharing the same account
- WhatsApp Web multi-device beta migration
- Reusable contact lists across campaigns

## Capabilities

### New Capabilities
- `whatsapp-account-management`: CRUD for WhatsApp accounts, per-account session lifecycle, QR per account
- `contact-list-management`: Named contact lists, import with list assignment
- `multi-campaign-execution`: Parallel campaigns on different accounts, sequential within account, completion detection
- `per-account-anti-ban`: Independent warmup cycles, per-account daily limits, per-account send windows

### Modified Capabilities
- `campaign-scheduling`: Scheduler iterates accounts → active campaigns instead of single global loop
- `contact-import`: Adds `contactListId` parameter to POST; GET filters by list

## Approach

**Schema** — Add `WhatsAppAccount` (absorbs warmup/limit/window fields from `AppConfig`), `ContactList`. Extend `Campaign` with `whatsappAccountId`, `contactListId`, `order`. Extend `Contact` with `contactListId`. `AppConfig` retains global defaults only.

**Client Manager** (`src/lib/whatsapp/client-manager.ts`) — `Map<string, { client, status, qr, sessionPath }>`. Lazy init per account via `getClient(accountId)`. Each session writes to own `./wa-sessions/{id}/`.

**Worker** — Initialize clients for all accounts, listen for ready events, start per-account schedulers.

**Scheduler** — Per-account cron job queries active campaigns ordered by `order`. Process one message per tick per account. Auto-transition campaign to DONE when `PENDING` count = 0.

**Migration** — Create `WhatsAppAccount` from existing `AppConfig` values. Move single existing campaign to default account. Backfill `ContactList` with unlisted contacts.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | Add 2 models, extend 3 models, migration file |
| `src/lib/whatsapp/client.ts` | Removed | Replaced by `client-manager.ts` |
| `src/lib/whatsapp/client-manager.ts` | New | Multi-client map, per-account init/status/QR |
| `src/worker/index.ts` | Modified | Multi-client init, per-account scheduler start |
| `src/lib/scheduler/index.ts` | Modified | Per-account iteration, campaign list loop |
| `src/lib/scheduler/warmup.ts` | Modified | Accept `accountId` param, per-account limits |
| `src/lib/scheduler/processContact.ts` | Modified | Campaign completion detection |
| `src/app/api/campaigns/route.ts` | Modified | `findMany`, contact list selection, account assignment |
| `src/app/api/contacts/route.ts` | Modified | `contactListId` in POST, list filter in GET |
| `src/app/api/config/route.ts` | Modified | Profile fields moved to account; add `POST/PUT /api/accounts` |
| `src/app/api/stats/route.ts` | Modified | Per-account/per-campaign breakdown |
| `src/app/campaigns/page.tsx` | Modified | Multi-campaign table, account selector |
| `src/app/contacts/page.tsx` | Modified | List selector on import, list column in table |
| `src/app/settings/page.tsx` | Modified | Account management (new tab/section) |
| `src/lib/scheduler/__tests__/*` | Modified | Per-account mocks, completion detection tests |
| New tests | New | `client-manager.test.ts`, campaign-completion edge cases |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 2 Puppeteer instances = ~700MB extra RAM | Medium | Configure `--disable-gpu`, `--single-process` flags; document minimum 2GB RAM |
| QR UX deadlock — user misses one account's QR scan | Medium | Per-account status card with QR regeneration button; scheduler skips disconnected accounts |
| SQLite write contention with 2 concurrent clients | Low | Prisma connection pooling; serial writes per tick (one message at a time per account) |
| Campaign never transitions to DONE if PROCESSING stuck | Medium | Stuck detection: if `PROCESSING` for >10 min, reset to `PENDING`; completion check excludes `PROCESSING` |
| Existing test suite (4 tests) breaks on model changes | High | Update mocks to match new schema; add per-account test fixtures before refactoring |

## Rollback Plan

1. Keep `AppConfig` fields during migration (migration is additive, not destructive)
2. `git revert` the schema migration and all changed files
3. Restore singleton client by reverting `client-manager.ts` → old `client.ts`
4. Single-campaign API/UI paths unchanged in rollback (campaigns with `whatsappAccountId` become orphaned but functional)

## Dependencies

- `whatsapp-web.js` 1.x (already in use) — supports multiple clients via separate `LocalAuth` sessions
- Puppeteer (bundled) — no additional installs needed
- Prisma migration for 5 schema changes

## Success Criteria

- [ ] Two campaigns run simultaneously on two different WhatsApp numbers
- [ ] Each account has independent warmup cycle (start date → 10/20/35/dailyLimit)
- [ ] Campaign auto-transitions to DONE when all messages are SENT or FAILED
- [ ] Contact import assigns contacts to a named list tied to a campaign
- [ ] Existing 4 tests pass with updated mocks + 3 new test files for client manager, completion detection, per-account warmup
