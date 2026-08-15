import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';

const server = spawn('node', ['scripts/serve-dist.mjs','--port','4183'], { cwd: process.cwd(), stdio: 'pipe' });
await new Promise(r => server.stdout.on('data', d => d.toString().includes('4183') && r()));
const browser = await chromium.launch({ headless: true, args: ['--enable-features=SharedArrayBuffer'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:4183', { waitUntil: 'networkidle' });
await page.waitForSelector('#app'); await page.waitForTimeout(2000);

// 打开 玩法教程 —— 应全屏 overlay + 占主显示宽卡片
await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.textContent||'').includes('玩法教程')); if(b) b.click(); });
await page.waitForTimeout(900);
const st = await page.evaluate(() => {
  const ov = document.getElementById('tutorial-overlay');
  const card = document.querySelector('.tut-card');
  if (!ov || !card) return { ok:false, why:'overlay or card missing' };
  const os = getComputedStyle(ov), cs = getComputedStyle(card);
  return { ok: os.position==='fixed' && os.top==='0px', overlayPos: os.position, cardW: cs.width, cardMaxH: cs.maxHeight, cardScroll: cs.overflowY };
});
console.log('overlay='+st.overlayPos+' card.width='+st.cardW+' maxH='+st.cardMaxH+' scroll='+st.cardScroll+' ok='+st.ok+(st.ok?'':' why='+st.why));

// 关闭应清空 overlay 容器
await page.click('.tut-close').catch(()=>{});
await page.waitForTimeout(300);
const residual = await page.evaluate(() => { const c = document.getElementById('tutorial-overlay'); return c ? c.innerHTML.length : -1; });
console.log('after-close residual='+residual+' (expect 0 or -1)');
console.log('errors='+errs.length);
await browser.close(); server.kill();