## ADDED: multi-campaign-execution

| # | Requirement | Scenarios |
|---|-------------|-----------|
| R4 | ClientManager: Map<string, ClientSession> — per-account lazy init via `getClient(accountId)`. Sessions write to `./wa-sessions/{id}/`. | **Happy**: GIVEN 2 accounts WHEN init both THEN 2 independent Puppeteer sessions exist. |
| R5 | Campaign gains whatsappAccountId, contactListId, order. GET `/api/campaigns` returns all expanded. Auto-completion: when PENDING=0 AND no PROCESSING stuck >10min, transition to DONE. | **Edge**: GIVEN campaign has 1 PROCESSING for 15min AND 0 PENDING WHEN tick THEN reset stuck→PENDING, re-evaluate completion. |
