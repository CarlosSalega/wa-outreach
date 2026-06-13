# Delta Specs: Multi-Account Multi-Campaign

## ADDED: whatsapp-account-management

| # | Requirement | Scenarios |
|---|-------------|-----------|
| R1 | WhatsAppAccount CRUD: name, waAccountStartDate, dailyLimit, sendWindowStart/Min, sendWindowEnd/Min, status (CONFIGURED→CONNECTED). Migration MUST seed one account from AppConfig. | **Happy**: GIVEN admin POST `{name:"Dental"}` THEN account appears with CONFIGURED. **Edge**: GIVEN account DISCONNECTED WHEN QR requested THEN status=DISCONNECTED, QR=null. |
| R2 | GET `/api/accounts/[id]/status` SHALL return connection status + QR data URL per account. | |

## ADDED: contact-list-management

| # | Requirement | Scenarios |
|---|-------------|-----------|
| R3 | ContactList: id, name, campaignId (unique FK, 1:1 to campaign). Contact gets contactListId FK. POST contacts MUST accept contactListId; GET MUST filter by `?contactListId=`. | **Happy**: GIVEN list "Dental Leads" WHEN POST 20 contacts with contactListId THEN all linked. **Edge**: GIVEN duplicate phones in import THEN upsert spares duplicates. |

## ADDED: multi-campaign-execution

| # | Requirement | Scenarios |
|---|-------------|-----------|
| R4 | ClientManager: Map<string, ClientSession> — per-account lazy init via `getClient(accountId)`. Sessions write to `./wa-sessions/{id}/`. | **Happy**: GIVEN 2 accounts WHEN init both THEN 2 independent Puppeteer sessions exist. |
| R5 | Campaign gains whatsappAccountId, contactListId, order. GET `/api/campaigns` returns all expanded. Auto-completion: when PENDING=0 AND no PROCESSING stuck >10min, transition to DONE. | **Edge**: GIVEN campaign has 1 PROCESSING for 15min AND 0 PENDING WHEN tick THEN reset stuck→PENDING, re-evaluate completion. |

## ADDED: per-account-anti-ban

| # | Requirement | Scenarios |
|---|-------------|-----------|
| R6 | Warmup functions SHALL accept accountId: `getDailyLimit(accountId)` uses account's startDate; `getDailyCount(accountId)` counts via campaign→account join. Each account tracks independent warmup (10/20/35/dailyLimit). | **Happy**: GIVEN AccA 2 days old, AccB 10 days old THEN limits=10 and 35. **Edge**: GIVEN AccA window=9-13, AccB=14-19 WHEN tick at 15:00 THEN AccA skipped. |

## MODIFIED: campaign-scheduling

| # | Requirement (change) | Scenarios |
|---|----------------------|-----------|
| R7 | **Before**: `startScheduler()` reads single AppConfig, global `isReady()`, one PENDING job. **After**: `startScheduler(accountId)` iterates active campaigns by order, checks per-account ready/window/limit, processes one message per tick per account. Worker launches $k$ schedulers for $k$ accounts. | **Happy**: GIVEN account has campaigns order=1(Dental),2(RE) WHEN Dental completes THEN next tick picks RE. |

## MODIFIED: contact-import

| # | Requirement (change) | Scenarios |
|---|----------------------|-----------|
| R8 | **Before**: POST `{phone, agencyName}[]`, GET flat. **After**: POST accepts `contactListId` per-import; GET filters by `?contactListId=`. | **Edge**: GIVEN import without listId THEN backward-compat works as before. |

## REMOVED

- **src/lib/whatsapp/client.ts** — singleton incompatible with multi-account. Replaced by client-manager.ts.

## Schema Diff

```
+ WhatsAppAccount: id, name, waAccountStartDate, dailyLimit, sendWindow*, status
+ ContactList: id, name, campaignId(unique FK)
  Campaign: + whatsappAccountId FK, + contactListId FK(unique), + order
  Contact: + contactListId FK
  AppConfig: − waAccountStartDate, − dailyLimit, − sendWindow*
```

## Required Tests

| Domain | Test scope |
|--------|-----------|
| whatsapp-account | API CRUD, migration seed, QR endpoint |
| contact-list | List CRUD, import with listId, GET filter |
| multi-campaign | ClientManager init/destroy, completion detection, stuck recovery |
| per-account-anti-ban | Per-account warmup phases, daily count isolation, window straddling |
| campaign-scheduling | Per-account tick: skip disconnected, order priority, one msg/tick |
| contact-import | Backward compat (no listId), listId validation |

## Non-Functional

- **Memory**: 2 Puppeteer instances ≤~1.4GB via `--single-process --disable-gpu`
- **Concurrency**: One write per tick per account. No lock contention.
- **Recovery**: PROCESSING >10min → reset to PENDING before completion check.
- **Backward**: Single-account setup continues working post-migration.
