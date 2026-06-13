## MODIFIED: contact-import

| # | Requirement (change) | Scenarios |
|---|----------------------|-----------|
| R8 | **Before**: POST `{phone, agencyName}[]`, GET flat. **After**: POST accepts `contactListId` per-import; GET filters by `?contactListId=`. | **Edge**: GIVEN import without listId THEN backward-compat works as before. |
