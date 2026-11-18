import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { routes } from './routes';

const widths = [360, 390, 768, 1024, 1440, 1920];
const mobileReferences = ['dashboard', 'projects', 'project', 'tasks', 'infrastructure'];

for (const width of widths) {
  test(`21 RTL routes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 390 ? 880 : 1000 });
    const errors: string[] = [];
    const external = new Set<string>();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('request', request => {
      const url = new URL(request.url());
      if ((url.protocol === 'https:' || url.protocol === 'http:') && url.hostname !== '127.0.0.1') external.add(url.origin);
    });

    for (const [route, key, title] of routes) {
      await test.step(route, async () => {
        const response = await page.goto(route);
        expect(response?.ok()).toBe(true);
        await expect(page.getByRole('heading', { name: title, level: 1, exact: true })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('dir','rtl');
        await expect(page.locator('html')).toHaveAttribute('lang','fa');
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        if (width <= 390) {
          const compactTablesFit = await page.locator('.table-compact').evaluateAll(tables =>
            tables.every(table => table.scrollWidth <= table.clientWidth + 1));
          expect(compactTablesFit).toBe(true);
        }
        if (key !== 'login') {
          await expect(page.getByRole('navigation', { name: 'مسیر صفحه' })).toBeVisible();
          await expect(page.getByRole('navigation', { name: width > 900 ? 'منوی اصلی' : 'دسترسی سریع' })).toBeVisible();
        }
        const shots = process.env.PROJECTOS_SCREENSHOTS;
        if (shots && (width === 1440 || (width === 390 && mobileReferences.includes(key)))) {
          await mkdir(shots, { recursive: true });
          await page.screenshot({ path: path.join(shots,`${width}-${key}.png`),fullPage:true,animations:'disabled' });
        }
      });
    }
    expect(errors).toEqual([]);
    expect([...external]).toEqual([]);
  });
}
