import { test, expect } from '@playwright/test';

test('global search, keyboard dialog, no-results, and nested navigation', async ({ page }) => {
  await page.goto('/dashboard');
  const trigger = page.getByRole('button', {name:'جست‌وجوی فضای کاری'});
  await trigger.focus();
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog');
  const search = dialog.getByRole('searchbox');
  await expect(search).toBeFocused();
  await search.fill('zqx-not-a-record');
  await expect(dialog.getByText('نتیجه‌ای پیدا نشد')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  for (const [query, title, href] of [
    ['mokmok','MOKMOK','/projects/mokmok'],
    ['task-024','رفع ناسازگاری رابط رزرو','/tasks/TASK-024'],
    ['203.0.113.24','NovaGuard Main VPS','/infrastructure/servers/nova-vps'],
    ['معماری دیتابیس','معماری دیتابیس باشگاه','/docs?doc=gym-schema'],
  ]) {
    await trigger.click();
    await search.fill(query);
    await dialog.getByRole('link', {name:new RegExp(title)}).first().click();
    await expect(page).toHaveURL(href);
    await expect(dialog).toHaveCount(0);
  }
  await expect(page.getByRole('heading',{name:'معماری دیتابیس باشگاه'})).toBeVisible();
});

test('mobile drawer and fixed navigation', async ({ page }) => {
  await page.setViewportSize({width:390,height:880});
  await page.goto('/dashboard');
  const mobileNav = page.getByRole('navigation',{name:'دسترسی سریع'});
  await mobileNav.getByRole('link',{name:'پروژه‌ها'}).click();
  await expect(mobileNav.getByRole('link',{name:'پروژه‌ها'})).toHaveAttribute('aria-current','page');
  await page.getByRole('button',{name:'منوی اصلی'}).click();
  await page.getByRole('dialog').getByRole('link',{name:'تقویم'}).click();
  await expect(page).toHaveURL('/calendar');
  await page.getByRole('button',{name:'اعلان‌ها',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'اعلان‌های نمونه'})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'حساب کاربری'}).click();
  await page.getByRole('dialog').getByRole('link',{name:'تنظیمات حساب'}).click();
  await expect(page).toHaveURL('/settings');
});

test('create, edit, navigate, archive and restore a project', async ({ page }) => {
  await page.goto('/projects');
  await page.getByRole('button',{name:'پروژه جدید',exact:true}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('نام پروژه',{exact:true}).fill('پروژه آزمایش رابط');
  await dialog.getByLabel('نوع پروژه').selectOption({label:'زیرساخت'});
  await dialog.getByLabel('پیشرفت (درصد)').fill('32');
  await dialog.getByRole('button',{name:'ایجاد پروژه'}).click();
  await expect(page).toHaveURL(/\/projects\/project-/);
  await expect(page.getByRole('heading',{level:1,name:'پروژه آزمایش رابط'})).toBeVisible();
  await page.getByRole('button',{name:'مستندات',exact:true}).click();
  await expect(page.getByText('سندی ثبت نشده است')).toBeVisible();
  await page.getByRole('button',{name:'ویرایش پروژه'}).click();
  await dialog.getByLabel('نام پروژه',{exact:true}).fill('پروژه بازبینی رابط');
  await dialog.getByRole('button',{name:'ذخیره تغییرات'}).click();
  await expect(page.getByRole('heading',{level:1,name:'پروژه بازبینی رابط'})).toBeVisible();
  await page.getByRole('button',{name:'بایگانی پروژه'}).click();
  await dialog.getByRole('button',{name:'تأیید بایگانی'}).click();
  await expect(page.getByText('بایگانی‌شده',{exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'منوی اصلی'}).getByRole('link',{name:'پروژه‌ها',exact:true}).click();
  await page.getByLabel('فیلتر وضعیت').selectOption('archived');
  await page.getByRole('table').getByRole('link',{name:/پروژه بازبینی رابط/}).click();
  await page.getByRole('button',{name:'بازگردانی پروژه'}).click();
  await dialog.getByRole('button',{name:'بازگردانی',exact:true}).click();
  await expect(page.getByText('در حال توسعه',{exact:true})).toBeVisible();
});

test('task creation, status mutation, list filters, checklist and comments', async ({ page }) => {
  await page.goto('/tasks');
  await page.getByRole('button',{name:'وظیفه جدید',exact:true}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('عنوان وظیفه').fill('وظیفه آزمون مرورگر');
  await dialog.getByLabel('پروژه',{exact:true}).selectOption('gym');
  await dialog.getByLabel('اولویت').selectOption('high');
  await dialog.getByLabel('موعد (میلادی)').fill('2025-11-17');
  await dialog.getByRole('button',{name:'ایجاد وظیفه'}).click();
  await expect(page).toHaveURL(/\/tasks\/task-/);
  await page.getByLabel('تغییر وضعیت وظیفه').selectOption('done');
  await page.getByLabel('یادداشت جدید').fill('یادداشت آزمون');
  await page.getByRole('button',{name:'ثبت یادداشت'}).click();
  await expect(page.getByText('یادداشت آزمون',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'ویرایش وظیفه'}).click();
  await dialog.getByLabel('عنوان وظیفه').fill('وظیفه بازبینی مرورگر');
  await dialog.getByRole('button',{name:'ذخیره تغییرات'}).click();
  await page.getByRole('navigation',{name:'منوی اصلی'}).getByRole('link',{name:'مدیریت وظایف'}).click();
  await page.getByRole('button',{name:'نمای فهرست'}).click();
  await page.getByLabel('فیلتر پروژه').selectOption('gym');
  await page.getByLabel('فیلتر وضعیت').selectOption('done');
  await page.getByRole('searchbox',{name:'جست‌وجوی وظیفه'}).fill('بازبینی مرورگر');
  await expect(page.getByRole('link',{name:'وظیفه بازبینی مرورگر'})).toBeVisible();
  await page.getByRole('link',{name:'ProjectOS',exact:true}).click();
  await page.getByRole('link',{name:/رفع ناسازگاری رابط رزرو/}).click();
  const checklist = page.getByLabel('بازبینی انتخاب ساعت در موبایل');
  await checklist.check();
  await expect(checklist).toBeChecked();
  await expect(page.getByRole('link',{name:/بهبود متن‌های راهنما/})).toBeVisible();
});

test('inventory validates sample addresses, creates server, and opens a domain', async ({ page }) => {
  await page.goto('/infrastructure');
  const more = page.getByRole('button',{name:'نمایش منابع بیشتر'});
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(7);
  await more.click();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(13);
  await page.getByRole('button',{name:'نمایش کمتر'}).click();
  await page.getByRole('button',{name:'دامنه‌ها',exact:true}).click();
  const table = page.getByRole('table');
  await expect(table.getByText('NovaGuard Main VPS')).toHaveCount(0);
  await table.getByRole('link',{name:'NovaGuard Domain'}).click();
  await expect(page.getByRole('dialog',{name:'NovaGuard Domain'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'سرورها',exact:true}).click();
  await page.getByRole('button',{name:'افزودن منبع'}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('نام منبع').fill('Review VPS');
  await dialog.getByLabel('پروژه',{exact:true}).selectOption('novaguard');
  await dialog.getByLabel('آدرس',{exact:true}).fill('10.0.0.1');
  await dialog.getByRole('button',{name:'ثبت مشخصات'}).click();
  await expect(dialog.getByRole('alert')).toContainText('آدرس مستندسازی');
  await dialog.getByLabel('آدرس',{exact:true}).fill('198.51.100.62');
  await dialog.getByRole('button',{name:'ثبت مشخصات'}).click();
  await expect(page).toHaveURL(/\/infrastructure\/servers\/resource-/);
  await expect(page.getByRole('heading',{name:'Review VPS',level:1})).toBeVisible();
  await expect(page.getByText('198.51.100.62',{exact:true})).toHaveAttribute('dir','ltr');
});

test('vault creates only reference metadata and discloses unconnected access', async ({ page }) => {
  await page.goto('/vault');
  await page.getByRole('button',{name:'افزودن ارجاع'}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('input[type=password]')).toHaveCount(0);
  await dialog.getByLabel('عنوان ارجاع').fill('نمونه ارجاع تیم');
  await dialog.getByLabel('پروژه',{exact:true}).selectOption('gym');
  await dialog.getByLabel('محل خزانه').fill('Vault / Staging');
  await dialog.getByRole('button',{name:'ثبت ارجاع'}).click();
  await page.getByRole('button',{name:'نمونه ارجاع تیم'}).click();
  await expect(dialog.getByText('متصل نیست',{exact:true})).toBeVisible();
});

test('calendar navigation and a reminder on the selected day', async ({ page }) => {
  await page.goto('/calendar');
  await page.getByRole('button',{name:'ماه بعد'}).click();
  await expect(page.getByRole('heading',{name:/آذر/})).toBeVisible();
  await page.getByRole('button',{name:'ماه قبل'}).click();
  await page.getByRole('button',{name:'هفته',exact:true}).click();
  await page.getByRole('button',{name:'رویداد جدید'}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('عنوان رویداد').fill('یادآوری بازبینی مرورگر');
  await dialog.getByLabel('پروژه',{exact:true}).selectOption('gym');
  await dialog.getByRole('button',{name:'ثبت رویداد'}).click();
  await expect(page.locator('.calendar-event').filter({hasText:'یادآوری بازبینی مرورگر'})).toBeVisible();
});

test('monitoring range, empty state, error and retry', async ({ page }) => {
  await page.goto('/monitoring');
  const currentPath = await page.locator('.trend path').last().getAttribute('d');
  await page.getByLabel('بازه پایش').selectOption({label:'۲۴ ساعت'});
  await expect(page.locator('.trend path').last()).not.toHaveAttribute('d',currentPath!);
  await page.getByLabel('سناریوی پایش').selectOption('empty');
  await expect(page.getByText('برای این نما داده‌ای وجود ندارد')).toBeVisible();
  await page.getByLabel('سناریوی پایش').selectOption('error');
  await page.getByRole('button',{name:'تلاش دوباره'}).click();
  await expect(page.getByText('در حال بارگذاری دادهٔ نمونه…')).toBeVisible();
  await expect(page.getByRole('img',{name:/روند مصنوعی/})).toBeVisible();
});

test('alert snooze, filter and acknowledge', async ({ page }) => {
  await page.goto('/alerts');
  const title = 'تاریخ تمدید سرور ثبت نشده';
  await page.getByRole('button',{name:new RegExp(title)}).click();
  await page.getByRole('button',{name:'تعویق ۲۴ ساعته'}).click();
  await expect(page.getByRole('button',{name:new RegExp(title)})).toHaveCount(0);
  await page.getByLabel('وضعیت هشدار').selectOption('snoozed');
  await page.getByRole('button',{name:new RegExp(title)}).click();
  await page.getByRole('button',{name:'ثبت رسیدگی'}).click();
  await page.getByLabel('وضعیت هشدار').selectOption('acknowledged');
  await expect(page.getByRole('button',{name:new RegExp(title)})).toBeVisible();
});

test('expense create, filter by category and dates, report download', async ({ page }) => {
  await page.goto('/finance');
  await page.getByRole('button',{name:'هزینه جدید'}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('شرح هزینه').fill('اشتراک نمونه تیم');
  await dialog.getByLabel('پروژه',{exact:true}).selectOption('mokmok');
  await dialog.getByLabel('دسته‌بندی').selectOption({label:'اشتراک'});
  await dialog.getByLabel('مبلغ نمونه (تومان)').fill('125000');
  await dialog.getByLabel('تاریخ (میلادی)').fill('2026-01-15');
  await dialog.getByRole('button',{name:'ذخیره هزینه'}).click();
  await page.getByLabel('دسته‌بندی هزینه').selectOption({label:'اشتراک'});
  await page.getByLabel('از تاریخ (میلادی)').fill('2026-01-01');
  await expect(page.getByRole('table').getByText('اشتراک نمونه تیم')).toBeVisible();
  await expect(page.getByRole('table').getByText('سرویس استقرار')).toHaveCount(0);
  await expect(page.getByRole('table').getByText('۱۲۵٬۰۰۰ تومان')).toBeVisible();
  await page.getByRole('navigation',{name:'منوی اصلی'}).getByRole('link',{name:'گزارش‌ها و تحلیل'}).click();
  const result = page.waitForEvent('download');
  await page.getByRole('button',{name:'خروجی گزارش'}).click();
  expect((await result).suggestedFilename()).toBe('projectos-report.csv');
});

test('document navigation, editing, search and assistant fixture sources', async ({ page }) => {
  await page.goto('/docs?doc=mok-pricing');
  await expect(page.getByRole('heading',{name:'قواعد موتور تطبیق بودجه'})).toBeVisible();
  await page.getByRole('button',{name:'ویرایش سند',exact:true}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('متن نمونه و غیرحساس').fill('یادداشت آزمایش سند <b>متن ساده</b>');
  await dialog.getByRole('button',{name:'ذخیره سند'}).click();
  await expect(page.locator('.document-body')).toHaveText('یادداشت آزمایش سند <b>متن ساده</b>');
  await page.getByRole('searchbox').fill('فاقد-نتیجه');
  await expect(page.getByText('سندی با این جست‌وجو پیدا نشد')).toBeVisible();
  await page.getByRole('navigation',{name:'منوی اصلی'}).getByRole('link',{name:'دستیار نمایشی'}).click();
  await page.getByRole('button',{name:'گفت‌وگوی جدید'}).click();
  await page.getByRole('button',{name:/در MOKMOK چه تصمیمی/}).click();
  await page.getByRole('link',{name:'قواعد تطبیق بودجه'}).click();
  await expect(page).toHaveURL('/docs?doc=mok-pricing');
  await expect(page.locator('.document-body')).toContainText('یادداشت آزمایش سند');
});

test('activity records an event and links the optional task through shared state', async ({ page }) => {
  await page.goto('/activity');
  await page.locator('#new-event').getByLabel('پروژه',{exact:true}).selectOption('gym');
  await page.getByLabel('عنوان رویداد').fill('مرور رخداد نمونه');
  await page.getByLabel('چه اتفاقی افتاد؟').fill('نیاز به بازبینی در پروژه');
  await page.getByLabel('هم‌زمان یک وظیفه بساز').check();
  await page.getByRole('button',{name:'ثبت رویداد',exact:true}).click();
  await page.getByLabel('منبع رویداد').selectOption({label:'ثبت دستی'});
  await expect(page.locator('.timeline')).toContainText('مرور رخداد نمونه');
  await page.getByRole('navigation',{name:'منوی اصلی'}).getByRole('link',{name:'مدیریت وظایف'}).click();
  await expect(page.getByRole('link',{name:/مرور رخداد نمونه/})).toBeVisible();
});

test('team invite, integration disclosure and persisted UI preferences', async ({ page }) => {
  await page.goto('/team');
  await page.getByRole('button',{name:'دعوت کاربر'}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('نام نمایشی').fill('همکار آزمایشی');
  await dialog.getByLabel('ایمیل نمونه').fill('teammate@example.com');
  await dialog.getByRole('button',{name:'ثبت دعوت نمونه'}).click();
  await expect(page.getByRole('table').getByText('teammate@example.com')).toBeVisible();
  const nav = page.getByRole('navigation',{name:'منوی اصلی'});
  await nav.getByRole('link',{name:'اتصال سرویس‌ها'}).click();
  await page.getByRole('button',{name:'جزئیات اتصال'}).first().click();
  await expect(dialog.getByRole('button',{name:'برقراری اتصال'})).toBeDisabled();
  await page.keyboard.press('Escape');
  await nav.getByRole('link',{name:'تنظیمات',exact:true}).click();
  await page.getByLabel('نام فضای کاری').fill('فضای آزمون');
  await page.getByLabel('ظاهر',{exact:true}).selectOption('dim');
  await page.getByRole('switch',{name:'خلاصه روزانه پروژه‌ها'}).click();
  await page.getByRole('button',{name:'ذخیره تغییرات'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dim');
  await page.reload();
  await expect(page.getByLabel('نام فضای کاری')).toHaveValue('فضای آزمون');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dim');
  await nav.getByRole('link',{name:'کاربران و دسترسی‌ها'}).click();
  await expect(page.getByText('teammate@example.com')).toHaveCount(0);
});
