// 校验「双休」与「小节标注」（strip 顺序 = 今天±5 天，按索引点）
import { chromium } from 'playwright-core'

const BROWSER = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const URL = 'http://127.0.0.1:5173/'
const OUT = 'C:/Users/hha super jiaolong/AppData/Local/Temp/timetable-shots/'

const browser = await chromium.launch({ executablePath: BROWSER, headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 1900 }, deviceScaleFactor: 2 })
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

async function snap(index, name, fullPage = false) {
  await page.locator('.strip button').nth(index).click()
  await page.waitForTimeout(350)
  await page.screenshot({ path: OUT + name + '.png', fullPage })
  const counts = await page.evaluate(() => ({
    slots: document.querySelectorAll('.slot').length,
    secs: [...document.querySelectorAll('.slot__sec')].map((e) => e.textContent.trim()),
    rest: document.querySelector('.rest')?.textContent.trim().slice(0, 10) || null,
    count: document.querySelector('.dayhead__count')?.textContent.trim(),
    title: document.querySelector('.dayhead__date')?.textContent.trim(),
  }))
  return { index, ...counts }
}

const out = []
out.push(await snap(8, 'sat'))       // 周六 10/31
out.push(await snap(9, 'sun'))       // 周日 11/1
out.push(await snap(3, 'mon'))       // 周一 10/26
out.push(await snap(7, 'fri', true)) // 周五 10/30 全页

console.log(JSON.stringify(out, null, 2))
await browser.close()