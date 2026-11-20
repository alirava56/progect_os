# انتقال SQLite به PostgreSQL

این روش برای انتقال یک کپی تأییدشده به دیتابیس خالی طراحی شده است. برای تمرین از دادهٔ ساختگی، PostgreSQL 16 یا 17 و Node.js 22.18 به بالا استفاده کنید. پس از نصب وابستگی‌ها، آدرس مقصد و گذرواژهٔ Backup را فقط در محیط سرور تنظیم کنید.

1. برنامه و Workerهای مبدأ را در بازهٔ Cutover به‌صورت هماهنگ متوقف کنید. از فایل زنده کپی معمولی نگیرید. Backup SQLite از SQLite Backup API استفاده می‌کند.
2. با `npm run security:scan-legacy` کپی را بررسی کنید. تشخیص دادهٔ مشکوک انتقال را متوقف می‌کند. رسیدگی و Rotation خارج از مسیر انتقال انجام می‌شود. کپی اولیهٔ رمزنگاری‌شده را برای بازبینی نگه دارید.
3. از SQLite تحت حفاظت Backup تهیه و صحت آن را بررسی کنید.
4. Migration اسکیمای PostgreSQL را روی مقصد خالی اعمال کنید. dry-run از مبدأ هش و تعداد ردیف‌ها را گزارش می‌دهد.
5. درخواست apply تنها وقتی پیش می‌رود که Backup با AES-GCM تأیید شود و Manifest آن با کپی SQLite برابر باشد. انتقال داخل یک تراکنش انجام می‌شود و هش، تعدادها و قیود مقصد پیش از Commit تطبیق می‌شوند.
6. پس از مهاجرت، قبل از باز کردن مسیر نوشتن به کاربران، سلامت، احراز هویت، داده‌های پروژه، History و نشانی Backup را در یک پنجرهٔ کنترل‌شده بررسی کنید.

```powershell
npm ci --include=optional
npm run backup:encrypted -- .\backups\legacy-verified.posbak
npm run verify:encrypted-backup -- .\backups\legacy-verified.posbak
npm run db:migrate
npm run db:import:sqlite -- --source .\local-data\projectos.sqlite --dry-run
npm run db:import:sqlite -- --source .\local-data\projectos.sqlite --apply --backup .\backups\legacy-verified.posbak
```

Migration از SQLite فقط می‌خواند. جدول `sqlite_imports` دوباره‌کاری را بر اساس Digest تشخیص می‌دهد. داده‌های مقصد موجود یا جدول‌های SQLite ناشناخته پیشروی را متوقف می‌کنند. تغییر Role قدیمی، تاریخچهٔ اعلان یا شناسه‌ها به‌صورت ضمنی انجام نمی‌شود. دسترسی به کلید قبلی TOTP برای احراز هویت حساب‌های منتقل‌شده لازم است.

## بازگشت

پس از توقف برنامه و Workerها، با اتصال مالک اسکیمای PostgreSQL و همان نسخهٔ تأییدشدهٔ SQLite، فرمان بررسی فقط‌خواندنی زیر را اجرا کنید. تفاوت داده، نبود سابقهٔ ورود یا جدول عمومی ناشناخته، بررسی را ناموفق می‌کند. پس از بررسی، توقف نوشتن را تا پایان تصمیم Cutover حفظ کنید.

```powershell
npm run db:import:sqlite -- --source .\local-data\projectos.sqlite --check-rollback --backup .\backups\legacy-verified.posbak
```

پیش از فعال‌کردن نوشتن کاربر، ورودی برنامه را بسته نگه دارید و کپی SQLite تأییدشده را تحت نسخهٔ قبلی فعال کنید. تست یکپارچه یک Failure پیش از Commit ایجاد می‌کند و خالی‌ماندن مقصد را می‌سنجد. پس از شروع نوشتن در PostgreSQL، بازگشت ساده به SQLite باعث ازدست‌رفتن تغییرات جدید می‌شود. بازگشت نیازمند Backup مقصد، توقف نوشتن و تطبیق تغییرات پس از Cutover با تأیید مالک است. Migration معکوس خودکار در این نسخه وجود ندارد.
