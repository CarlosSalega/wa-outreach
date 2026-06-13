## ADDED: whatsapp-account-management

| # | Requirement | Scenarios |
|---|-------------|-----------|
| R1 | WhatsAppAccount CRUD: name, waAccountStartDate, dailyLimit, sendWindowStart/Min, sendWindowEnd/Min, status (CONFIGURED→CONNECTED). Migration MUST seed one account from AppConfig. | **Happy**: GIVEN admin POST `{name:"Dental"}` THEN account appears with CONFIGURED. **Edge**: GIVEN account DISCONNECTED WHEN QR requested THEN status=DISCONNECTED, QR=null. |
| R2 | GET `/api/accounts/[id]/status` SHALL return connection status + QR data URL per account. | |
