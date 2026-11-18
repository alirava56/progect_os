# تطبیق یافته‌های ممیزی ProjectOS با سورس

مبنا فایل `ProjectOS-Security-Hardened-Reviewed-2026-11-18.zip` با ۱۶۷ فایل است. ادعای «رفع» در جدول به تغییر همین نسخه و آزمون ثبت‌شده محدود است.

| یافته | وضعیت | شاهد سورس و آزمون |
|---|---|---|
| QA-01 / DOC-01 | جزئی | نصب تمیز و Build بومی Linux موفق. `playwright.smoke.config.ts` و `scripts/prepare-e2e.mjs` از Build تولید و SQLite موقت استفاده می‌کنند. ممیزی وابستگی توسعه هنوز قرمز است. |
| SEC-02 / Read→Write | رفع رگرسیون گزارش‌شده | `db.ts / saveState` مقایسه را با نمای ماسک‌شده انجام می‌دهد. سند بدون تغییر وارد تاریخچه نمی‌شود. `core.test.cjs` خطای قبلی و حفاظت از محتوای اصلی و زمان ثبت را پوشش می‌دهد. رمزهای قدیمی باقی‌مانده مسیر پاک‌سازی آفلاین دارند. |
| تاریخ قرارداد و کامنت | رفع دو نقص | `validation.ts / parseState, parseField` تاریخ کامنت را اعتبارسنجی و زمان قرارداد را برحسب UTC مقایسه می‌کند. دو تست ابتدا شکست خوردند و بعد از اصلاح پاس شدند. |
| CORE-01 | باز | `db.ts / getDb` به `node:sqlite` متصل است. `POSTGRES-TARGET-DRAFT.sql` پیش‌نویس مدل است. |
| CORE-02 | باز | `store.tsx / DemoProvider` و `record-service.ts / mutateRecord` نسخه سراسری Workspace و اعتبارسنجی Snapshot را استفاده می‌کنند. |
| ACCESS-01 | جزئی | `db.ts / readState` ارجاع Vault و رویداد مرتبط را فقط در پاسخ Owner می‌دهد. رگرسیون HTTP پاسخ Snapshot، رکورد مستقیم و HTML را می‌آزماید. ACL پروژه پیاده نشده است. |
| ACCESS-02 | باز | `invitations.ts / acceptInvitation` عضویت فعال دوم را رد می‌کند. `db.ts / accountByUser` تنها یک ردیف عضویت می‌خواند. |
| AUTH-01 | باز | `auth.ts / authenticate` قفل حساب و `lookupSessionUserId` انقضا دارند. Session revoke و RBAC محدود روی HTTP تست شده‌اند. مابقی چرخه هویت و ضد سوءاستفاده باز است. |
| SEC-01 | باز | `vault-link.ts` فقط ارجاع HTTPS را اعتبارسنجی می‌کند. Provider واقعی وجود ندارد. |
| REM-01 / REM-02 | جزئی | `run-reminders.mjs` شناسهٔ جدید را همواره از نوع منبع و موعد می‌سازد و حذف منابع هم‌نام وضعیت تحویل منبع باقی‌مانده را بازنویسی نمی‌کند. موارد تاریخی بدون انتساب مطمئن در شمارندهٔ `ambiguousLegacy` دیده می‌شوند. تکرار، مهاجرت جامع و زمان‌بندی عملیاتی بازند. |
| MSG-01 | باز | `deliver-notifications.mjs` فراخوانی Provider و ثبت تحویل را در دو مرحله انجام می‌دهد. ارسال واقعی و بازیابی پس از Crash بررسی نشده‌اند. |
| DR-01 | باز | آزمون هسته، فرمت محلی v1 و تشخیص دستکاری را اجرا می‌کند. بازسازی Staging و Offsite باقی است. |
| MON-01 | باز | `run-monitors.mjs` پروب HEAD HTTPS و API حالت stale دارند. داده CPU/RAM، VPN، DNS/SSL عملیاتی نداریم. |
| INT-01 | باز | مسیر `api/integrations/github` خواندنی و allowlist-based است. Sync و Webhook پیاده نشده‌اند. |
| FIN-01 | باز | `finance.tsx` واحدهای مالی را نمایش می‌دهد. تطبیق پرداخت، Ledger و گزارش ارزی کامل نشده‌اند. اعتبارسنجی مبلغ اعشاری در HTTP اجرا شده است. |
| AI-01 | باز | `api/assistant` جست‌وجوی کلمه‌ای و فراخوانی اختیاری دارد. ACL پروژه و راستی‌آزمایی استناد و ارزیابی مدل باقی است. |
