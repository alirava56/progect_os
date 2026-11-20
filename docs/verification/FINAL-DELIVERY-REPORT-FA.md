# گزارش نهایی تحویل ProjectOS

## ادامهٔ توسعه در ۲۰ نوامبر ۲۰۲۶

| قابلیت | وضعیت | شواهد |
|---|---|---|
| ساخت و ویرایش پروژه، ثبت VPS، دو دامنه، دیتابیس، دو وظیفه و Runbook از رابط فارسی | `IMPLEMENTED_AND_VERIFIED` | `npm run test:project-lifecycle`، هر سه پروژهٔ آزمایشی NovaGuard، باشگاه و MOKMOK موفق در Chrome و PostgreSQL 17.12 محلی. مرورگر تازه پس از Restart و ورود مجدد، داده‌ها و ارتباط والد دیتابیس را نشان داد. |
| بایگانی با تأیید سرور و حذف از صفحهٔ پروژه | `IMPLEMENTED_AND_VERIFIED` | `npm run test:smoke`، Chrome با ۱۶ نتیجهٔ موفق. حذف پروژهٔ خالی بایگانی‌شده موفق بود. درخواست حذف پروژهٔ دارای منبع مشترک رد شد و هر دو رکورد باقی ماندند. |
| هزینهٔ تمدید منبع مشترک و مرتب‌سازی منابع بر اساس نام یا موعد تمدید | `IMPLEMENTED_AND_VERIFIED` | ثبت ۱۲٫۵۰ دلار با مقدار دقیق ۱۲۵۰ سنت، بازیابی خطای فرم و رد ارجاع نامعتبر در هر دو API نوشتن. بعد از لغو اشتراک‌گذاری، عضو محدود هزینه را می‌بیند و شناسهٔ منبع در پاسخ حذف می‌شود. |
| ورود واقعی و راه‌اندازی سه‌مرحله‌ای، RTL و Responsive | `IMPLEMENTED_AND_VERIFIED` | آزمون ورود دموی تاریخی با بررسی ورود ناموفق و موفق، عدم ماندگاری رمز در Browser Storage، و ذخیرهٔ فضای کاری و وظیفهٔ اختیاری جایگزین شد. هر ۶ آزمون تاریخی RTL، ۲۱ صفحه را در عرض ۳۶۰، ۳۹۰، ۷۶۸، ۱۰۲۴، ۱۴۴۰ و ۱۹۲۰ بررسی می‌کنند. |
| ارجاع SSH Key به VPS در فاز ۲ | `IMPLEMENTED_AND_VERIFIED` | فرم مالک، مسیر دسترسی از جزئیات سرور، ذخیرهٔ فراداده، رد پروژهٔ نامرتبط و فیلد رمز خام، جلوگیری از حذف منبع دارای ارجاع و محدودیت خواندن Viewer آزموده شد. آزمون PostgreSQL حفظ ارتباط را در Migration و Restore تأیید کرد. |
| تأیید اتصال Vault در Staging | `BLOCKED_EXTERNAL` | آزمون قرارداد Mock از قبل سبز بود. بررسی اتصال واقعی و مجوز کاربر در Vault بیرونی باز است. |
| پذیرش کل فاز ۱ | `PARTIAL` | سناریوهای اصلی ماندگاری و روال‌های جدید سبز هستند. تکمیل پوشش مجموعه‌های تاریخی و یکپارچگی همهٔ فرم‌ها باز است. |

`npm ci --include=optional`، `npm run lint`، `npm run build` با TypeScript، ۴۲ تست هسته و آزمون‌های محلی `test:postgres` و `test:postgres-http` موفق بودند. مجموعهٔ ۱۸‌تایی Chrome، Firefox و WebKit سبز شد. پس از افزودن ۷ آزمون سازگارشدهٔ تاریخی، Chromium هر ۲۵ سناریو را پاس کرد. ۱۳ آزمون تاریخی Workflow همچنان از الگوی دمو استفاده می‌کنند و برای این نسخه تأیید نشده‌اند.

اجرای [CI نسخهٔ مبنا](https://github.com/alirava56/progect_os/actions/runs/44632719901) و [CI آزمون‌های تاریخی](https://github.com/alirava56/progect_os/actions/runs/44641957900) در بازیابی PostgreSQL 16 خطا دادند. [اجرای فاز ۱](https://github.com/alirava56/progect_os/actions/runs/44634151927) و [اجرای هزینه و دسترسی](https://github.com/alirava56/progect_os/actions/runs/44635325658) در Windows، Ubuntu، CodeQL و آزمایش‌های PostgreSQL موفق بودند. اکنون خرابی ابزار Backup یا Restore، مرحله و پیام تشخیصی ثابت را ثبت می‌کند و آرشیو نامعتبر در آزمون رد می‌شود. علت خطای متناوب CI هنوز قطعی نیست. وضعیت انتشار همچنان **NO-GO** است. جدول زیر سند اجرای ۱۹ نوامبر است.

**حکم انتشار Production: NO-GO**

تاریخ اجرای محلی ۱۹ نوامبر ۲۰۲۶، منطقهٔ زمانی تهران. مبنا `ProjectOS-P0-Verified-2026-11-18.zip` با SHA-256 `376662fcef9af1b20ed2f3e421121a85666a1c4aeb32e758e8b69843be83c019` است. اولین Commit محلی `44916a2f5b04212780d11eb410661c8e9742341b` و Commit سورس و تست گزارش‌شده `64359a57cb9a17ddeb2eeb770cea46550a546965` است. این شناسه‌ها در این اجرا از ZIP ساخته شده‌اند.

سورس تحویلی ۲۰ مسیر Workspace، ۲۱ مسیر API و ۳۲ آیکون اصلی دارد. Git هیچ تغییری در فایل‌های آیکون نسبت به ورودی نشان نداد. عملیات روی کپی سورس و دیتابیس‌ها و حساب‌های موقت انجام شد. اتصال‌های Production، دادهٔ واقعی و استقرار عمومی خارج از اجرا بودند.

## Gateها و شواهد

| Gate | وضعیت | پیاده‌سازی، دستورات و شواهد کد | باقیمانده برای PASS |
|---|---|---|---|
| A — تثبیت | **FAIL** | `npm ci --include=optional`، `typecheck`، `lint`، `test:core`، `build`، `test:smoke` در Chrome و WebKit و `npm audit --audit-level=high` روی Windows موفق‌اند. `tests/isolated-app.ts`، `scripts/prepare-e2e.mjs`، `playwright.smoke.config.ts`، `next.config.ts` و `.github/workflows/ci.yml`. | ۲۰ آزمون تاریخی مؤلفه‌های دمو در Build فعلی شکست خوردند. Firefox محلی برای ۴ تست صفحه راه‌اندازی نشد. CI میزبانی‌شدهٔ Windows/Linux و CodeQL در این اجرا **BLOCKED_EXTERNAL** هستند. |
| B — Backend و امنیت | **FAIL** | PostgreSQL واقعی در Build تولید، ۳ Migration اسکیمای SQL، Import از SQLite، نسخهٔ رکورد، Batch اتمیک، Scope پروژه و فیلد، MFA ثبت/تغییر و مدیریت نشست. `npm run test:postgres`، `npm run test:postgres-http`، Core و HTTP از جمله دو ویرایش مستقل، تضاد هم‌رکورد، Grant، CSRF و Recovery موفق‌اند. `schema/postgres/`، `scripts/sqlite-import.mjs`، `src/lib/server/{db,record-service,auth,mfa,invitations}.ts` و APIهای مرتبط. | مدل دامنه هنوز از payloadهای سازگار رکورد استفاده می‌کند. نرمال‌سازی کامل مدل هدف و RLS باقی‌اند. بررسی نقش واقعی سرویس، تمرین Cutover و Rollback پس از شروع نوشتن در محیط هدف انجام نشده‌اند. |
| C — Vault، یادآوری و Backup | **BLOCKED** | آداپتر فقط فرادادهٔ HashiCorp KV v2، یادآوری تقویمی، حفظ شناسه، Snooze، Outbox در هر دو موتور، Retry/Lease و Backup/Restore رمزنگاری‌شده. `npm run test:core`، تست Mock Vault و Crash/Lease و `npm run test:postgres` موفق‌اند. `src/lib/server/vault.ts`، `scripts/reminder-scheduler.mjs`، `scripts/notification-delivery.mjs`، `scripts/postgres-archive.mjs`. | Vault، Telegram، Resend و Worker زمان‌بندی‌شده روی Staging **BLOCKED_EXTERNAL** هستند. نگهداشت Offsite و RPO/RTO واقعی **BLOCKED_EXTERNAL** هستند. وضعیت ارسال آزمایشی حد پذیرش ارائه‌دهنده را از خوانده‌شدن جدا می‌کند. |
| D — قابلیت‌های پیشرفته | **FAIL** | HTTPS و TLS با بررسی DNS، مسیر عامل CPU/RAM دارای زمان و منبع، GitHub خواندنی با وب‌هوک، Scope، Retry، آثار مالی BigInt در واحد جدا و حافظهٔ پروژهٔ Scoped با بررسی گزیده. `npm run test:core` و Smoke HTTP حافظه پاس شدند. `scripts/monitor-probe.mjs`، `src/lib/server/github.ts`، `src/lib/money.ts`، `src/lib/server/project-memory.ts` و APIها. | Ledger مستقل پرداخت، Invoice، تخصیص منابع و FX دارای منبع باقی‌اند. Backfill خودکار GitHub و VPN، DNS SLO و پایش چندنقطه‌ای تکمیل نشده‌اند. تأیید سرویس‌های GitHub، عامل میزبان و مدل AI در محیط آزمایشی **BLOCKED_EXTERNAL** است. |
| E — تأیید نهایی | **FAIL** | ۱۵/۱۵ سناریو در Chrome و WebKit. ۲۰ مسیر Workspace در سه عرض ۳۹۰، ۷۶۸ و ۱۴۴۰. axe بر ورود و داشبورد، MFA، کنترل نقش، فرم فارسی واقعی، P95 محلی و Restore/Migration/Rollback تراکنشی. `tests/functional.spec.ts`، `tests/release.spec.ts` و `scripts/postgres.test.cjs`. | Firefox و مجموعهٔ تاریخی کامل سبز نیستند. بررسی دستی و سراسری WCAG، load/soak محیط هدف، آزمون امنیت مستقل، اجرای Linux میزبانی‌شده و DR/Cutover بیرونی باقی دارند. |

## خروجی بازتولیدپذیر

محیط نهایی Windows x64، Node.js 22.23.5، npm 10.9.9، Next.js 16.4.6 و PostgreSQL 17.12 محلی بود. خلاصهٔ Baseline و فهرست تغییرات در [پوشهٔ شواهد](evidence-2026-11-19/) آمده‌اند. لاگ‌های خام این اجرا در نسخهٔ محلی تحویل باقی مانده‌اند.

| دستور | کد خروج | نتیجه |
|---|---:|---|
| `npm ci --include=optional` در کپی تازه از Commit میانی با همین Lockfile | 0 | Windows، وابستگی‌های اختیاری درست نصب شدند. |
| `npm run typecheck` / `npm run lint` | 0 / 0 | هردو روی سورس و تست جاری موفق. |
| `npm run test:core` | 0 | ۴۲ موفق از ۴۲، شامل ۳۵ تست اصلی و ۷ رگرسیون جدید. هیچ مورد Skip نشد. |
| `npm run build` | 0 | Build تولید. بسته‌بندی `pg` مشکل Junction در Windows را رفع کرد. |
| `npm run test:smoke` با Chrome 157.0.8103.79 نصب‌شده | 0 | ۱۵ موفق، شامل هر ۹ آزمون Smoke قبلی. |
| `npm run test:smoke -- --browser=webkit` با TLS موقت loopback | 0 | ۱۵ موفق. هر ۴ مسیر مرتبط با مرورگر واقعی اجرا شد. |
| `npm run test:smoke -- --browser=firefox` با همان TLS و پوشهٔ موقت مستقل | 1 | ۱۱ تست API موفق، ۴ تست نیازمند مرورگر با خطای شروع فرایند Firefox متوقف شدند. |
| `npm audit --audit-level=high` | 0 | صفر مورد در خروجی همین رجیستری و تاریخ. |
| `npm run test:postgres` | 0 | ۱ آزمون یکپارچهٔ ترتیبی. هش و شمارش Import، اجرای دوباره، Failure قبل از Commit، احراز هویت، هم‌زمانی، آرشیو و Restore به دیتابیس خالی آزموده شدند. |
| `npm run test:postgres-http` | 0 | Build تولید PostgreSQL را واقعاً برای Health، Setup و عملیات رکوردی استفاده کرد. |
| `npx playwright install chromium firefox webkit` | 1 | دانلود Chromium با 403 رجیون متوقف شد. Chrome نصب‌شده برای اجرا استفاده شد. |
| `npx playwright install firefox webkit` | 0 | دو موتور دریافت شدند. نتیجهٔ اجرای خود Firefox در ردیف جدا آمده است. |
| Playwright با `responsive.spec.ts` و `workflows.spec.ts` در سرور موقت Build تولید | 1 | ۱۹ شکست ثبت شدند و فراخوانی مجموعه به سقف زمانی رسید. سناریوی بیستم با `-g "demo login"` جداگانه اجرا شد و exit 1 داشت. مثال شاهد، انتظار دکمهٔ «ورود به حساب نمایشی» و مسیرهای نمونه بدون نشست معتبر است. |

آزمون‌های آداپتر Vault، محدودیت نرخ GitHub و رد DNS خصوصی با پاسخ کنترل‌شده و در وضعیت `MOCK_ONLY` بودند. اتصال پیام‌رسان، مدل و حساب واقعی GitHub فعال نشد. Worker Lease محلی پس از انقضا بازیابی شد و تلاش قبلی اجازهٔ Commit نتیجهٔ جدید را نداشت. تحویل خارجی همچنان از الگوی حداقل یک‌بار و پذیرش ارائه‌دهنده استفاده می‌کند.

P95 گرد‌شده در Chrome و WebKit هر دو **۶۸ ms** بود. بار آزمون فقط ۵۰ درخواست خواندن Snapshot، هم‌زمانی ۵ و ۶۱ رکورد ساختگی در SQLite موقت بود. این اندازه‌گیری مبنای SLA یا ظرفیت PostgreSQL نیست. axe فقط روی صفحهٔ ورود و داشبورد اجرا شد.

### بازتولید TLS مرورگر

برای سناریوهای loopback، WebKit در HTTP ممکن است Cookie دارای پیشوند `__Host-` را نپذیرد. Fixture فعلی امکان آزمون HTTPS با گواهی موقت اختصاصی را دارد. گواهی یا کلید محیط واقعی را استفاده نکنید. کلید در ZIP سورس وجود ندارد. گزینهٔ پذیرش گواهی خودامضا محدود به Context آزمایشی HTTPS روی 127.0.0.1 است.

```shell
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=ProjectOS Loopback Test" -addext "subjectAltName=IP:127.0.0.1" -keyout loopback.key -out loopback.crt
```

مسیر مطلق دو فایل موقت را در `PROJECTOS_TEST_TLS_KEY` و `PROJECTOS_TEST_TLS_CERT` بگذارید و `npm run test:smoke -- --browser=webkit` را اجرا کنید. در این اجرا گواهی با Python Cryptography ساخته شد و همین قرارداد PEM را استفاده کرد. برای PostgreSQL، `PROJECTOS_TEST_POSTGRES_URL` به دیتابیس مدیریتی `postgres` روی loopback و یک Cluster آزمایشی اشاره می‌کند. تست تنها دیتابیس‌هایی با نام تولیدشده از Prefix آزمایشی خودش می‌سازد و جمع می‌کند.

## تحویل‌ها

- [ممیزی سورس](../audit/FINAL-SOURCE-AUDIT-FA.md) و [ماتریس پذیرش](ACCEPTANCE-MATRIX.csv)
- [ERD](../architecture/ERD.md)، [تصمیم معماری](../architecture/ADR-002-postgres-runtime.md) و [قرارداد API](../architecture/API-CONTRACT.md)
- [ماتریس مجوز](../security/AUTHZ-MATRIX.md)، [مدل تهدید](../security/THREAT-MODEL.md) و [آزمون‌های امنیتی](../security/SECURITY-TEST-RESULTS.md)
- [Migration و Rollback](../migrations/SQLITE-TO-POSTGRES-FA.md)، [استقرار](../operations/DEPLOYMENT-FA.md)، [Backup و بازیابی](../operations/BACKUP-RESTORE-FA.md) و [اتصال‌ها](../operations/INTEGRATIONS-FA.md)
- [فهرست تغییرات سورس و آزمون‌ها](evidence-2026-11-19/CHANGED-FILES.txt)

اسناد تحویل از نتایج تاریخی ZIP ورودی جدا ثبت شدند. وضعیت همهٔ Gateها در جدول بالا معتبر است و انتشار عمومی برای این تحویل در وضعیت **NO-GO** باقی می‌ماند.
