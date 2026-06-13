## MODIFIED: campaign-scheduling

| # | Requirement (change) | Scenarios |
|---|----------------------|-----------|
| R7 | **Before**: `startScheduler()` reads single AppConfig, global `isReady()`, one PENDING job. **After**: `startScheduler(accountId)` iterates active campaigns by order, checks per-account ready/window/limit, processes one message per tick per account. Worker launches $k$ schedulers for $k$ accounts. | **Happy**: GIVEN account has campaigns order=1(Dental),2(RE) WHEN Dental completes THEN next tick picks RE. |
