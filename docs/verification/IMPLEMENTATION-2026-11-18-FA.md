# ProjectOS — گزارش اجرای مستقیم پنج مرحله (نسخه vNext)

تاریخ: ۲۰۲۶-۱۱-۱۸ — بر مبنای سورس `ProjectOS-Private-Preview-Implementation.zip` و برنامه `ProjectOS-EXECUTION-PLAN-FA.md`.

## تصمیم انتشار
**NO-GO برای Production / اینترنت عمومی / رمزهای واقعی.** پروژه توسعه یافته، اما هیچ ادعایی مبنی بر تکمیل همهٔ فازهای طرح اولیه وجود ندارد. برخی امکانات فقط با سرویس/توکن خارجی فعال می‌شوند و هنوز end-to-end اعتبارسنجی نشده‌اند.

## اصلاحات انجام‌شده در همین نوبت (کد واقعی)

### گام ۱ — ایرادهای اثبات‌شده
- تاریخ‌ها با تقویم واقعی میلادی بررسی می‌شوند؛ 2026-02-30 رد می‌شود.
- چرخهٔ parent در Resource رد می‌شود.
- Worker موعدهای جابه‌جا، حذف‌شده و دستهٔ غیرفعال را شناسایی می‌کند و هشدار خودکار قدیمی را برمی‌دارد.
- خاموش‌کردن اعلان تمدید، یادآوری عمومی را متوقف نمی‌کند.
- وضعیت in-app از «delivered» ساختگی به «available» تغییر کرد.
- نام عامل تغییر در زمان ثبت رویداد حفظ می‌شود (migration افزودنی `actor_snapshot`).
- فیلتر تاریخ آزمایشی «آبان ۱۴۰۴» از گزارش حذف شد.
- آزمون‌های جدید در `scripts/core.test.cjs` برای Regression اضافه شدند.

### گام ۲ — هسته عملیاتی و امنیت
- ذخیرهٔ تغییرات SQL به‌صورت incremental UPSERT/DELETE انجام می‌شود؛ دیگر در هر Mutation کل `records` حذف نمی‌شود. فرانت‌اند قدیمی همچنان Snapshot ارسال می‌کند، بنابراین migration به Repository رکوردی و PostgreSQL کامل نیست.
- مسیر `/api/records/[kind]/[id]` برای GET, POST, PUT, DELETE با کنترل Owner، Origin، Revision و validation عمومی ایجاد شد.
- TOTP MFA اختیاری با AES-256-GCM encrypted seed و جلوگیری از replay اضافه شد.
- رابط فعال‌سازی TOTP در Settings و ورودی کد در Login اضافه شد.
- افزونه‌های Backup رمزنگاری‌شده و تست واقعی رمز درست/اشتباه اضافه شد.

### گام ۳ — یادآوری، اعلان و Backup
- Telegram opt-in قابل تنظیم در Environment و Worker `notifications:deliver` با صف ذخیره‌شده، Retry محدود و ارسال حداکثر یک batch؛ بدون Token هیچ ارسالی رخ نمی‌دهد.
- اسکریپت‌های Backup با `AES-256-GCM` و کلید مشتق‌شده از passphrase؛‌ تست سلامت و Restore Smoke روی کپی ایزوله.
- Worker یادآوری هنوز باید توسط Task Scheduler/systemd cron به‌طور مستقل برنامه‌ریزی شود. ارسال Telegram واقعی و تحویل به کاربر بدون Credential و آزمون بیرونی **تأیید نشده** است.
- Vault هنوز فقط ارجاع امن (Metadata) است؛ Secret Value در ProjectOS نگهداری نشود.

### گام ۴ — یکپارچه‌سازی و امکانات پیشرفته
- Worker HTTPS Monitoring اختیاری با لیست میزبان مجاز سمت سرور، DNS pinning برای IPv4 عمومی، بدون Redirect/URL دلخواه و Timeout؛ مشاهدات با Timestamp در DB ذخیره می‌شوند و API `/api/monitoring` آنها را برمی‌گرداند.
- UI Monitoring فقط مشاهدات تازه را نشان می‌دهد؛ آمار جعلی تولید نمی‌شود.
- اتصال خواندنی GitHub با Fine-grained Token و allowlist مخازن در `/api/integrations/github`؛‌ UI وضعیت دریافت را نمایش می‌دهد.
- مدل دادهٔ Charge/Contract/Revenue به سیستم و فرم‌های مالی اضافه شد. مبالغ عدد صحیح و واحد ارز مستقل‌اند؛ موتور کامل Ledger، مالیات، تطبیق و Invoice ساخته نشده.
- API بازیابی منبع `/api/assistant` و پاسخ اختیاری Responses API با سقف درخواست و رفرنس‌های معتبر؛ ارسال هر متن مستند به AI خارج از سرور **پیش‌فرض غیرفعال** است. کیفیت RAG، مقابله با Prompt Injection و Security Evaluation **تأیید نشده**.

### گام ۵ — تست و انتشار
- TypeScript و ESLint موفق هستند.
- ۱۱/۱۱ تست هسته موفق است، از جمله Regressionهای جدید برای تاریخ، چرخه، Reminder، MFA، CRUD و Backup.
- Playwright جدید `tests/functional.spec.ts` و پیکربندی ایزوله `playwright.smoke.config.ts` نوشته شده، **اجرا در این محیط ممکن نبوده است**؛ تست‌های Legacy هنوز با Demo سازگارند و نباید به‌عنوان PASS بیان شوند.
- `next build` در این محیط به‌علت نبود باینری `@next/swc-linux-x64-gnu` و قطع رجیستری npm اجرا نشد. پس Build و E2E Gate باز است.
- Load/Soak، Pen-test، WCAG 2.2 AA، اجرای واقعی Scheduler، GitHub، Telegram، AI و Remote Monitoring، بازیابی روی Staging و Rollback اجرایی نشده‌اند.

## جدول صادقانهٔ وضعیت پنج گام
| گام | وضعیت | Gate نهایی |
|---|---|---|
| ۱. رفع مشکلات | رفع باگ‌های اصلی و افزودن Regression Tests | باز: Build/E2E/QA تصویری |
| ۲. هسته و امنیت | Incremental SQLite و TOTP/رکورد API | باز: PostgreSQL، کنترل مجوز چندکاربره، Account Recovery، Rate limiting جامع |
| ۳. Vault/Reminder/Backup | Reminder/Backup قابل تست، Telegram اختیاری | باز: Vault واقعی، Durable Scheduler، Remote Backup/Restore، تحویل بیرونی واقعی |
| ۴. ویژگی‌های پیشرفته | مانیتور/گیت‌هاب/مالی و AI آزمایشی | باز: اتصال و تست واقعی، Ledger، AI Eval، Webhook Signatures |
| ۵. انتشار | Typecheck، Lint، Unit tests موفق | باز: Build/E2E/SAST/Pen-test/DR/Monitoring/Release |

## دستورهای محلی
```
npm ci
npm run typecheck
npm run lint
npm run test:core
npm run build
npm run test:smoke
```

برای تولید توکن Setup و MFA Key:
```
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

`.env.example` الگوی تنظیمات است؛ هیچ Token/Key را در پروژه یا گفتگو قرار ندهید. تا تأیید کامل Production از VPS و رمز واقعی استفاده نکنید.

### Backup رمزنگاری‌شده
```
# PROJECTOS_BACKUP_PASSPHRASE باید در محیط سرور به شکل امن تنظیم شده باشد.
npm run backup:encrypted -- ./backups/snapshot.posbak
npm run verify:encrypted-backup -- ./backups/snapshot.posbak
```

### Workerهای اختیاری
```
npm run reminders
npm run notifications:deliver
npm run monitors
```

بدون `PROJECTOS_TELEGRAM_NOTIFICATIONS=enabled`، Token و Chat ID، ارسال تلگرام غیرفعال است. بدون `PROJECTOS_MONITOR_HOSTS` پایش خاموش است. بدون `PROJECTOS_AI_ENABLED=enabled`، کلید API و Model، پردازش AI خارجی خاموش است.

## موارد ضروری پیش از تحویل Production
1. PostgreSQL + Migration + Rollback واقعی و Restore rehearsal.
2. احراز هویت چندکاربره، RBAC در تک‌تک Routeها و E2E HTTP negative tests؛ Recovery امن.
3. Secret Vault حرفه‌ای و عدم دسترسی AI به Secret، Rotation و Revocation.
4. Scheduler پایدار با Lock و Crash Recovery؛ Email/Telegram ack دقیق.
5. Integrations real-world test، webhook signing، Observability و Monitor freshness.
6. گزارش‌های مالی قابل تطبیق و تسویه، مدیریت multi-currency با نرخ تبدیل ثبت‌شده.
7. بازبینی Privacy و Prompt Injection پیش از AI بیرونی؛ تست citation correctness و عدم افشا.
8. Build و E2E روی سیستم clean، Security Scan و Load/Soak/Accessibility.
9. آزمایش Backup خارج از میزبان و Disaster Recovery و Rollback واقعی.

**نکته:** این تحویل یک نسخه توسعه‌یافته و قابل تست است، نه تکمیل ادعایی تمام پنج مرحله.
