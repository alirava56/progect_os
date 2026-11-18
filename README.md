# ProjectOS — Hardened Private Preview

**وضعیت: NO-GO برای انتشار عمومی و نگهداری رمز واقعی.** آخرین به‌روزرسانی: ۱۸ نوامبر ۲۰۲۶. این نسخه ادامه مستقیم ProjectOS vNext است و ظاهر فارسی/RTL و دارایی‌های رابط کاربری را حفظ می‌کند. امکانات امنیتی جدید **الزاماً به معنای Production-ready بودن نیست**.

## از کجا شروع کنم؟

- راهنمای نصب و عملیات: [`docs/operations/RUNBOOK-FA.md`](docs/operations/RUNBOOK-FA.md)
- جدول معیارهای انتشار: [`docs/verification/RELEASE-GATES-FA.md`](docs/verification/RELEASE-GATES-FA.md)
- تهدیدها و محدودیت‌های امنیتی: [`docs/security/THREAT-MODEL.md`](docs/security/THREAT-MODEL.md)
- سیاست مجوزها: [`docs/architecture/PERMISSIONS.md`](docs/architecture/PERMISSIONS.md)
- برنامه اجرایی اولیه: [`docs_execution_plan_fa.md`](docs_execution_plan_fa.md)
- وضعیت آزمون‌های این تحویل: [`docs/verification/STATUS.md`](docs/verification/STATUS.md)

## راه‌اندازی توسعه، فقط روی localhost

پیش‌نیاز: Node.js 22، اینترنت و دسترسی به npm و محیط توسعه محلی. این بسته `node_modules` و `.env.local` ندارد.

```powershell
npm ci --include=optional
Copy-Item .env.example .env.local
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

خروجی تصادفی دستور آخر را در `.env.local` برای `PROJECTOS_SETUP_TOKEN=` بگذار. اگر TOTP می‌خواهی، با دستور تصادفی جداگانه یک کلید ۳۲ بایتی برای `PROJECTOS_MFA_ENCRYPTION_KEY` تولید کن (۶۴ رقم هگز). کلیدها را در Git، پیام یا مستندات نفرست. سپس:

```powershell
npm run typecheck
npm run lint
npm run test:core
npm run build
npm run dev -- --hostname 127.0.0.1
```

به `http://127.0.0.1:3000/setup` برو و حساب مالک ایجاد کن. پس از ثبت، `PROJECTOS_SETUP_TOKEN` را از فایل محیطی حذف و برنامه را دوباره راه‌اندازی کن. داده‌ها در `local-data/projectos.sqlite` نگهداری می‌شوند؛ این پوشه را در مسیر عمومی یا همگام‌سازی بدون رمزنگاری قرار نده.

**توجه:** Build و تست مرورگر در محیط تولید این ZIP به‌علت فقدان بسته بومی Linux برای Next.js و عدم دسترسی به npm اجرا نشدند. در سیستم خودت بدون Build و `npm run test:smoke` موفق، برنامه را قابل انتشار ندان.

## قابلیت‌های پیاده‌سازی‌شده در حد Private Preview

- ورود Owner با هش scrypt، Session Cookie از نوع HttpOnly، TOTP اختیاری، کدهای بازیابی یک‌بارمصرف و ابطال نشست‌ها.
- دعوت‌نامه یک‌بارمصرف برای Owner/Editor/Viewer با سیاست نقش محدود و لغو عضویت. **ACL مستقل برای هر پروژه، چند Workspace کامل و حسابرسی امنیتی نهایی وجود ندارند.**
- ذخیره‌سازی و عملیات رکوردی با SQLite، اعتبارسنجی دامنه، Audit پایه، تاریخچه اسناد، تسک‌ها، منابع و پروژه‌ها.
- رد و Redact کردن **برخی الگوهای رایج** رمز و Token در داده متنی. این فیلتر تشخیص قطعی همه اسرار نیست؛ هرگز Secret واقعی در پروژه وارد نکن.
- ارجاع به آیتم Vault خارجی با URLهای محدود به دامنه‌های مشخص؛ **نه** اتصال API Vault یا نگهداری رمز.
- Backup رمزنگاری‌شده AES-GCM، وارسی فایل Backup و تست Restore ایزوله. انتقال Offsite و بازیابی کامل در Staging آزمایش نشده‌اند. Backup بدون رمز به‌صورت پیش‌فرض مسدود است.
- Worker اختیاری موعدها، صف اعلان تلگرام و پایش محدود HTTPS و اتصال GitHub خواندنی، **بدون تضمین تحویل واقعی یا راه‌اندازی سرور**.
- مدل مالی اولیه برای هزینه، قرارداد، اشتراک و درآمد، بدون تسویه حسابداری/تطبیق پرداخت جامع.
- جست‌وجوی مستند و AI اختیاری با Opt-in جداگانه؛ بدون ممیزی RAG، کنترل جامع Prompt Injection یا تضمین حفظ حریم خصوصی تولیدی.

## آزمون‌ها

```powershell
npm run typecheck
npm run lint
npm run test:core
npm run build
npx playwright install chromium
npm run test:smoke
npm audit --audit-level=high
```

نتایج آزمون باید بر روی همان نسخه و محیطی که استفاده می‌کنی ثبت شوند. **موفقیت تست‌های Core جایگزین E2E، امنیت HTTP، مرورگر، Performance، Accessibility یا تست بازیابی کامل نیست.**

## مسیرهای عملیاتی

- بررسی نسخه‌های قدیمی حاوی احتمالی Secret: `npm run security:scan-legacy`؛ پاک‌سازی `--apply` فقط روی کپی کنترل‌شده، پس از ساخت و تأیید Backup رمزنگاری‌شده.
- Backup امن: `npm run backup:encrypted` و سپس `npm run verify:encrypted-backup -- <backup.posbak>`؛ نیازمند `PROJECTOS_BACKUP_PASSPHRASE` قوی.
- اجرای یک نوبت Reminder: `npm run reminders`. زمان‌بندی اختیاری و پایش تحت `deployment/systemd/` است؛ این فایل‌ها به‌طور خودکار روی سرورت نصب نمی‌شوند.
- برای ارسال تلگرام، پایش HTTPS و AI باید تنظیمات اختیاری و آزمون روی سرویس‌های خودت انجام شود. پیش‌فرض همگی غیرفعال است.
- در Production (در صورت تکمیل Gateها)، `PROJECTOS_PUBLIC_ORIGIN` باید آدرس واقعی HTTPS باشد؛ در غیر این‌صورت درخواست‌های نوشتنی رد می‌شوند.

## مهم‌ترین کارهای باز

PostgreSQL و Migration امن، Vault API واقعی، آزمون کامل Session/RBAC/MFA روی HTTP، بازیابی حساب ممیزی‌شده، Scheduler و اعلان آزموده‌شده در سرور واقعی، Offsite Backup و Full Restore، پایش VPS/VPN واقعی، همگام‌سازی رویدادی GitHub، گزارش مالی دقیق، AI RAG امنیت‌سنجی‌شده، تست سرتاسری مرورگر و موبایل، SCA/Pentest/Performance و تایید عملی Rollback.

**جمع‌بندی:** ۰ مورد از ۵ Gate انتشار کاملاً بسته شده‌اند. پیش از نگهداری هر رمز یا عرضه عمومی، همه معیارهای `docs/verification/RELEASE-GATES-FA.md` باید با شاهد قابل بازتولید پاس شوند.

> گزارش‌های قدیمی‌تر در `docs/verification/` و فایل‌هایی مانند `DELIVERY_REPORT_FA.md` و `ProjectOS-QA-fa.md` صرفاً سوابق نسخه‌های پیشین‌اند و مرجع وضعیت فعلی نیستند.

## پیوست امنیتی — بازبینی ۱۸ نوامبر ۲۰۲۶

**این نسخه هنوز Private Preview است و برای انتشار عمومی یا ذخیره رمز واقعی تأیید نشده است.**

- برای بررسی اصلاحات و ۳۱ تست هسته‌ای، `docs/verification/SECURITY-REVIEW-2026-11-18-FA.md` را مطالعه کن.
- نشست‌ها علاوه بر سقف هفت روز، پس از **۲۴ ساعت بی‌فعالیتی** در سرور نامعتبر می‌شوند؛ نشست‌های قدیمی هنگام Migration ممکن است نیاز به ورود دوباره داشته باشند.
- دعوت مجدد کاربر دارای MFA مستلزم TOTP یا Recovery Code همان کاربر است. ثبت دستی Activity، payloadهای بزرگ JSON، هشدارهای خودکار و مسیر DB حفاظت بیشتری دارند.
- Reminder Worker حالا سررسید ISO، برخورد شناسه میان انواع منابع و تغییر وضعیت کانال تلگرام را پشتیبانی می‌کند؛ زمان‌بند باید بیرون از برنامه واقعاً اجرا و پایش شود.
- `npm run backup:encrypted` و `npm run verify:encrypted-backup -- <file.posbak>` از **رمزنگاری/بازیابی جریانی** استفاده می‌کنند. همچنان Backup خارج از سرور و بازیابی از صفر باید عملی تست شود.
- HTTPS و `PROJECTOS_PUBLIC_ORIGIN` درست برای Production الزامی‌اند؛ HSTS فقط برای Origin با پروتکل HTTPS اضافه می‌شود.
- قبل از هر انتشار: `npm ci --include=optional`, `npm run typecheck`, `npm run lint`, `npm run test:core`, `npm run build`, `npm run test:smoke`, `npm audit --audit-level=high` باید در محیط قابل تکرار موفق شوند.
