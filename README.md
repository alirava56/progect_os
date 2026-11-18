# ProjectOS

ProjectOS فضای کاری فارسی و RTL برای پروژه‌ها، وظایف، زیرساخت، اسناد، زنگ‌های یادآوری و داده‌های مالی است. وضعیت انتشار این نسخه در [گزارش تحویل](docs/verification/FINAL-DELIVERY-REPORT-FA.md) ثبت شده است.

## اجرای محلی

به Node.js 22.18 یا بالاتر و npm نیاز دارید. برنامه را روی loopback و با دادهٔ آزمایشی اجرا کنید.

```powershell
npm ci --include=optional
Copy-Item .env.example .env.local
npm run dev -- --hostname 127.0.0.1
```

یک توکن تصادفی راه‌اندازی را خارج از Git تولید کنید و در `PROJECTOS_SETUP_TOKEN` بگذارید. `http://127.0.0.1:3000/setup` مالک اولیه را می‌سازد. پس از اتمام راه‌اندازی توکن را حذف کنید. SQLite محلی به‌صورت پیش‌فرض از `local-data/projectos.sqlite` استفاده می‌کند. سمت Production خارج از loopback به PostgreSQL و MFA نیاز دارد. پیکربندی در [راهنمای استقرار](docs/operations/DEPLOYMENT-FA.md) آمده است.

## اجرای آزمون

```powershell
npm run typecheck
npm run lint
npm run test:core
npm audit --audit-level=high
npm run build
npx playwright install chromium
npm run test:smoke
```

Smoke از Build تولید و دیتابیس موقت مستقل برای هر سناریو استفاده می‌کند. در Windows می‌توان مسیر Chrome نصب‌شده را با `PROJECTOS_PLAYWRIGHT_CHROMIUM` تعیین کرد. اجرای یکپارچهٔ PostgreSQL به سرویس آزمایشی loopback و ابزارهای همان نسخهٔ `pg_dump` و `pg_restore` نیاز دارد. توضیح و نتیجهٔ قابلیت‌ها و محدودیت‌ها در [Release Gates](docs/verification/RELEASE-GATES-FA.md) ثبت شده است.

## راهنماها

- [قرارداد API](docs/architecture/API-CONTRACT.md)
- [مدل داده](docs/architecture/ERD.md)
- [مدل تهدید](docs/security/THREAT-MODEL.md) و [ماتریس مجوزها](docs/security/AUTHZ-MATRIX.md)
- [انتقال SQLite و Rollback](docs/migrations/SQLITE-TO-POSTGRES-FA.md)
- [Backup و Restore](docs/operations/BACKUP-RESTORE-FA.md)
- [راه‌اندازی اتصال‌ها](docs/operations/INTEGRATIONS-FA.md)