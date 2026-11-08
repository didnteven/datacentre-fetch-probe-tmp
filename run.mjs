// Throwaway datacentre probe: one request per route per URL, from a GitHub-hosted runner.
// Routes: plain curl, headless Chrome --dump-dom, and Playwright headless Chrome running saved extract() scripts.
import { spawnSync } from 'child_process';
import { chromium } from 'playwright-core';
import fs from 'fs';
import os from 'os';
import path from 'path';

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const CH = /just a moment|verify you are human|access denied|captcha|attention required|enable javascript|unusual traffic|are you a robot|pardon our interruption|checking your browser|request blocked|forbidden/i;
const visibleLen = (h) => h.replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;

function curlRoute(url) {
  const p = spawnSync('curl', ['-s', '-L', '-m', '20', '-A', UA, '-o', '-', '-w', '\n__HTTP__%{http_code}', url], { encoding: 'utf8', maxBuffer: 50e6, timeout: 30000 });
  const out = p.stdout || '';
  const i = out.lastIndexOf('\n__HTTP__');
  const body = out.slice(0, i), code = parseInt(out.slice(i + 9) || '0');
  const vl = visibleLen(body), ch = CH.test(body.slice(0, 3000)) && vl < 3000;
  return { http: code, visible: vl, challenge: ch, ok: code === 200 && vl >= 1000 && !ch };
}
function chromeRoute(url) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chr'));
  const p = spawnSync('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', `--user-data-dir=${dir}`, '--virtual-time-budget=8000', '--dump-dom', url], { encoding: 'utf8', maxBuffer: 80e6, timeout: 45000 });
  const html = p.stdout || '';
  const vl = visibleLen(html), ch = CH.test(html.slice(0, 3000)) && vl < 3000;
  return { visible: vl, challenge: ch, ok: vl >= 1000 && !ch };
}

const rows = [];
for (const c of data.coverage) {
  const row = { cat: c.cat, url: c.url, curl: curlRoute(c.url), chrome: chromeRoute(c.url) };
  rows.push(row);
  console.log(JSON.stringify({ url: c.url, curl: row.curl.ok, chrome: row.chrome.ok, curlHttp: row.curl.http, chromeVis: row.chrome.visible }));
}
fs.writeFileSync('results-coverage.json', JSON.stringify(rows, null, 1));

const captureJS = `(function(){ if (window.__cap) return; window.__cap = [];
  const push = (kind, url, status, ct, size, body) => { try { window.__cap.push({kind, url: String(url).slice(0,160), status, ct, size, body: (body && /json/i.test(ct||'') && body.length < 1500000) ? body : null}); } catch(e){} };
  const of = window.fetch;
  if (of) window.fetch = function(){ const a = arguments; return of.apply(this, a).then(r => { try { const c = r.clone(); c.text().then(t => push('fetch', (a[0] && a[0].url) || a[0], r.status, r.headers.get('content-type'), t.length, t)); } catch(e){} return r; }); };
  const oo = XMLHttpRequest.prototype.open, os = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m,u){ this.__u = u; return oo.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function(){ this.addEventListener('loadend', () => push('xhr', this.__u, this.status, this.getResponseHeader('content-type'), (this.responseText||'').length, this.responseText)); return os.apply(this, arguments); };
})();`;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const srows = [];
for (const s of data.scripts) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(captureJS);
  let row = { id: s.id };
  try {
    const resp = await page.goto(s.url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(6000);
    const title = await page.title();
    const res = await page.evaluate(`(function(){try{${s.code}\nconst out = extract(window); return JSON.stringify({ok:true,out:out});}catch(e){return JSON.stringify({ok:false,error:String(e&&e.message||e)});}})()`);
    const j = JSON.parse(res);
    row = { id: s.id, http: resp ? resp.status() : -1, title: title.slice(0, 50), ok: j.ok, n: j.ok ? j.out.length : 0, error: j.error };
  } catch (e) { row = { id: s.id, ok: false, error: String(e.message).slice(0, 100) }; }
  srows.push(row);
  console.log(JSON.stringify(row));
  await ctx.close();
}
await browser.close();
fs.writeFileSync('results-scripts.json', JSON.stringify(srows, null, 1));
