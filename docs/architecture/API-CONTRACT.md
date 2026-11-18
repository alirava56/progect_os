# قرارداد API فعلی ProjectOS

این قرارداد سطح قابل مشاهده در Private Preview است. مدل داده فعلی در `src/lib/server/db.ts` تعریف شده و جدول نقش‌ها در [PERMISSIONS.md](PERMISSIONS.md) آمده است.

| مسیر | رفتار فعلی | آزمون اجرایی |
|---|---|---|
| `GET /api/state` | نشست معتبر، state و نسخه Workspace. Vault و رویداد مرتبط فقط Owner. `Cache-Control: private, no-store` | `tests/functional.spec.ts` |
| `PUT /api/state` | Owner و Origin مجاز، بدنه `{version,data}`، پاسخ `{ok,version}`، نسخه قدیمی 409، داده نامعتبر 422، نقش غیرمجاز 403 | همان |
| `GET /api/records/{kind}/{id}` | نشست معتبر، خواندن رکورد Workspace و نسخه، رکورد Vault برای Editor و Viewer مانند رکورد ناموجود، 404 | همان |
| `POST/PUT/DELETE /api/records/{kind}/{id}` | Origin مجاز و نسخه Workspace، Owner و Editor فقط در نوع‌های مجاز، `record.id` باید با مسیر یکسان باشد، تعارض نسخه 409 | همان |
| `GET /api/docs/history?id=...` | نشست معتبر، جست‌وجوی شناسه در Workspace و تاریخچه ماسک‌شده. کنترل مستقل Project وجود ندارد. | اجرای HTTP جامع باز |
| `POST /api/auth/sessions` | درخواست `revokeOthers` نیازمند تأیید دوباره رمز است، Session جاری باقی می‌ماند. | `tests/functional.spec.ts` |

مدل کنونی Workspace، Membership، User و Session را از رکوردهای دامنه، تاریخچه سند، Audit و Outbox جدا می‌کند. رکوردهای دامنه یک payload JSON در جدول `records` هستند. `project_id` برای جست‌وجو استفاده می‌شود و قیود روابط دامنه در `validation.ts` اعمال می‌شوند. پیش‌نویس PostgreSQL برای انتخاب طراحی بعدی در [POSTGRES-TARGET-DRAFT.sql](POSTGRES-TARGET-DRAFT.sql) است. نسخه و قفل کنونی در سطح Workspace است.
