# اجرای ProjectOS در محیط آزمون خصوصی

با Node.js 22 و دسترسی به رجیستری npm، دستورهای زیر را در ریشهٔ سورس اجرا کنید.

```bash
npm ci --include=optional
npm run typecheck
npm run lint
npm run test:core
npm run build
npx playwright install chromium
npm run test:smoke
npm audit --audit-level=high
```

Smoke از `next start` روی loopback و یک SQLite موقت استفاده می‌کند. دادهٔ آزمایشی با API معمول برنامه ساخته می‌شود و تنظیمات عملیاتی ProjectOS وارد فرایند تست نمی‌شوند. آزمون در این محیط با Chromium Headless جایگزین انجام شد.

برای اجرای دستی با دادهٔ ساختگی، `.env.example` را به `.env.local` کپی کنید و یک مقدار تصادفی آزمایشی برای `PROJECTOS_SETUP_TOKEN` تنظیم کنید. سپس `npm run dev -- --hostname 127.0.0.1` و صفحه `/setup` را باز کنید. راه‌اندازی، پشتیبان رمزنگاری‌شده و تنظیم Workerها در [راهنمای عملیات](RUNBOOK-FA.md) آمده‌اند.

انتشار Production بر اساس [گزارش تحویل](../verification/FINAL-DELIVERY-REPORT-FA.md) **NO-GO** است. انتقال دادهٔ واقعی، Cutover PostgreSQL و بازگردانی کامل هنوز معیار پذیرش ندارند.
