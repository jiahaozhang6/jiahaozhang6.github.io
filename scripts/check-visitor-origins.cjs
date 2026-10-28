// Run with Playwright installed, or set PLAYWRIGHT_MODULE to its module directory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'visitor-origins.js'), 'utf8');
const boundary = 'return function draw(centerLongitude, centerLatitude, now) {';
assert(source.includes(boundary));
const observedSource = source.replace(boundary, boundary + '\nwindow.__globeDraws[logicalSize] = { lat: centerLatitude * 180 / Math.PI, lon: centerLongitude * 180 / Math.PI };');
const baseline = { visits: 500, countries: { CN: 183, TW: 5, US: 67, HK: 12, MO: 3 }, origin: 'TW' };
const cases = [
  { width: 1440, language: 'en', mode: 'healthy' },
  { width: 390, language: 'zh', mode: 'healthy', reduced: true },
  { width: 684, language: 'en', mode: 'delayed' },
  { width: 320, language: 'zh', mode: 'cached' },
  { width: 390, language: 'en', mode: 'outage' },
  { width: 390, language: 'en', mode: 'post-rejected' },
  { width: 390, language: 'zh', mode: 'invalid' },
  { width: 390, language: 'en', mode: 'empty' },
  { width: 390, language: 'en', mode: 'privacy' },
  { width: 390, language: 'en', mode: 'storage-blocked' }
];

(async () => {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const filename = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
    if (!filename.startsWith(root + path.sep)) return response.writeHead(403).end();
    try {
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.geojson': 'application/json' };
      response.setHeader('Content-Type', types[path.extname(filename)] || 'application/octet-stream');
      response.end(fs.readFileSync(filename));
    } catch (_) { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const test of cases) {
      const context = await browser.newContext({ viewport: { width: test.width, height: 900 }, isMobile: test.width < 600, hasTouch: test.width < 600, reducedMotion: test.reduced ? 'reduce' : 'no-preference' });
      await context.addInitScript(({ test, baseline }) => {
        localStorage.setItem('preferred-language', test.language);
        if (test.mode === 'cached') localStorage.setItem('jiahao-visitor-stats-v1', JSON.stringify(baseline));
        if (test.mode === 'privacy') Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' });
        if (test.mode === 'storage-blocked') {
          Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Blocked'); } });
          Object.defineProperty(window, 'localStorage', { get() { throw new Error('Blocked'); } });
        }
        window.__globeDraws = {};
        Object.defineProperty(performance, 'now', { value: () => 1000 });
        const frame = requestAnimationFrame.bind(window);
        window.requestAnimationFrame = callback => frame(() => callback(1000));
      }, { test, baseline });
      let recovery = false;
      let release;
      const gate = test.mode === 'delayed' ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
      const requests = [];
      const unexpected = [];
      const errors = [];
      await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.hostname === 'papers.jiahaozhang.me' && url.pathname === '/visitor-stats') {
          requests.push({ method: request.method(), key: request.headers()['x-visit-key'], query: url.search });
          await gate;
          if (test.mode === 'post-rejected' && !recovery && request.method() === 'POST') return route.fulfill({ status: 400, json: { error: 'Request body not supported' } });
          if (!recovery && ['outage', 'cached'].includes(test.mode)) return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
          if (!recovery && test.mode === 'invalid') return route.fulfill({ json: { visits: null, countries: {} } });
          return route.fulfill({ json: test.mode === 'empty' ? { visits: 0, countries: {}, origin: null } : { ...baseline, visits: recovery ? 501 : 500 } });
        }
        if (url.origin === origin && url.pathname === '/visitor-origins.js') return route.fulfill({ contentType: 'application/javascript', body: observedSource });
        if (url.origin === origin) return route.continue();
        unexpected.push(url.hostname);
        return route.abort();
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      await page.locator('#visitor-origins-toggle').click();
      await page.waitForFunction(() => window.__globeDraws[120]);
      if (test.mode === 'delayed') {
        assert.equal(await page.locator('.visitor-origins__empty').innerText(), 'Loading…');
        assert(Math.abs((await page.evaluate(() => window.__globeDraws[120])).lon - 104.2) < 0.001);
        release();
      }
      if (['outage', 'invalid'].includes(test.mode)) {
        await page.locator('#visitor-origins-retry:not([hidden]):not(:disabled)').waitFor();
        const text = await page.locator('.visitor-origins__empty').innerText();
        assert.match(text, test.language === 'zh' ? /暂时不可用/ : /temporarily unavailable/);
        assert(!text.includes('No country/region data yet.'));
        assert.equal(await page.locator('#visitor-total-count').innerText(), '—');
        recovery = true;
        await page.locator('#visitor-origins-retry').click();
      }
      if (test.mode === 'cached') {
        await page.locator('#visitor-origins-retry:not([hidden]):not(:disabled)').waitFor();
        assert.equal(await page.locator('#visitor-total-count').innerText(), '500');
        assert.match(await page.locator('#visitor-origins-scan').innerText(), /已保存/);
        recovery = true;
        await page.locator('#visitor-origins-retry').click();
      }
      const expectedTotal = test.mode === 'empty' ? '0' : recovery ? '501' : '500';
      await page.waitForFunction(total => document.getElementById('visitor-total-count').textContent === total && document.getElementById('visitor-origins-retry').hidden, expectedTotal);
      if (test.mode === 'empty') {
        assert.equal(await page.locator('#visitor-country-count').innerText(), '0');
        assert.equal(await page.locator('.visitor-origins__empty').innerText(), 'No country/region data yet.');
      } else {
        assert.equal(await page.locator('#visitor-country-count').innerText(), '4');
        const china = page.locator('.visitor-origins__item').filter({ has: page.locator('img[src$="/cn.svg"]') });
        assert.equal(await china.locator('.visitor-origins__number').innerText(), '188');
        assert.equal(await page.locator('img[src$="/tw.svg"]').count(), 0);
        assert.equal(await page.locator('.visitor-origins__flag[src$="/hk.svg"]').count(), 1);
        assert.equal(await page.locator('.visitor-origins__flag[src$="/mo.svg"]').count(), 1);
        if (test.mode === 'privacy') {
          assert(requests.every(request => request.query === '?locate=0'));
          assert.equal(await page.locator('.visitor-origins__you').count(), 0);
        } else {
          await page.waitForFunction(() => Math.abs(window.__globeDraws[120].lon - 121) < 0.001);
          assert.equal(await china.locator('.visitor-origins__name').innerText(), test.language === 'zh' ? '中国您' : 'ChinaYOU');
        }
      }
      const bounds = await page.locator('#visitor-origins-panel').boundingBox();
      assert(bounds.x >= 0 && bounds.x + bounds.width <= test.width + 1);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.waitForFunction(() => {
        const panel = document.getElementById('visitor-origins-panel').getBoundingClientRect();
        const pet = document.getElementById('shiba-pet').getBoundingClientRect();
        return pet.right <= panel.left || pet.left >= panel.right || pet.bottom <= panel.top || pet.top >= panel.bottom;
      });
      if (process.env.VISITOR_SCREENSHOT_DIR && test.mode === 'healthy') {
        await page.locator('#visitor-origins-panel').screenshot({ path: path.join(process.env.VISITOR_SCREENSHOT_DIR, 'visitors-' + test.width + '.png') });
      }
      if (!['empty', 'storage-blocked'].includes(test.mode)) {
        const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('jiahao-visitor-stats-v1')));
        assert.deepEqual(Object.keys(cache).sort(), ['countries', 'visits']);
        assert.equal(cache.countries.CN, 188);
        assert.equal(cache.countries.TW, undefined);
      }
      assert(requests.filter(request => request.method === 'POST').every(request => request.key === requests[0].key));
      if (test.mode === 'post-rejected') {
        assert(requests.some(request => request.method === 'GET'));
        assert.equal(await page.evaluate(() => sessionStorage.getItem('jiahao-visit-counted-v2')), null);
        recovery = true;
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
        await page.waitForFunction(() => document.getElementById('visitor-total-count').textContent === '501');
        assert.equal(await page.evaluate(() => sessionStorage.getItem('jiahao-visit-counted-v2')), '1');
        assert(requests.filter(request => request.method === 'POST').every(request => request.key === requests[0].key));
      }
      if (test.mode === 'healthy' && test.width === 390) {
        await page.locator('#language-toggle').click();
        assert.equal(await page.locator('.visitor-origins__item.is-current .visitor-origins__name').innerText(), 'ChinaYOU');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.getElementById('visitor-total-count').textContent === '500');
        assert.equal(requests.at(-1).method, 'GET');
      }
      assert.deepEqual(unexpected, []);
      assert.deepEqual(errors, []);
      console.log('PASS', JSON.stringify(test));
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
