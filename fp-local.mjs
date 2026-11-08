import { chromium } from 'playwright-core';
import fs from 'fs';
const fpJS = fs.readFileSync('fp.js', 'utf8');
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await b.newContext()).newPage();
await page.goto('https://example.com/');
const fp = JSON.parse(await page.evaluate(fpJS));
try { await page.goto('https://tls.peet.ws/api/clean'); const t = JSON.parse(await page.evaluate(() => document.body.innerText)); fp.tls = { ja3_hash: t.ja3_hash, ja4: t.ja4, akamai_hash: t.akamai_fingerprint_hash, http_version: t.http_version }; } catch (e) { fp.tls = 'unavailable'; }
fs.writeFileSync('../out/fp-chrome-headless-local.json', JSON.stringify(fp, null, 1));
console.log(JSON.stringify(fp));
await b.close();
