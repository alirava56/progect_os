# Gateهای انتشار ProjectOS

Gate وقتی PASS است که پیاده‌سازی، آزمون مسیر عادی و خطا، شواهد عملیاتی و محیط مربوط تأیید شوند. نتیجهٔ محلی به‌تنهایی مجوز انتشار عمومی ایجاد نمی‌کند.

| Gate | تأیید موجود | شرط تکمیل |
|---|---|---|
| A | نصب تمیز، Build، TypeScript، ESLint، Core، CI ویندوز و لینوکس و CodeQL، و Smoke ایزوله | ۱۳ آزمون Workflow تاریخی و بررسی خطای متناوب Restore در CI |
| B | PostgreSQL واقعی، Migration و Rollback در تراکنش، HTTP RBAC/MFA، عملیات اتمیک و بازیابی محلی | مدل هدف کامل، بررسی نقش‌های محیط هدف، Cutover و Rollback عملیاتی |
| C | Vault فراداده، تکرار و Lease پایدار، Backup رمزنگاری‌شده و Restore محلی | Vault و ارسال آزمایشی واقعی، Timer عملیاتی، Offsite و RPO/RTO |
| D | مشاهدهٔ HTTPS و عامل میزبان دارای زمان و منبع، GitHub و Memory مجوزمحور، مجموع دقیق چندارزی | تأیید ارائه‌دهنده، Backfill خودکار GitHub، Invoice/Payment/FX و VPN/SLO |
| E | شواهد HTTP، A11y خودکار محدود، ۲۱ مسیر RTL در شش عرض، Migration و بازیابی ایزوله | پوشش کامل Workflow، بررسی جامع بصری و دستی WCAG، load/soak و ممیزی مستقل |

نتیجهٔ رسمی، سیاست ممنوعیت Production، دستورات اجرا و شواهد در [گزارش تحویل](FINAL-DELIVERY-REPORT-FA.md) درج شده است.
