# شواهد آزمون مستقل — ProjectOS Hardened

تاریخ: ۱۸ نوامبر ۲۰۲۶؛ مسیر بررسی: آخرین سورس `ProjectOS-Hardened` در کانتینر Linux با Node.js 22. وابستگی‌های موجود از ZIP قبلی تنها برای اجرای تست‌های محلی از طریق Symlink استفاده شدند؛ این Symlink در بسته تحویل نیست.

| دستور | خروجی دیده‌شده | حکم |
|---|---|---|
| `npm run typecheck` | `tsc --noEmit`، Exit Code 0 | PASS |
| `npm run lint` | `eslint .`، Exit Code 0 | PASS |
| `npm run test:core` | `node --test scripts/core.test.cjs`، ۲۱ تست از ۲۱، ۰ شکست | PASS |
| `npm run build` | Exit Code 1: `Failed to load SWC binary for linux/x64`, فقدان `@next/swc-linux-x64-gnu` و fallback | **BLOCKED / NOT VERIFIED** |
| `npm run test:smoke` | اجرا نشد؛ WebServer به SWC سازگار نیاز دارد | **NOT RUN** |
| `npm audit --audit-level=high` | رجیستری npm از این محیط قابل دسترس نیست | **NOT VERIFIED** |
| Live Vault/Telegram/Email/GitHub/AI/PenTest/Offsite Restore | محیط، حساب و اعتبارنامه آزمایشیِ لازم فراهم نیست | **NOT VERIFIED** |

برخی تست‌ها «زیرساخت مستقیم کتابخانه‌ها» هستند و **تست کامل HTTP/API یا مرورگر نیستند**. برطرف‌کردن کمبود بسته بومی Next.js و اجرای آزمون E2E روی سیستم تمیز هنوز یک شرط اصلی انتشار است.

**تصمیم انتشار: NO-GO.** ۰ از ۵ Gate کامل بسته شده‌اند. برای جزئیات به `RELEASE-GATES-FA.md` مراجعه کنید.
