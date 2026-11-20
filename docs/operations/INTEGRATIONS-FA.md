# اتصال‌های ProjectOS

اتصال‌ها با تنظیمات سرور و Workspace یا Project مشخص فعال می‌شوند. در این تحویل دسترسی بیرونی با حساب Staging اپراتور لازم است. از رمز Production استفاده نکنید.

## Vault

`PROJECTOS_VAULT_WORKSPACE`، `PROJECTOS_VAULT_ORIGIN` و `PROJECTOS_VAULT_MOUNTS` را به میزبان HTTPS و Mountهای مجاز محدود کنید. `PROJECTOS_VAULT_TOKEN` باید فقط حق خواندن `<mount>/metadata/<prefix>/*` در KV v2 را داشته باشد. دسترسی مسیر `data` لازم نیست. مالک با رمز و عامل دوم فعال می‌تواند فراداده را بررسی کند. API تنها وضعیت، زمان و شمارهٔ نسخهٔ فراداده را ذخیره می‌کند. حذف، قطعی، عدم تنظیم و قدیمی بودن بررسی به‌صورت جدا نمایش داده می‌شوند. [قرارداد HashiCorp KV v2](https://developer.hashicorp.com/vault/api-docs/secret/kv/kv-v2)

## اعلان و زمان‌بندی

`PROJECTOS_NOTIFICATION_WORKSPACE` مقصد فضای کاری را محدود می‌کند. Telegram و Email به‌صورت جداگانه Opt-in هستند. ایمیل از Resend و شناسهٔ ثابت Idempotency استفاده می‌کند. Telegram پذیرش Provider را ثبت می‌کند. خطا به Retry و بعد از پنج تلاش به `failed` می‌انجامد. بعد از از دست رفتن Lease امکان تکرار ارسال وجود دارد. وضعیت `delivered` رسید خواندن نیست.

`PROJECTOS_REMINDER_OFFSETS` پیش‌فرض `14,7,3,1,0` دارد. یک موعد UTC ابتدا به روز محلی در zone موردنظر تبدیل می‌شود. زمان‌بندی تکرار روزانه، هفتگی و تقویمی ماهانه یا سالانه را دارد. قراردادها و چرخش Vault می‌توانند سررسید بسازند. Digest در صورت داشتن موعد باز، روزانه یک کلید ثابت دارد. زمان‌بند، ارسال و پایش باید در سامانهٔ عملیاتی اجرا شوند.

## GitHub

`PROJECTOS_GITHUB_PROJECTS` آرایهٔ JSON از اشیای `{workspaceId,projectId,repository}` است. Allowlist قبلی `PROJECTOS_GITHUB_REPOS` باید با این نگاشت جایگزین شود تا هر مخزن دامنهٔ روشنی داشته باشد. با توکن خواندنی محدود به مخازن آزمایشی، مالک می‌تواند Overview، نمونهٔ Issue و Release و وضعیت آخرین Deployment را به‌روز کند. محدودیت نرخ زمان Retry دارد. Webhook معتبر با بدنهٔ HMAC و کلید `PROJECTOS_GITHUB_WEBHOOK_SECRET` به‌صورت idempotent ثبت می‌شود و خواندن را در انتظار Refresh قرار می‌دهد. بعد از دریافت رویداد، همگام‌سازی از پنل قابل اجراست. [اعتبارسنجی GitHub Webhook](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)

صفحهٔ پروژه نمونهٔ تاریخ‌دار Commitها، شاخه‌ها، Pull Requestها و Issueهای باز را نشان می‌دهد. «همگام‌سازی» نمونهٔ اخیر و «دریافت سابقه» حداکثر ۳۰ قلم در هر نوع را بررسی می‌کند. اجرای بعدی نمونهٔ جاری را به‌روز می‌کند. مجوز خواندن Contents، Pull requests، Issues و Deployment را برای همان مخازن بررسی کنید. [Commit API](https://docs.github.com/en/rest/commits/commits#list-commits) · [Branch API](https://docs.github.com/en/rest/branches/branches#list-branches) · [Pull Request API](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests)

## پایش و حافظه پروژه

Worker HTTPS روی `PROJECTOS_MONITOR_HOSTS` و `PROJECTOS_MONITOR_WORKSPACE` محدود است. عامل میزبان فقط از مسیر امن `/api/monitoring/observations` گزارش می‌دهد و به شناسهٔ منابع مجاز محدود می‌شود. برای فعال‌سازی اندازه‌گیری دیسک، `PROJECTOS_AGENT_DISK_PATH` را روی مسیر فایل‌سیستم در همان میزبان تنظیم کنید. عامل فقط ظرفیت و مصرف را ارسال می‌کند. نام مسیر در دادهٔ پایش ثبت نمی‌شود. وضعیت تازه، قدیمی و نامشخص و منبع مشاهده مشخص است. پایش VPN و SLA چندنقطه‌ای به اتصال آزمایشی جداگانه نیاز دارد.

حافظهٔ پروژه به‌صورت محلی از داده مجاز استخراج می‌شود. ارسال گزیده به مدل صرفاً پس از فعال‌سازی دو تنظیم Server-side و رضایت همان درخواست مالک برای پروژه مشخص ممکن است. سرور تنها گزیدهٔ عینی با شناسهٔ منبع معتبر را نمایش می‌دهد. آزمون ارائه‌دهندهٔ واقعی در این تحویل انجام نشده است.
