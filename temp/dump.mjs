import { chromium } from 'playwright-core'
const BROWSER = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const browser = await chromium.launch({ executablePath: BROWSER, headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 1900 }, deviceScaleFactor: 2 })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const texts = await page.$$eval('.strip button', (els) =>
  els.map((e) => ({ text: e.textContent.trim(), cls: e.className }))
)
console.log(JSON.stringify(texts, null, 1))
await browser.close()