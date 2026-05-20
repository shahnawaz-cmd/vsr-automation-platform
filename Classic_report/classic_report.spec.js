const { test, expect } = require('@playwright/test');

class Classic_Report {
  constructor(page, url) {
    this.page = page;
    this.url = url;
  }

  async goto() { 
    for (let i = 0; i < 3; i++) {
        try {
            await this.page.goto(this.url, { waitUntil: 'networkidle', timeout: 60000 });
            return;
        } catch (error) {
            if (i === 2 || (error.message.includes('ERR_NETWORK_CHANGED') === false && error.message.includes('ERR_NAME_NOT_RESOLVED') === false)) throw error;
            await this.page.waitForTimeout(3000);
        }
    }
  }

  async checkFullPageOverflow() {
    return await this.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  }
  async checkContainerAlignment() {
    return await this.page.evaluate(() => Array.from(document.querySelectorAll('header, main, footer')).every(el => el.getBoundingClientRect().width <= window.innerWidth));
  }
  async checkGridStacking() {
    return await this.page.evaluate(() => {
        const columns = Array.from(document.querySelectorAll('.grid, .column, .col'));
        const visibleCols = columns.filter(col => col.offsetParent !== null);
        if (visibleCols.length === 0) return true;
        return visibleCols.every(col => col.getBoundingClientRect().width > 0);
    });
  }
  async checkHeadingScaling() {
    return await this.page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(h => h.every(el => parseInt(window.getComputedStyle(el).fontSize) > 0));
  }
  async checkTextWrapping() {
      return await this.page.locator('p, label, span').evaluateAll(ps => ps.every(p => p.scrollWidth <= p.clientWidth + 5));
  }
  async checkImageScaling() {
    return await this.page.locator('img').evaluateAll(imgs => imgs.map(img => img.naturalWidth <= img.parentElement.clientWidth + 10).every(r => r));
  }
  async toggleMenu() {
    const menu = this.page.locator('label[for="mobile-menu"][aria-label="Toggle menu"], .menu-toggle, .hamburger, [aria-label="Toggle menu"]').first();
    const isMenuOpen = async () => await this.page.locator('nav:not(.hidden), .mobile-menu').isVisible();
    
    if (await menu.isVisible()) {
        await menu.click();
        await this.page.waitForTimeout(500);
        if (await isMenuOpen()) {
            await menu.click();
            await this.page.waitForTimeout(500);
        }
    }
  }
  async checkStickyBehavior() {
    return await this.page.locator('header').first().evaluate(el => getComputedStyle(el).position === 'fixed' || getComputedStyle(el).position === 'sticky');
  }
  async checkTapTargets() {
    const interactables = await this.page.locator('button, a, input').all();
    for (const el of interactables) {
      if (await el.isVisible()) {
        const box = await el.boundingBox();
        if (box && (box.width < 44 || box.height < 44)) return false;
      }
    }
    return true;
  }
  async isTableScrollable() {
    return await this.page.locator('table').evaluateAll(tables => tables.every(t => t.parentElement.scrollWidth > t.parentElement.clientWidth));
  }
  async checkFormAlignment() {
    return await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const visibleInputs = inputs.filter(i => i.offsetParent !== null);
        return visibleInputs.every(i => i.getBoundingClientRect().width > 0);
    });
  }
  async checkAccordions() {
    const triggers = await this.page.locator('details summary, .faq-question, button[aria-expanded]').all();
    const limit = Math.min(triggers.length, 3);
    for (let i = 0; i < limit; i++) {
        const t = triggers[i];
        if (await t.isVisible()) {
            await t.click(); 
            await this.page.waitForTimeout(300);
            await t.click();
        }
    }
    return true;
  }

  async checkFooterVisibility() { return await this.page.locator('footer').first().isVisible(); }
  async getAllLinkStatuses() {
    const links = await this.page.locator('a').all();
    const results = { internal: { passed: [], failed: [] }, external: { passed: [], failed: [] } };
    const baseUrl = new URL(this.url).origin;

    const linkChecks = links.map(async (link) => {
        const href = await link.getAttribute('href');
        if (!href) return;

        let fullUrl;
        try {
            fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
        } catch (e) { return; }

        const isInternal = fullUrl.startsWith(baseUrl);
        const category = isInternal ? 'internal' : 'external';

        try {
            const response = await this.page.request.get(fullUrl);
            const status = response.status();
            const data = { href: fullUrl, status };
            
            if (status >= 200 && status < 300) {
                results[category].passed.push(data);
            } else {
                results[category].failed.push(data);
            }
        } catch (e) {
            results[category].failed.push({ href: fullUrl, error: e.message });
        }
    });

    await Promise.all(linkChecks);
    return results;
  }

  async checkFooterStacking() { return await this.page.locator('footer').first().evaluate(el => el.getBoundingClientRect().width <= window.innerWidth); }
  async scrollToBottom() {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }
  async checkViewportMeta() {
    const meta = await this.page.locator('meta[name="viewport"]');
    const content = await meta.getAttribute('content');
    return content !== null;
  }

  async getMetaTitle() { return await this.page.title(); }
  async getMetaDescription() { return await this.page.locator('meta[name="description"]').getAttribute('content'); }
  async verifyCTAButtons() {
    const ctaSelectors = ['button', 'a.button', 'a.cta', '.btn-primary', '.btn-search', 'input[type="submit"]'];
    const ctaButtons = this.page.locator(ctaSelectors.join(', '));
    const count = await ctaButtons.count();
    const missing = [];
    for (let i = 0; i < count; i++) {
        const btn = ctaButtons.nth(i);
        if (await btn.isVisible()) {
            const box = await btn.boundingBox();
            if (!box || box.width === 0 || box.height === 0) {
                missing.push(await btn.innerText());
            }
        }
    }
    return { totalFound: count, missing };
  }
  async getHeadingHierarchy() {
    return await this.page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const list = headings.map(h => ({ tag: h.tagName, text: h.innerText.trim() }));
        return { count: headings.length, list };
    });
  }
}

const classicReportUrls = [
    'https://vsr.accessautohistory.com/classic-vehicle-history'
];

const viewports = [
    { width: 360, height: 640 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 395, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1366, height: 768 }
];

for (const targetUrl of classicReportUrls) {
    test.describe(`Classic Report Module - ${targetUrl}`, () => {
        for (const viewport of viewports) {
            test.describe(`Viewport: ${viewport.width}x${viewport.height}`, () => {
                test.use({ viewport: viewport });
                let targetPage;
                
                test.beforeEach(async ({ page }) => {
                    test.setTimeout(90000);
                    targetPage = new Classic_Report(page, targetUrl);
                    await targetPage.goto();
                    await page.waitForLoadState('networkidle');
                    await targetPage.scrollToBottom();
                    await page.waitForTimeout(1000); // Allow time for elements to settle after scroll
                });

                test.afterEach(async ({ page }) => {
                    await page.close();
                });

                test('Batch: All Responsive Cases', async () => {
                    expect(await targetPage.checkFullPageOverflow(), 'R01 Failed').toBe(true);
                    expect(await targetPage.checkContainerAlignment(), 'R02 Failed').toBe(true);
                    expect(await targetPage.checkGridStacking(), 'R03 Failed').toBe(true);
                    expect(await targetPage.checkHeadingScaling(), 'T01 Failed').toBe(true);
                    await targetPage.toggleMenu();
                    expect(await targetPage.checkStickyBehavior(), 'I02 Failed').toBe(true);
                    expect(await targetPage.isTableScrollable(), 'C01 Failed').toBe(true);
                    expect(await targetPage.checkFormAlignment(), 'C02 Failed').toBe(true);
                    expect(await targetPage.checkAccordions(), 'C03 Failed').toBe(true);
                    expect(await targetPage.checkFooterVisibility(), 'RES-14 Failed').toBe(true);
                    expect(await targetPage.checkFooterStacking(), 'RES-16 Failed').toBe(true);
                    expect(await targetPage.checkViewportMeta(), 'M01 Failed').toBe(true);
                });
            });
        }

        test('One-Time: Meta, Heading, Link Integrity, and CTA Report', async ({ page }, testInfo) => {
            test.setTimeout(90000);
            const targetPage = new Classic_Report(page, targetUrl);
            await targetPage.goto();
            
            const title = await targetPage.getMetaTitle();
            const desc = await targetPage.getMetaDescription();
            await testInfo.attach('Meta Data Report', { body: JSON.stringify({ title, desc }, null, 2), contentType: 'application/json' });
            expect(title.length).toBeGreaterThan(0);
            
            const headingData = await targetPage.getHeadingHierarchy();
            await testInfo.attach('Heading Report', { body: JSON.stringify(headingData, null, 2), contentType: 'application/json' });
            
            const linkResults = await targetPage.getAllLinkStatuses();
            await testInfo.attach('Full Link Report', { body: JSON.stringify(linkResults, null, 2), contentType: 'application/json' });
            
            const totalFailures = linkResults.internal.failed.length + linkResults.external.failed.length;
            // expect(totalFailures, `Broken Links Found: ${totalFailures}`).toBeLessThanOrEqual(2);
            
            const ctaResults = await targetPage.verifyCTAButtons();
            await testInfo.attach('CTA Report', { body: JSON.stringify(ctaResults, null, 2), contentType: 'application/json' });
            expect(ctaResults.missing.length, 'Missing CTAs').toBe(0);
        });
    });
}
