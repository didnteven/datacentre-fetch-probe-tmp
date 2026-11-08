// Same 8 pages and saved extract() scripts, in three engines: Chrome (system), Firefox and WebKit (Playwright builds).
// One load per engine per page. Headless. Usage: node engines.mjs <label>
import { chromium, firefox, webkit } from 'playwright-core';
import fs from 'fs';

const label = process.argv[2] || 'local';
const only = (process.env.ENGINES || 'chrome,firefox,webkit').split(',');
const fpJS = fs.readFileSync('fp.js', 'utf8');
const fps = {};
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const captureJS = `(function(){ if (window.__cap) return; window.__cap = [];
  const push = (kind, url, status, ct, size, body) => { try { window.__cap.push({kind, url: String(url).slice(0,160), status, ct, size, body: (body && /json/i.test(ct||'') && body.length < 1500000) ? body : null}); } catch(e){} };
  const of = window.fetch;
  if (of) window.fetch = function(){ const a = arguments; return of.apply(this, a).then(r => { try { const c = r.clone(); c.text().then(t => push('fetch', (a[0] && a[0].url) || a[0], r.status, r.headers.get('content-type'), t.length, t)); } catch(e){} return r; }); };
  const oo = XMLHttpRequest.prototype.open, os = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m,u){ this.__u = u; return oo.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function(){ this.addEventListener('loadend', () => push('xhr', this.__u, this.status, this.getResponseHeader('content-type'), (this.responseText||'').length, this.responseText)); return os.apply(this, arguments); };
})();`;
const engines = [
  ['chrome', () => chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })],
  ['firefox', () => firefox.launch({ headless: true })],
  ['webkit', () => webkit.launch({ headless: true })],
];
const rows = [];
for (const [name, launch] of engines) {
  if (!only.includes(name)) continue;
  let browser;
  try { browser = await launch(); } catch (e) { console.log(JSON.stringify({ engine: name, launchError: String(e.message).slice(0, 160) })); continue; }
  for (const s of data.scripts) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(captureJS);
    let row = { label, engine: name, id: s.id };
    try {
      const resp = await page.goto(s.url, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(6000);
      const title = await page.title();
      const res = await page.evaluate(`(function(){try{${s.code}\nconst out = extract(window); return JSON.stringify({ok:true,out:out});}catch(e){return JSON.stringify({ok:false,error:String(e&&e.message||e)});}})()`);
      const j = JSON.parse(res);
      row = { ...row, http: resp ? resp.status() : -1, title: title.slice(0, 40), ok: j.ok, n: j.ok ? j.out.length : 0, error: j.error ? j.error.slice(0, 80) : undefined };
    } catch (e) { row = { ...row, ok: false, error: String(e.message).split('\n')[0].slice(0, 90) }; }
    rows.push(row);
    console.log(JSON.stringify(row));
    await ctx.close();
  }
  // fingerprint + TLS/HTTP2 echo (one request each)
  try {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await page.goto('https://example.com/', { timeout: 20000 });
    const fp = JSON.parse(await page.evaluate(fpJS));
    try { await page.goto('https://tls.peet.ws/api/clean', { timeout: 20000 }); const t = JSON.parse(await page.evaluate(() => document.body.innerText));
      fp.tls = { ja3_hash: t.ja3_hash, ja4: t.ja4, akamai_hash: t.akamai_fingerprint_hash, http_version: t.http_version }; } catch (e) { fp.tls = 'unavailable'; }
    fps[name] = fp; console.log(JSON.stringify({ engine: name, fingerprint: fp }));
    await ctx.close();
  } catch (e) { fps[name] = { error: String(e.message).slice(0, 100) }; }
  await browser.close();
}
fs.writeFileSync(`results-engines-${label}.json`, JSON.stringify({ rows, fps }, null, 1));
