## ADDED: contact-list-management

| # | Requirement | Scenarios |
|---|-------------|-----------|
| R3 | ContactList: id, name, campaignId (unique FK, 1:1 to campaign). Contact gets contactListId FK. POST contacts MUST accept contactListId; GET MUST filter by `?contactListId=`. | **Happy**: GIVEN list "Dental Leads" WHEN POST 20 contacts with contactListId THEN all linked. **Edge**: GIVEN duplicate phones in import THEN upsert spares duplicates. |
