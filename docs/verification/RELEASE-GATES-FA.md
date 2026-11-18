# ProjectOS Hardened — Gateهای انتشار در ۱۸ نوامبر ۲۰۲۶

## تعریف Done
وجود فایل، API یا دکمه به معنی Done نیست. تا زمانی که مسیر اصلی، مسیر خطا، کنترل
دسترسی، پایداری، بازیابی و سناریوی E2E در محیط مناسب تأیید نشده‌اند Gate باز می‌ماند.

| Gate | انجام‌شده در سورس | مانع نهایی | حکم |
|---|---|---|---|
| A — تثبیت | TypeScript, ESLint، تست‌های هسته، E2E جدید در سورس، CI هماهنگ‌شده | Build Linux در این محیط، اجرای Playwright و Visual/RTL QA | OPEN |
| B — داده و امنیت | ورود Owner/MFA و Recovery، نشست‌ها، دعوت تیم و RBAC محدود، داده SQLite و API رکوردی | PostgreSQL و Migration/Rollback، MFA/Recovery ممیزی HTTP، RBAC چند-workspace، Rate-limit تحلیلی | OPEN |
| C — Vault، موعد و Backup | ارجاع لینک Vault امن، Worker موعد، تایمر systemd نمونه، Backup AES-GCM، تست Legacy Redaction | Vault متصل، ایمیل، راه‌اندازی تایمر در سرور واقعی، Offsite، Full Restore و آزمون انتقال پیام | OPEN |
| D — امکانات پیشرفته | HTTPS monitor محدود، GitHub read-only، درآمد/قرارداد/اشتراک پایه، AI اختیاری و جست‌وجوی منبع | مانیتورینگ VPS واقعی، webhooks، Ledger/Reconciliation چندارزی، آزمون AI/citation/ACL | OPEN |
| E — انتشار | کنترل استاتیک اولیه، فایل Threat Model جدید و Runbook | SAST/SCA، Pentest، WCAG، Performance/Soak، DR drill، Rollback و Observability | OPEN |

**نتیجه:** ۰ از ۵ Gate نهایی بسته شده است. وضعیت: **NO-GO** برای اینترنت عمومی
یا ذخیره رمز واقعی. این نسخه فقط برای آزمایش خصوصی با داده غیرمحرمانه مناسب است.

## نحوه تأیید مرحله بعد
1. روی Windows و Linux تمیز: `npm ci --include=optional`, `npm run build`.
2. روی CI: `npm run typecheck`, `npm run lint`, `npm run test:core`, `npm run test:smoke` و `npm audit`.
3. آزمون HTTP واقعی: جلسه کاربر، CSRF، IDOR، Invite Abuse، Permission Matrix، MFA Recovery.
4. روی Staging با اطلاعات آزمایشی: حفظ داده بعد از Restart، Backups و Full Restore.
5. اتصال‌های Vault، GitHub، تلگرام، Monitoring، AI با اعتبارنامه تست و ثبت شواهد؛ بدون رمز واقعی.
6. گزارش‌های واقعی Security/Performance/Accessibility و Change Approval پیش از انتشار.
