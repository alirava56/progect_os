# مدل دادهٔ اجراشده در Private Preview

این نمودار ارتباط جدول‌های SQLite را نشان می‌دهد. ارجاع‌های داخل JSON با `parseState` کنترل می‌شوند. رابطهٔ `RECORDS.project_id` با پروژه و ارجاع `notification_outbox.reminder_id` کلید خارجی SQL ندارند.

```mermaid
erDiagram
  USERS ||--o{ MEMBERSHIPS : joins
  WORKSPACES ||--o{ MEMBERSHIPS : grants
  USERS ||--o{ SESSIONS : authenticates
  USERS ||--o{ MFA_RECOVERY_CODES : owns
  USERS ||--o{ AUDIT_EVENTS : acts
  WORKSPACES ||--o{ WORKSPACE_INVITES : issues
  WORKSPACES ||--o{ RECORDS : stores
  WORKSPACES ||--o{ DOCUMENT_VERSIONS : versions
  WORKSPACES ||--o{ AUDIT_EVENTS : logs
  WORKSPACES ||--o{ NOTIFICATION_OUTBOX : queues
```

- کلید رکورد `(workspace_id, kind, id)` است. پروژه، تسک، منابع، حسابداری، یادآوری، ارجاع Vault و تنظیمات در payload همین جدول نگهداری می‌شوند.
- نسخهٔ سراسری Workspace نوشتن قدیمی را رد می‌کند. Editor برای تغییر یک رکورد به همان نسخه وابسته است.
- `document_versions` با `(workspace_id, document_id, revision)` تاریخچهٔ سند را جدا نگه می‌دارد.
- `notification_outbox` وضعیت تحویل را برای کانال و موعد نگه می‌دارد. Worker تلگرام اطلاعات retry را جداگانه ثبت می‌کند.
- PostgreSQL در Runtime فعال نیست. [پیش‌نویس مدل مقصد](POSTGRES-TARGET-DRAFT.sql).
