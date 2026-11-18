# ProjectOS — ممیزی کد و Plan Mode اجرایی

**تاریخ بررسی:** ۱۸ نوامبر ۲۰۲۶  
**مبنای بررسی:** فایل آپلودشده `ProjectOS.zip`؛ ۹۸ فایل مرتبط با سورس/دارایی/مستندات (با کنار گذاشتن محتوای `.next` و `node_modules`)؛ مستندات `README.md` و `ProjectOS-QA-fa.md`، کدهای `src`، تست‌های `tests` و HTML مقایسه بصری.  
**دامنه:** ارزیابی وضعیت قابل مشاهده، تعریف محصول هدف، معماری، Backlog اجرایی، وابستگی‌ها، آزمون‌ها، Gate پذیرش و روش تحویل به Codex.

> این سند **برنامه اجرایی** است، نه گزارش پیاده‌سازی مراحل. هیچ سرویس عملیاتی یا پایگاه داده‌ای تغییر داده نشده است. مقادیر نمونه مانند IPهای رزرو‌شده در پروژه واقعی نیستند.

## A. شواهد بررسی مستقل

- فایل ZIP حدود ۲۸۲ MiB و نزدیک ۲۹٬۳۲۹ entry دارد؛ حدود ۵۰۴ MB `node_modules` و ۱۷۵ MB `.next` به صورت uncompressed در آن است. علاوه بر آن یک ZIP تودرتوی سورس دارد. این‌ها نباید وارد Repository سورس شوند.
- `src/app` شامل ۲۱ مسیر نام‌برده در `tests/routes.ts` است؛ ۳۲ PNG در `public/icons/navigation` و `public/icons/infrastructure` وجود دارد؛ ۱۴ تست گردش‌کار و ۶ تست Responsive = ۲۰ تست تعریف شده است.
- `npm run typecheck` موفق شد؛ `npm run lint` پس از ترمیم بیت اجرایی فایل‌های `node_modules/.bin` استخراج‌شده از ZIP موفق شد.
- `npm run build` در محیط ممیزی به‌علت نبود `@next/swc-linux-x64-gnu` و مسدود بودن دسترسی npm قابل تکمیل نبود؛ شکست Build در سورس **احراز نشد**. گزارش QA پروژه Build موفق در ماشین اصلی و ۲۰ تست موفق ادعا می‌کند؛ اجرای مستقل تست‌های مرورگری ممکن نشد.
- `src/lib/store.tsx`: `DemoProvider` با `useState(defaultData)`؛ تنها preferences در `localStorage` ذخیره می‌شود. عملیات CRUD پس از Refresh از بین می‌روند.
- `src/components/auth.tsx`: ورود فقط Validation نمایشی دارد و Route Protection/Session واقعی در فایل‌های دریافت‌شده نیست.
- `src/lib/fixtures.ts`: داده‌های پروژه‌ها، سرورها، کاربران، سلامت و هزینه‌ها ساختگی؛ `demoDate='2025-11-16'`، اکنون ۲۰۲۶ است.
- `src/components/forms.tsx`: آدرس Resource محدود به بازه‌های IP مستندسازی و دامنه‌های example است. این در Demo عمدی و خوب است؛ در محصول واقعی باید Validation مستحکم با مدل ریسک جدا طراحی شود.
- `src/components/infrastructure.tsx`: Vault صرفاً Reference و Provider نمایشی است؛ هیچ Secret Value واقعی نگهداری نمی‌کند.
- `src/components/operations.tsx`: Monitoring از fixture و Alert فقط state نمایشی استفاده می‌کند؛ Scheduler، Probe و تحویل اعلان وجود ندارد.
- `src/components/knowledge.tsx`: Assistant بر اساس پرسش‌های ثابت و پاسخ‌های از پیش ثبت‌شده است؛ RAG و LLM ندارد.
- `src/lib/types.ts`: مدل‌های ساده با `projectId` و `parentId`، فاقد Workspace isolation، چندبه‌چند Resource↔Project، audit پایدار، Source Verification، Invoice، recurrence و خیلی از سازوکارهای Domain.
- `next.config.ts` فقط تصاویر unoptimized و حذف devIndicators را تعیین می‌کند؛ سیاست‌های Production security/headers در سورس دیده نشد. `src/app` API واقعی و کد database ندارد.
- HTML visual-review شامل ۲۶ جفت تصویر پیاده‌سازی/مرجع است؛ نمونه‌های Dashboard دسکتاپ و موبایل مشاهده شدند. ظاهر هماهنگ است ولی بسیاری از متن‌های CSS کوچک‌تر از ۱۲px هستند؛ دسترسی‌پذیری و خوانایی در دستگاه واقعی نیازمند بازبینی است.

## B. تعریف دقیق محصول نهایی

ProjectOS باید **محیط امن، پایدار، قابل جست‌وجو و قابل پیگیری مدیریت پروژه‌های نرم‌افزاری و زیرساخت** باشد. تمام نمایش‌های وضعیت باید منشأ، زمان آخرین بررسی و تمایز «ثبت دستی/تأیید واقعی/نامشخص/قدیمی» داشته باشند.

**اصول تغییرناپذیر:**
1. هیچ داده عملیاتی پس از Refresh، Restart یا قطع Worker گم نشود.
2. هیچ داده بین Workspaceها یا اعضای فاقد مجوز نشت نکند؛ مجوز **در سرور برای هر رکورد و هر عملیات** کنترل شود.
3. رمز، کلید خصوصی و Token هرگز به React State عمومی، LocalStorage، Log، گزارش، جست‌وجو، تحلیل AI یا فایل Export منتقل نشوند؛ ارجاع به Vault ذخیره شود.
4. UI هرگز Monitoring مصنوعی را به عنوان سلامت واقعی معرفی نکند.
5. هر اقدام مخرب یا حساس (ویرایش دسترسی، حذف، اجرای عملیات روی سرور) به کنترل مجوز و تأیید صریح نیاز دارد.
6. محصولات و منابع مشترک بین چند پروژه قابل مدل‌سازی باشند.
7. Migration، Backup، Restore و Rollback برای هر انتشار قابل اثبات باشند.
8. تمام ورودی‌های منبع خارجی مثل GitHub Webhook و URL Monitor غیرقابل‌اعتماد تلقی شوند.

## C. نقشه صفحات — ۲۱ مسیر فعلی و الزام نهایی

| صفحه / مسیر | موجودی فعلی | الزام عملیاتی / خروجی |
|---|---|---|
| `/login` | فرم نمایشی | Session امن، MFA/Passkey، Recovery، rate limit، مدیریت نشست |
| `/onboarding` | ویزارد ساخت پروژه دمو | ساخت Workspace واقعی، مالکیت، اولین پروژه، راهنمای Vault، بدون Credential خام |
| `/dashboard` | اعداد و نمودار fixture | Aggregate از DB، اقدامات ضروری، آخرین تأیید، هشدارها، بارگذاری/خطا |
| `/projects` | CRUD موقت | CRUD پایدار، بایگانی/بازیابی، برچسب، الگو، مالک/مشتری |
| `/projects/[id]` | تب‌های نمایشی | Summary و روابط زنده Tasks/Resources/Docs/Expenses/Events |
| `/infrastructure` | CRUD metadata نمایشی | Inventory واقعی با Provider, Env, lifecycle, relation, validation |
| `/infrastructure/servers/[id]` | CPU/RAM نمونه | مشخصات سرور، سرویس‌های وابسته، expiry، backup، status provenance |
| `/vault` | Secret Reference نمایشی | Provider ID، ارجاع امن، ACL، metadata دسترسی و زمان آخرین بررسی؛ بدون value در DB |
| `/tasks` | کانبان، فهرست | CRUD، وضعیت blocked/awaiting approval، dependencies، assignee، due |
| `/tasks/[id]` | checklist، comment | تاریخچه پایدار، validation چرخه وابستگی، review و acceptance |
| `/calendar` | تقویم نمونه | رویداد واقعی، recurrence، timezone، reminders و پیوند با منابع |
| `/monitoring` | نمودار مصنوعی | Probeهای واقعی خارجی/ارائه‌دهنده، health state، incidents، uptime محاسبه‌شده |
| `/alerts` | ack/snooze موقت | Rule engine، dedupe، retry، notify delivery، snooze/un-snooze و escalation |
| `/finance` | expense پایه | هزینه/تمدید دوره‌ای، تومان/ریال شفاف، provider، invoice، revenue, allocation |
| `/docs` | Plain text + revision شمارنده | نسخه‌های واقعی، رفرنس، metadata، attachment امن، Runbook و Decision |
| `/assistant` | پاسخ ثابت | Structured retrieval و RAG با citation و strict authorization؛ عدم دسترسی به Secret |
| `/reports` | CSV/چارت نمونه | aggregations واقعی، scope، source freshness، خروجی فیلترشده امن |
| `/activity` | event در Client State | append-only audit، actor معتبر، source و correlationId، pagination |
| `/integrations` | connected=false | اتصال‌های read-only کم‌اختیار، webhook امضاشده، sync status، disconnect |
| `/team` | دعوت نمایشی | دعوت واقعی، membership، نقش‌ها، project permissions، revoke |
| `/settings` | preferences localStorage | Workspace settings واقعی، security sessions، notification channels، export امن |

### ویژگی‌هایی که صفحه جدید می‌خواهند (در صورت نیاز پس از MVP)
- `/resources/[id]/dependencies` یا یک Graph View برای Impact Analysis؛ منابع مشترک و وابستگی‌های چندجهته.
- `/security/audit` برای لاگ امنیتی (فقط مدیر) و رویدادهای دسترسی به Secret Reference.
- `/backups` برای وضعیت Jobها و **Restore Test** نه صرفاً آخرین فایل Backup.
- `/billing/contracts` و جزئیات قرارداد/تمدید؛ اگر صفحه Finance فعلی بیش‌ازحد شلوغ شود.
- `/project-templates` برای قالب وب‌سایت، VPN، AI Service، فروشگاه و پروژه مشتری.
- `/notifications/preferences` در صورت زیادشدن قوانین و کانال‌ها؛ در MVP Settings کافی است.

## D. معماری مقصد (تصمیم پیشنهادی)

**Modular Monolith**، نه Microservice:
- UI: Next.js App Router + React + TypeScript + Tailwind فعلی؛ CSS و دارایی‌ها حفظ شوند.
- Server: لایه server-only / domain services / data access؛ API/Server Actions صرفاً با Auth+Validation+Authorization.
- DB: PostgreSQL + Prisma migrations، ترجیحاً DB اختصاصی؛ constraint و index در SQL.
- Auth: Provider معتبر سازگار با نسخه پروژه؛ verified identity، server session، MFA/Passkeys با برنامه rollout.
- Worker: صف پایدار برای Reminder, Sync, Webhook, Reconciliation؛ Postgres-backed queue برای MVP، قابلیت انتقال به Redis در صورت نیاز.
- Secret: Vault تخصصی (مثلاً Infisical یا Bitwarden Secrets Manager پس از تصمیم فنی)؛ در ProjectOS فقط `provider`, `externalRef`, `scope`, `createdBy`, `verifiedAt` نگه داشته شود.
- Monitoring: ابزار مستقلی مثل Uptime Kuma/Better Stack در محیط متفاوت از سرویس تحت پایش؛ read-only sync به ProjectOS.
- Search: ابتدا PostgreSQL full-text/structured؛ بعداً semantic index با دسترسی کنترل‌شده.
- Object storage: اسناد و پیوست‌ها با ACL، محدودیت نوع/حجم و اسکن فایل در صورت نیاز.
- Observability: structured logs با redaction، traces/metrics، error tracking، health check، آلارم خارجی.
- Deployment: Dev/Staging/Production مجزا؛ CI، migrations تست‌شده، secret injection، Backup و Rollback.

**جداسازی لایه‌ها:** `UI -> authenticated application service -> policy/authorization -> domain rules -> repository -> DB`. APIهای بیرونی فقط از Adapterهای محدود به سرویس‌های مجاز عبور کنند.

**امنیت ترافیک ورودی:** Webhook signature validation، expiry/replay protection، idempotency keys، rate limiting، input validation و محافظت در برابر SSRF برای URLهای Monitor/Importer. درخواست مستقیم از URL تعریف‌شده توسط کاربر نباید از شبکه privileged Backend انجام شود.

## E. مدل داده پیشنهادی برای PostgreSQL

### هسته هویت و پروژه
- `users`, `accounts`, `sessions`, `workspaces`, `memberships`, `invitations`, `project_members`.
- `clients`, `projects`, `project_status_history`, `project_templates`, `project_checklist_items`.
- `tasks`, `task_checklist_items`, `task_comments`, `task_dependencies`, `task_labels`, `task_events`, `approvals`.

### دارایی‌ها
- `resources` با type متنوع (server/domain/database/service/repository/storage/monitor/backup/dns/ssl).
- `project_resources` (many-to-many)، `resource_relations` (depends_on/hosted_on/backed_up_by/managed_by/exposes/points_to).
- `environments`, `providers`, `renewals`, `resource_evidence`, `resource_checks`, `resource_ownership`.
- `secret_references` فقط provider + external ID و metadata مجاز (بدون plaintext)، `secret_access_events` فقط event metadata.

### عملیات و داده
- `documents`, `document_versions`, `attachments`, `decision_records`, `runbooks`.
- `monitor_targets`, `monitor_observations`, `incidents`, `incident_events`, `backup_runs`, `restore_tests`.
- `reminders`, `notification_rules`, `notification_events`, `notification_deliveries`, `notification_preferences`.
- `expenses`, `recurring_charges`, `invoices`, `contracts`, `payments`, `revenue_entries`, `cost_allocations`.
- `integrations`, `integration_credentials_refs`, `sync_runs`, `webhook_events`.
- `audit_events` (append-only), `change_events` (provenance)، `outbox_events`, `ai_queries` (بدون secrets)، `ai_citations`.

**قیدهای ضروری:** workspaceId و Permission Scope در رکوردها، FK، soft delete جایی که لازم است، یکسان‌سازی زمان به UTC در DB و نمایش تقویم شمسی در UI، `createdAt/updatedAt/deletedAt`، uniqueهای مناسب، `version` برای optimistic concurrency، معاملات Atomic، عدم حذف Cascade کورکورانه برای داده حساس و audit. برای مبلغ مالی واحد (ریال/تومان) و ارز جداگانه مدل شود، بدون float برای پول.

## F. برنامه اجرای مرحله‌ای و Gate خروج

### PHASE 00 — Freeze / Baseline / Hygiene [بسیار فوری]
**کارها:** ساخت Repository تمیز، حذف `node_modules/.next/ProjectOS-source.zip` از کد قابل نسخه‌بندی، تکمیل `.gitignore` برای `.env*` همراه مجوز `.env.example`، تعریف README/Architecture/ADR، lockfile، CI، تست تصویری baseline، مسیرهای اصلی. بررسی hardcoded fixture/credential. تست قابل تکرار Linux؛ اصلاح صرفاً محیطی در صورت نیاز بدون حذف وابستگی‌ها یا کاهش استانداردها.

**Gate:** clone جدید + `npm ci`, `typecheck`, `lint`, `build`, `test` روی محیط کنترل‌شده؛ Screenshot baseline ثبت؛ Repository بدون Secret یا Artifact حجیم. اگر Build به خاطر محیط ممکن نیست، blocker ثبت و Gate مردود/نامشخص باقی بماند، نه سبز جعلی.

### PHASE 01 — Domain Modeling & UI Preservation [P0]
**کارها:** ADR معماری، ERD، API contract، نقشه Workspace/Project/Resource/Secret/Task؛ تبدیل fixtures به Demo Adapter و ساخت Server Repository interface؛ برنامه Migrating صفحه به صفحه؛ Storybook یا Component showcase برای Design System (اختیاری)، بهبود خوانایی متون کوچک و Contrast، حذف ابهام Demo vs Real در حالت Production.

**Gate:** ERD + API Schema تأییدشده، Fixture Mode پشت flag جدا و غیرقابل فعال‌سازی در Production، Visual Regression بدون شکست ناخواسته، UX برای loading/empty/error/permission-denied.

### PHASE 02 — Persistent Core + Authentication [P0 / شرط شروع ثبت داده واقعی]
**کارها:** PostgreSQL + migrations + seed جعلی غیرحساس، Server DAL، session واقعی، login/logout، account recovery، MFA rollout، Workspace/Member/Invite، role/scoped authorization، rate limit، CSRF defenses، Error policy، audit event. همه routeها در Server محافظت شوند؛ query و mutation هم مجوز مستقل داشته باشند.

**Gate:** CRUD و Login پس از Refresh/Restart باقی می‌مانند؛ درخواست Guest/Viewer/Other Workspace به صورت مستقیم از URL/Server Action/API fail closed است؛ دیتابیس/Session backup قابل آزمایش؛ no sensitive output.

### PHASE 03 — Project/Task/Resource/Docs واقعی [P0]
**کارها:** Project CRUD، Task CRUD، state machine و dependency cycle check، checklist/notes، Resource Inventory با Provider/Environment و relation چندبه‌چند، Domain/IP validation، document versions، decision records، full-text search، Event trail با actor واقعی، optimistic concurrency.

**Gate:** پروژه، VPS، دامنه، Repository، DB، Credential Reference و Task همگی به هم مرتبط‌اند؛ هیچ داده پس از Refresh گم نمی‌شود؛ سناریوی resource مشترک، project archive، concurrent edits و invalid dependency پاس می‌شود؛ ردیابی منبع هر تغییر وجود دارد.

### PHASE 04 — Vault References & Security Controls [P0]
**کارها:** انتخاب Vault پس از بررسی هزینه/API/مجوز، Server-to-Server credentials تنها در secret storage محیط اجرا، provider reference، mapped ACL، reauth برای درخواست‌های حساس، security logging با redaction، interface `open in vault` و آخرین verified date، rotation reminder؛ اگر Provider مجاز به return کردن Secret نباشد مقدار به اپ منتقل نشود.

**Gate:** هیچ Secret Value در DB، React، HTML، Log، telemetry، AI، Export یا Network response عمومی نیست؛ Viewer حق باز کردن ندارد؛ token leak/IDOR negative tests؛ revoke و rotation تست شوند.

### PHASE 05 — Reminders / Completeness / Backups [P0 / MVP candidate]
**کارها:** Durable scheduler، recurrence، renewals، source-linked reminders، email/Telegram notification opt-in، retry/backoff/dedupe، snooze expiration، digest، project-type checklist و provenance. Backup DB و فایل‌ها، Restore test ثبت‌شده، recovery Runbook، monitoring خود سامانه.

**Gate:** Deadline با timezone درست، حتی پس از Restart به صورت idempotent اجرا می‌شود؛ پیام duplicate ارسال نمی‌شود؛ Snooze بازفعال می‌شود؛ مورد `unknown` جعلاً green نمی‌شود؛ بازیابی از Backup در Staging انجام و نتیجه ثبت شده است.

> **اولین انتشار خصوصی قابل اتکا پس از PHASE 05**؛ و فقط اگر تمام Gateهای P0 سبز باشند. این نسخه می‌تواند بدون AI و Monitoring پیشرفته مشکل اصلی فراموشی اطلاعات/موعدها را حل کند.

### PHASE 06 — Monitoring + Integrations [P1]
**کارها:** Read-only adapter اول GitHub و Monitor provider؛ sync اولیه/backfill، webhook signature، status TTL، observation vs incident، SLA/SLO و freshness؛ external monitoring مجزا، dashboard health، fault handling. Coolify فقط پس از نیاز و با least privilege. Connectorهای دیگر در backlog.

**Gate:** قطعی واقعی در محیط آزمایش قابل مشاهده است؛ health نمایش داده شده از Probe معتبر و timestampدار است؛ webhook دوباره/نامرتب رویداد تکراری نمی‌سازد؛ SSRF و abuse مقاوم؛ عدم دسترسی provider به UI client.

### PHASE 07 — Finance/Contracts/Costs [P1]
**کارها:** هزینه‌های تکرارشونده و one-off، Invoice و Contract، نگاشت provider به resource، currency/unit، cost allocation بین پروژه‌ها، revenue و سود، فیلترهای زمانی، دریافت CSV امن با حذف فرمول مخرب، reconciliation manual.

**Gate:** گزارش عددی با ردیف‌های ledger قابل بازتولید؛ مبالغ با دقت صحیح و بدون double-counting؛ موعد تمدید Billing به Reminder مرتبط است.

### PHASE 08 — AI Copilot & Verified Memory [P2]
**کارها:** ingestion مجاز Docs/Decisions/Tasks/Events، indexing scoped، retrieval با citation، freshness، uncertainty، permission-aware RAG و ارزیابی accuracy، prompt injection دفاعی، redaction secrets، action proposals (بدون اجرای خودکار حساس)، token cost limits.

**Gate:** هر پاسخ factual به منبع مجاز و زمان آخرین مشاهده لینک دارد؛ Unknown را صریح می‌گوید؛ IDOR prompt، malicious docs و secret exfiltration tests رد می‌شوند؛ هیچ Action حساس بدون تأیید انسانی اجرا نمی‌شود.

### PHASE 09 — Hardening / Release & Operations [P0 before public access]
**کارها:** threat model، SAST/Dependency scan، browser E2E Chromium+Firefox+WebKit، Accessibility WCAG 2.2 AA audit، RTL/LTR، Mobile واقعی، Load/Soak/Backup test، observability، env isolation، release CI/CD، rollback/migration, incident/runbook, data export/deletion.

**Gate:** تست‌ها مستقل و Repeatable، Authorization negative tests، vulnerability critical/high unresolved = 0 طبق risk policy، Backups restore tested، rollback tested، deployment monitored، disclosure/operating documentation.

## G. اولویت Backlog اجرایی (شناسه‌های پیشنهادی)

| ID | کار | اولویت | وابسته به |
|---|---|---|---|
| SEC-001 | حفاظت تمام Routeها و عملیات سرور با AuthN/AuthZ | P0 | ARCH-001 |
| DATA-001 | PostgreSQL schema + migration + data adapter | P0 | ARCH-001 |
| DATA-002 | ذخیره پایدار و concurrency-safe CRUD | P0 | DATA-001 |
| ARCH-001 | مدل Workspace، ERD، ADR و قرارداد API | P0 | PHASE-00 |
| REPO-001 | Source hygiene، Git، CI و تست reproducible | P0 | — |
| INV-001 | مدل رابطه‌ای Resource/Environment/Provider | P0 | DATA-001 |
| VAULT-001 | Secret references، RBAC و Vault integration | P0 | SEC-001, INV-001 |
| TASK-001 | Task lifecycle، dependency constraints و audit | P0 | DATA-002 |
| DOC-001 | Versioned docs، decision records و search | P0 | DATA-002 |
| REM-001 | Durable scheduler و renewals | P0 | DATA-001, INV-001 |
| BACKUP-001 | Backup و restore verification | P0 | DATA-001 |
| QA-001 | Security regression و authZ cross-workspace tests | P0 | SEC-001 |
| UX-001 | Responsive, readability, error/empty/loading, contrast | P1 | PHASE-00 |
| MON-001 | Read-only external monitoring adapter و provenance | P1 | INV-001, SEC-001 |
| GH-001 | GitHub connector و webhook sync | P1 | SEC-001, INV-001 |
| FIN-001 | Charges, contracts, allocation, reports | P1 | DATA-001, REM-001 |
| AI-001 | Source-grounded RAG و ACL-aware search | P2 | DOC-001, SEC-001, GH-001 |
| TEAM-001 | دعوت و عضویت چندکاربره کامل | P1 | SEC-001 |

## H. سناریوهای پذیرش End-to-End (لازم)

1. پروژه جدید بساز، صفحه را Refresh کن، مرورگر دیگری با همان حساب باز کن: داده پابرجا و همسان است.
2. عضو Viewer روی پروژه مجاز فقط خواندنی دارد؛ `POST` و مسیر مستقیم پروژه دیگر `403/404` مناسب می‌گیرند.
3. سرور را به دو پروژه متصل کن؛ تغییر Hostname/Provider/Expiry در هر دو یکسان است؛ افشای Secret مستقل ممنوع است.
4. تاریخ VPS تمدید می‌شود؛ reminder قبلی reschedule و تاریخچه تغییر append می‌شود؛ هیچ دو اعلان همسان تحویل نشود.
5. DB قطع شود؛ هیچ success جعلی نمایش داده نشود؛ خطای کنترل‌شده و retry قابل بازیابی باشد.
6. Worker پیش از موعد خاموش/روشن شود؛ Job از دست نرود یا دوبار اعمال نشود.
7. Vault Token revoked شود؛ app به fail closed برود و Secret یا session غیرمجاز افشا نشود.
8. URL Monitor به loopback/private IP/metadata address یا DNS rebinding هدف‌گیری شود؛ طبق سیاست block یا sandbox مجزا اجرا شود.
9. فایل راهنمای پروژه حاوی دستور تزریقی برای افشای Secrets باشد؛ AI آن را دستور سیستم تلقی نکند و هیچ داده غیرمجاز برنگرداند.
10. Backup کامل روی محیط staging بازیابی شود و داده‌های workspace/project/task/attachment و permissions تطبیق داده شوند.
11. تاریخ سررسید نزدیک تغییر DST/Timezone و تاریخ شمسی تست شود؛ DB در UTC ثابت بماند.
12. CI شامل typecheck, lint, build, unit, DB integration, E2E, security negative, visual و accessibility باشد.

## I. تصمیم‌های طراحی و امنیت که نباید به Codex واگذار شوند

- مدیریت secret با Vault موجود؛ هیچ crypto implementation اختصاصی برای ذخیره رمز ننویسد.
- Production هرگز از fixture و fake health به عنوان داده زنده استفاده نکند.
- حذف اولیه هیچ صفحه مهم برای ساده شدن معماری مجاز نیست؛ گسترش مرحله‌ای لازم است.
- ساخت Microservices، Kubernetes، سرویس billing واقعی، اجرای SSH از UI و AI agent خودمختار در MVP ممنوع مگر با ADR و دلیل قابل اندازه‌گیری.
- سطح دسترسی در React یا فیلتر Client امنیت محسوب نمی‌شود.
- هر fetch از URL تحت کنترل کاربر باید SSRF threat model و sandbox داشته باشد.
- No raw credentials in chat, Codex prompts, screenshots, fixture, HTML review, logs or sample exports.
- خطاهای `npm run build` و `npm test` باید روی محیط Linux تمیز ثبت و مستقل رفع شوند؛ هیچ «سبز کردن تست» با skip کردن یا کم کردن Assertions پذیرفته نیست.

## J. Deliverable هر فاز

هر PHASE باید فایل‌های زیر را داخل مخزن تولید/به‌روزرسانی کند:
- `docs/architecture/ADR-*.md` — تصمیم‌های مهم و Tradeoff
- `docs/plan/PHASE-XX.md` — scope, tasks, acceptance, rollback
- `docs/api/` — API/Schema با Version
- `docs/verification/PHASE-XX-REPORT.md` — دستورات اجراشده، pass/fail، evidence، blocker
- Migration، تست و README متناسب با تغییر؛ هیچ Phase بدون سند و تست ادغام نشود.

## K. دستور شروع برای Codex Plan Mode (بدون اجرای تغییر)

```text
You are the lead software architect, senior full-stack engineer, security reviewer, QA lead and product engineer for ProjectOS.

INPUT: The existing ProjectOS repository and ProjectOS-EXECUTION-PLAN-FA.md.
PRODUCT: A secure, persistent, Persian RTL Developer Command Center for projects, infrastructure, credential references, tasks, docs, renewals, monitoring, costs and source-grounded AI.

MODE: PLAN ONLY. Do not edit files, install packages, run migrations, deploy, access servers or use actual credentials in this planning pass.

1. Independently inspect the entire tracked source; compare reality to the attached audit. Reject unsupported assumptions.
2. Build inventory of routes, components, models, fake behaviors, dependencies, tests and missing runtime services.
3. Write implementation-ready ADRs, ERD, module boundaries and API/Data Access policy.
4. Define executable PHASE 00..09 tasks in dependency order, with specific paths, DB migrations, API contracts, unit/integration/e2e/security tests, rollback plan and acceptance gates.
5. Treat authorization, multi-tenancy, durable storage, secrets isolation, read-only integrations, provenance and backup verification as blockers.
6. Preserve existing visual system; recommend measured improvements to mobile/readability/accessibility; do not rebuild UI from scratch.
7. Identify contradictory requirements and propose justified defaults. Include risk register with severity, likelihood, mitigation and owner.
8. Provide precise first-sprint plan: PHASE 00 plus PHASE 01, with changed files listed and acceptance criteria. Do NOT begin implementation until explicit approval.

Output in Persian, technical terms in English. Separate VERIFIED / INFERRED / UNVERIFIED. Do not claim a test passed unless you actually executed it. Do not fake integrations or production health.
```

## L. اولین دستور اجرای تأییدشده پس از Plan Mode

```text
Implement ONLY approved PHASE 00 of ProjectOS. Use a branch. Do not touch production, databases or real secrets. Clean repository and Git ignore patterns, write docs/architecture baseline, make CI reproducible and run typecheck/lint/build/e2e in a supported environment. Preserve UI and screenshots. Report exact commands/results, unresolved blockers and changed files. Stop at Gate 00 for approval; do not automatically continue to PHASE 01.
```

## M. حد نهایی دامنه / Release Checklist

### Private MVP = Must have
- [ ] Real auth and scoped authorization
- [ ] Durable PostgreSQL project/task/resource/docs data
- [ ] Project↔Resource relationship and server details
- [ ] Secure Vault references only, with access policy
- [ ] Real renewals/reminders and notification delivery
- [ ] Backup + restore proof
- [ ] Timezone correctness, search and audit trail
- [ ] Clean build/CI and negative security tests
- [ ] Clear demo/real state and documented limitations

### Post-MVP = Should have
- [ ] GitHub integration
- [ ] External monitoring with provenance and outage alert
- [ ] Recurring expenses, billing/contract reminders
- [ ] Project-type completeness checklists
- [ ] Mobile accessibility hardening

### Advanced = Could have
- [ ] Citation-grounded AI Copilot
- [ ] Impact/dependency graphs
- [ ] Client portal/multi-team billing
- [ ] Automated read-only discovery under explicit user consent

**نتیجه:** ابتدا Repository و Gate 00؛ سپس Data/Auth و هسته پایدار؛ سپس Vault+Reminder؛ بعد از آن Monitoring/Finance و در نهایت AI. هیچ اطلاعی درباره Production واقعی در فایل وجود ندارد؛ برای آن باید فقط پس از آماده شدن امنیت از داده‌های خود کاربر، با رضایت و مسیرهای امن استفاده شود.
