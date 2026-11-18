# راهنمای اجرای ProjectOS در محیط خصوصی

## آماده‌سازی

- Node.js 22.18 به بالا، نصب تمیز وابستگی‌ها و اجرای همهٔ تست‌های نسخه را انجام دهید.
- برای تست بین‌سرویسی از PostgreSQL جداگانه و دادهٔ ساختگی استفاده کنید. Local SQLite برای توسعه و ورودی Migration در نظر گرفته شده است.
- `PROJECTOS_DATABASE_URL` و کلید MFA را در Secret Manager میزبان تزریق کنید. اتصال PostgreSQL خارج از loopback اعتبار TLS را بررسی می‌کند. در صورت استفاده از CA سازمان، PEM آن را با `PROJECTOS_PG_CA` در اختیار Runtime قرار دهید.
- نقش اجرای Migration اسکیمای SQL را بسازد. نقش Runtime دسترسی DDL یا UPDATE/DELETE روی جدول `audit_events` نداشته باشد. بکاپ با نقش خواندنی روی دیتابیس اختصاصی اجرا شود. پس از تغییر مجوزها، تست‌های محیط Staging را با نقش واقعی اجرا کنید.
- دامنهٔ HTTPS واقعی را دقیقاً برابر Origin مرورگر و بدون مسیر یا اسلش انتهایی در `PROJECTOS_PUBLIC_ORIGIN` قرار دهید. Proxy reverse باید TLS و محدودیت اندازهٔ بدنه را اعمال کند. برای فعال‌سازی `PROJECTOS_TRUST_CLIENT_IP` به Proxyای نیاز است که هدر ورودی `X-ProjectOS-Client-IP` را حذف و نشانی معتبر خودش را جایگزین کند. در نبود این تنظیم، برنامه محدودیت مشترک ورود اعمال می‌کند.
- `PROJECTOS_SETUP_TOKEN` تنها برای راه‌اندازی است. پس از ساخت مالک حذف شود. در استقرار خارج از loopback اولویت اقدام بعد، ثبت MFA است. نشست در انتظار MFA به API فضای کاری دسترسی ندارد.

```shell
npm ci --include=optional
npm run db:migrate
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

با `GET /api/health` سلامت لایهٔ دیتابیس را از روی کد ۲۰۰ یا ۵۰۳ بررسی کنید. این Endpoint دادهٔ عضویت یا جزئیات اتصال را برنمی‌گرداند. از بیرون، reverse proxy سلامت واقعی سرویس را پایش کند. برای Workerها `deployment/systemd/` الگوی Timer دارد. فایل محیط Worker باید همان دیتابیس را هدف بگیرد و حساب‌های آزمایشی مجزا داشته باشد.

## تأیید قبل از Cutover

تست‌های CI، SCA و CodeQL، مجوزهای نقش واقعی PostgreSQL، Migration، بازیابی از صفر، رصد زمان‌بندی، عملکرد و دسترس‌پذیری را در محیط هدف اجرا کنید. قطع نگه‌داشتن نوشتن تا پایان Smoke، امکان بازگشت به ورودی SQLite را حفظ می‌کند. اطلاعات پایدار آمادهٔ بهره‌برداری نیازمند Backup مستقل و تمرین بازیابی است. [راهنمای Migration](../migrations/SQLITE-TO-POSTGRES-FA.md)