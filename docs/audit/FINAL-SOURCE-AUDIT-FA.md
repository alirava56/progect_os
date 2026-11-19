# ممیزی مستقل سورس ProjectOS

مبنای مقایسه، ZIP تأییدشدهٔ P0 است. شواهد اجرای جاری و موارد باز در [گزارش تحویل](../verification/FINAL-DELIVERY-REPORT-FA.md) آمده‌اند.

| شناسهٔ ممیزی | یافتهٔ تطبیق‌داده‌شده و اقدام | شاهد |
|---|---|---|
| CORE-01 | SQLite مسیر قبلی بود. PostgreSQL در درخواست واقعی HTTP و ابزار Import به Runtime متصل شد. | `scripts/database.mjs`، `schema/postgres/`، `test:postgres` و `test:postgres-http` |
| CORE-02 | UI قبلی Snapshot می‌نوشت. UI اکنون Batch رکورد و کنترل نسخهٔ رکورد را به کار می‌گیرد. دو تغییر مستقل و Rollback جزیی آزموده شدند. | `src/lib/store.tsx`، `src/lib/server/record-service.ts`، `tests/release.spec.ts` |
| ACCESS-01 | Snapshot و بعضی APIها فقط دامنهٔ Workspace داشتند. Scope پروژه، فیلد Vault و History اعمال شدند. | `src/lib/server/db.ts`، History، تست منفی HTTP |
| ACCESS-02 | یک عضویت فعال با قید یکتا اعمال شد و انتخاب تصادفی Workspace از Query حذف شد. | `001_initial.sql`، `scripts/sqlite.mjs`، `src/lib/server/invitations.ts` |
| SEC-01 | پیوندهای قدیمی Vault حفظ شدند. آداپتر KV v2 فقط endpoint فراداده را می‌خواند. اتصال HashiCorp آزمایشی وابسته به محیط بیرونی است. | `src/lib/server/vault.ts` و `/api/vault/[id]` |
| SEC-02 | رکورد قدیمی مشکوک در ویرایش غیرمرتبط حفظ می‌شود. تغییر مستقیم نیازمند رسیدگی آفلاین است و Import دادهٔ علامت‌خورده را متوقف می‌کند. پوشش الگوها محدود است. | گارد ذخیره، `sqlite-import.mjs` و رگرسیون P0 |
| AUTH-01 | محدودیت ورود پایدار و بدون قفل سراسری حساب، MFA اجباری برای استقرار خارج از loopback و Rotation نشست اضافه شد. | `auth.ts`، `mfa.ts` و تست HTTP Recovery |
| REM-01 / REM-02 | شناسهٔ پایدار و سازگاری قبلی حفظ شد. Scheduler روی هر دو DB، تکرار، zone و Snooze را پردازش می‌کند. | `reminder-scheduler.mjs` و تست‌های ۲۶، ۲۷ و DST |
| MSG-01 | Lease، Retry و حالت نهایی `failed` پیاده شدند. پذیرش ارائه‌دهنده با رسید خواندن یکی نیست. | `notification-delivery.mjs`، تست Crash/Lease |
| DR-01 | PostgreSQL Backup رمزنگاری‌شده و Restore در مقصد تازه را پاس کرد. Offsite و RPO/RTO محیط هدف باقی‌اند. | `postgres-archive.mjs` و `test:postgres` |
| MON-01 | HTTPS به IP عمومی ثابت‌شده، TLS و منبع مشاهده مجهز شد. عامل میزبان CPU/RAM را گزارش می‌دهد. VPN، DNS SLO و چندنقطه‌ای بازند. | `monitor-probe.mjs` و `report-monitor-agent.mjs` |
| INT-01 | نگاشت Repo/Project، Sync خواندنی، Retry و اعتبارسنجی Webhook اجرا شدند. بستن چرخهٔ خودکار Webhook به Backfill و آزمون GitHub آزمایشی باز است. | `github.ts`، API وب‌هوک و تست Mock |
| FIN-01 | واحدهای پایه و جمع دقیق BigInt جدا شدند. واردات دادهٔ قدیمی دلار را حفظ می‌کند. Ledger پرداخت مستقل، Invoice، تخصیص منابع مشترک و FX دارای منبع بازند. | `money.ts`، `finance.tsx` و رگرسیون CSV |
| AI-01 | بازیابی پیش از ارسال Scoped است. رضایت همان پرسش لازم است و خروجی با گزیدهٔ منبع تطبیق داده می‌شود. ارزیابی سرویس بیرونی باز است. | `project-memory.ts`، `/api/assistant` و تست استناد |
| QA-01 / DOC-01 | تست‌های موجود بازاجرا شدند. Smoke ایزوله، HTTP، axe و اندازه‌گیری محلی اضافه شدند. CI میزبانی‌شده هنوز باید اجرا شود. | شواهد Windows، `ci.yml` و گزارش تحویل |

هیچ نتیجهٔ قبلی برای PASS نشانه‌گذاری نشده است. گزارش‌ها، ۳۲ فایل PNG ورودی و آزمون‌های قبلی در شاخهٔ محلی منشأ مشخص دارند.