## ADDED: per-account-anti-ban

| # | Requirement | Scenarios |
|---|-------------|-----------|
| R6 | Warmup functions SHALL accept accountId: `getDailyLimit(accountId)` uses account's startDate; `getDailyCount(accountId)` counts via campaign→account join. Each account tracks independent warmup (10/20/35/dailyLimit). | **Happy**: GIVEN AccA 2 days old, AccB 10 days old THEN limits=10 and 35. **Edge**: GIVEN AccA window=9-13, AccB=14-19 WHEN tick at 15:00 THEN AccA skipped. |
