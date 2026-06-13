# Design: Multi-Account Multi-Campaign

## Technical Approach

Replace singleton WhatsApp client with per-account `ClientManager` (lazy `Map<id, ClientSession>`). Scheduler becomes per-account: worker initializes all accounts, each ready event starts an independent cron tick. Campaign gains `whatsappAccountId` + `order` for priority queueing within an account. New `WhatsAppAccount` absorbs warmup/limit/window fields from `AppConfig`. Contact import gains `contactListId` binding. Completion detection runs after each message — when campaign's `PENDING` queue is empty (ignoring stuck `PROCESSING` >10 min), auto-transition to `DONE`.

## Architecture Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Multi-client strategy | (A) Singleton with account switching, (B) Map per account | **Map per account** | Each needs its own Puppeteer session, `LocalAuth` path, and lifecycle. Switching would require destroy/reinit. |
| Puppeteer config | (A) Shared browser, (B) Per-client browser | **Per-client with shared flags** | `whatsapp-web.js` manages its own browser internally. Share `--single-process --disable-gpu` via helper. |
| Scheduler architecture | (A) Single cron iterating all accounts, (B) One cron per account | **One cron per account** | Independent lifecycle: `stop(accountId)` when disconnected, restart on reconnect. Simpler error isolation. |
| Completion detection | (A) Worker-level sweep, (B) Per-tick check | **Per-tick after process** | Already counting `PENDING` is cheap. Check after message sends — if 0 AND no stuck `PROCESSING` >10 min → `DONE`. |
| Warmup refactor | (A) Pass `accountId` to existing functions, (B) New per-account module | **Pass `accountId`** | Minimal diff. `getDailyLimit(accountId)`, `getDailyCount(accountId)` use account join. |

## Data Model (Prisma Schema Changes)

```
+ WhatsAppAccount { id, name, waAccountStartDate, dailyLimit(50), 
    sendWindowStart(9), sendWindowStartMin(0), sendWindowEnd(19), 
    sendWindowEndMin(0), status("CONFIGURED"|"CONNECTED"|"DISCONNECTED") }
+ ContactList { id, name, campaignId @unique FK(Campaign) }
  
  Campaign: + whatsappAccountId FK(WhatsAppAccount)
            + contactListId? @unique FK(ContactList)  // nullable for migration
            + order Int @default(0)

  Contact:  + contactListId? FK(ContactList)  // nullable, backward-compat

  AppConfig: − waAccountStartDate, − dailyLimit, − sendWindow*
```

**Indexes**: `Campaign(status, order)` for scheduler lookup. `MessageQueue(status, campaignId)` for completion count.

## Key Components

### ClientManager (`src/lib/whatsapp/client-manager.ts`)
```
class ClientManager {
  sessions: Map<string, { client, status, qr, sessionPath }>
  getClient(id): Client        // lazy init with LocalAuth(./wa-sessions/{id}/)
  isReady(id): boolean
  getStatus(id): string
  getQr(id): string | null
  initializeAll(): Promise<void>   // reads accounts from DB, calls getClient for each
  destroy(id): Promise<void>       // calls client.destroy()
}
```
Replaces `src/lib/whatsapp/client.ts`. Per-session status writes to `./wa-sessions/{id}/.status.json`.

### Scheduler (`src/lib/scheduler/index.ts`)
```
startScheduler(accountId): void   // cron('* * * * *') → check per-account 
                                   // ready/window/limit → findActiveCampaign(accountId) 
                                   // → processNextContact(campaign) → checkCompletion(campaignId)
stopScheduler(accountId): void    // cronTask.stop()
```

`findActiveCampaign`: `Campaign.findFirst({ where: { whatsappAccountId, status: 'ACTIVE' }, orderBy: { order: 'asc' } })`.

### Migration (`prisma/migrations/multi-account/`)
1. Add `WhatsAppAccount` + `ContactList` tables
2. Add new columns to `Campaign` + `Contact` (nullable)
3. Seed: create default `WhatsAppAccount` from `AppConfig`
4. Update existing `Campaign`: set `whatsappAccountId = defaultId`, `order = 0`
5. Create `ContactList` for each existing campaign, link contacts
6. Remove columns from `AppConfig`

## Data Flow: Per-Tick Send (per account)

```
cron tick (accountId)
  │
  ├─ clientManager.isReady(accountId)? ──no── skip
  ├─ isWithinSendWindow(account.window)? ──no── skip  
  ├─ hasReachedDailyLimit(accountId)? ──yes── skip
  │
  └─ findActiveCampaign(accountId)
       │
       ├─ findFirst PENDING message (campaignId)
       ├─ mark PROCESSING → sendMessageSequence → SENT|FAILED
       ├─ checkCompletion(campaignId)
       │    └─ count PENDING=0? → reset stuck PROCESSING → 
       │       still 0? → campaign.status = 'DONE'
       └─ done
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/whatsapp/client-manager.ts` | **Create** | Multi-client Map, lazy init, per-account status/QR |
| `src/lib/whatsapp/client.ts` | **Delete** | Replaced by client-manager.ts |
| `src/lib/whatsapp/sender.ts` | Modify | Accept `client` param instead of calling `getClient()` |
| `src/worker/index.ts` | Modify | `initializeAll()` → on each ready → `startScheduler(id)` |
| `src/lib/scheduler/index.ts` | Modify | `startScheduler(accountId)`, per-account cron, campaign iteration |
| `src/lib/scheduler/warmup.ts` | Modify | All functions accept `accountId`, query via `campaign.whatsappAccountId` |
| `src/lib/scheduler/processContact.ts` | Modify | Accept `campaignId`, add `checkCompletion()` exported function |
| `src/app/api/accounts/route.ts` | **Create** | CRUD `WhatsAppAccount`, GET returns list + per-account status |
| `src/app/api/accounts/[id]/status/route.ts` | **Create** | GET returns `{ status, qr }` per account |
| `src/app/api/accounts/[id]/route.ts` | **Create** | PATCH (update account), DELETE |
| `src/app/api/campaigns/route.ts` | Modify | POST accepts `whatsappAccountId`, `contactListId`; GET returns all expanded |
| `src/app/api/contacts/route.ts` | Modify | POST accepts `contactListId`; GET filters by `?contactListId=` |
| `src/app/api/config/route.ts` | Modify | Remove warmup/window fields; `POST` only handles remaining globals |
| `src/app/api/stats/route.ts` | Modify | Per-account sent/failed/pending breakdown |
| `src/app/api/wa-status/route.ts` | Modify | Accept `?accountId=`, return per-account status |
| `src/app/campaigns/page.tsx` | Modify | Multi-campaign table, account selector on create form |
| `src/app/contacts/page.tsx` | Modify | ContactList selector on import |
| `src/app/settings/page.tsx` | Modify | Account management tab: list, add, warmup config per account |
| `prisma/schema.prisma` | Modify | +2 models, +4 fields across Campaign/Contact, −4 fields from AppConfig |

## UI Constraints

- **shadcn/ui tokens only**: All `.tsx` components MUST use shadcn UI design tokens (CSS variables from `globals.css`: `--primary`, `--secondary`, `--muted`, `--destructive`, `--background`, `--foreground`, `--card`, `--border`, `--ring`, etc.)
- **No hardcoded colors**: Never use raw hex/rgb/Tailwind color classes like `bg-red-500`, `text-blue-600`, `border-gray-200`. Use semantic tokens: `bg-destructive`, `text-muted-foreground`, `border-border`.
- **Component library**: Use shadcn/ui primitives (Button, Card, Badge, Dialog, Table, Select, Input, etc.) from `src/components/ui/`. Extend via `class-variance-authority` for variants, not custom colors.
- **Dark mode**: All new components must work in both light and dark mode via CSS variables — no overrides needed.

## Migration Strategy

**Additive-first**: migration adds new models/columns without deleting AppConfig columns. Post-migration seed script:
1. Read existing `AppConfig` → create default `WhatsAppAccount`
2. For each existing `Campaign`: set `whatsappAccountId`, `order = 0`
3. Create `ContactList(name: campaign.name, campaignId)` per campaign
4. Backfill `Contact.contactListId` for contacts already assigned to campaigns
5. Remove AppConfig columns in a follow-up migration (safe — nothing reads them)

Single-account flow continues: 1 account = 1 scheduler = same behavior as before.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | ClientManager init/destroy/status | Mock `whatsapp-web.js` Client. Verify `Map` operations, lazy init, session paths. |
| Unit | Per-account warmup (dailyLimit, dailyCount) | Mock Prisma with account scenarios (0, 4, 10, 20 days). |
| Unit | Campaign completion detection | Mock queue counts: PENDING=0, PENDING=0+stuck PROCESSING, PENDING>0. |
| Unit | `startScheduler` per-account tick | Mock clientManager, warmup, processContact. Verify guard conditions. |
| Integration | API CRUD (accounts, campaigns with accountId) | Real Prisma against test DB. |
| Integration | Backward compat: contact import without listId | Verify unassigned contacts work as before. |

Existing 4 tests updated for new function signatures. New files: `client-manager.test.ts`, `completion.test.ts`, `per-account-warmup.test.ts`.
