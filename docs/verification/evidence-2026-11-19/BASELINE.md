# Baseline و شواهد ورودی ۱۹ نوامبر ۲۰۲۶

مبنای رسمی `ProjectOS-P0-Verified-2026-11-18.zip` با SHA-256 برابر `376662fcef9af1b20ed2f3e421121a85666a1c4aeb32e758e8b69843be83c019` بود. ZIP شامل ۱۷۷ فایل و ۲۵۱ ورودی با احتساب پوشه‌ها بود. مسیرهای `AGENTS.md`، `package.json`، `package-lock.json`، سورس، ۱۶ API، Workerها، تست‌ها، Threat Model و Release Gates حاضر بودند. ۲۰ صفحهٔ Workspace و ۳۲ آیکون PNG شمارش شد.

Baseline در مخزن محلی به‌شکل `44916a2f5b04212780d11eb410661c8e9742341b` ثبت شد. ZIP حاوی فایل دیتابیس یا تنظیمات واقعی نبود. این SHA تاریخچهٔ اصلی خارجی را نمایندگی نمی‌کند. نسخهٔ میزبان Windows x64 `10.0.26300.0` بود.

| دستور | نتیجهٔ سورس ورودی |
|---|---|
| `npm ci --include=optional` | ابتدا exit 1 با ENOTFOUND. پس از مجوز شبکه exit 0. |
| `npm run typecheck` و `npm run lint` | هر دو exit 0. |
| `npm run test:core` | exit 0. هر ۳۵ سناریو موفق. |
| `npm run build` | exit 0 روی Node.js 24.18.0، npm 11.16.0 و Next.js 16.4.6. |
| `npm run test:smoke` | هر ۹ سناریو نتیجهٔ موفق دادند. فرایند قدیمی بعد از آخرین تست از teardown خارج نشد. |
| `npm audit --audit-level=high` | exit 0. گزارش همین رجیستری و همین تاریخ صفر مورد نشان داد. |

سرور و DB ایزوله برای هر سناریو در کامیت `07ca9bc` جایگزین شدند. آزمون ۹/۹ روی همان Build تولید ورودی پس از این تغییر با exit 0 پایان یافت. این رفع نقص، مجموعهٔ آزمون را حذف یا Skip نکرد. خروجی‌های جدیدتر در گزارش تحویل و شواهد کنار آن ثبت شده‌اند.