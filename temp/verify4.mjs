// 校验「导出日历」按钮：点下去真的下载一个 .ics，内容结构对
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'

const BROWSER = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const URL = 'http://127.0.0.1:5173/'
const OUT = 'C:/Users/hha super jiaolong/AppData/Local/Temp/timetable-shots/'

const browser = await chromium.launch({ executablePath: BROWSER, headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 2400 }, deviceScaleFactor: 2, acceptDownloads: true })
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('.remind .btn').click(),
])
const path = OUT + 'export.ics'
await download.saveAs(path)

const text = readFileSync(path, 'utf8')
const lines = text.split(/\r?\n/).filter(Boolean)
const summary = {
  filename: download.suggestedFilename(),
  bytes: text.length,
  vevents: (text.match(/BEGIN:VEVENT/g) || []).length,
  valarms: (text.match(/BEGIN:VALARM/g) || []).length,
  rrules: (text.match(/RRULE:FREQ=WEEKLY/g) || []).length,
  hasLessons: text.includes('SUMMARY:程序设计基础'),
  hasAlarm12: text.includes('TRIGGER:-PT12H'),
  hasAlarm2: text.includes('TRIGGER:-PT2H'),
  endsOk: text.trimEnd().endsWith('END:VCALENDAR'),
  sampleLines: lines.slice(0, 8),
}
console.log(JSON.stringify(summary, null, 2))

// 顺便看眼页面底部
await page.locator('.remind').scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.screenshot({ path: OUT + 'remind.png' })
await browser.close()