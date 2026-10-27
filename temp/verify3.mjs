// 校验作业倒计时：加一项 → 出现 → 打勾 → 变灰；另注入逾期/已完成看样式
import { chromium } from 'playwright-core'

const BROWSER = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const URL = 'http://127.0.0.1:5173/'
const OUT = 'C:/Users/hha super jiaolong/AppData/Local/Temp/timetable-shots/'
const HW_KEY = 'kxb.homework.v1'

const browser = await chromium.launch({ executablePath: BROWSER, headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 2200 }, deviceScaleFactor: 2 })

// 先塞两条不同状态的作业，再走真实的新增流程
const now = Date.now()
const seeded = [
  { id: 'a1', title: '英语作文草稿（Unit 3）', course: '大学英语1', due: new Date(now + 5 * 3600e3).toISOString(), done: false },
  { id: 'a2', title: '线性代数习题 4.1', course: '', due: new Date(now - 3 * 3600e3).toISOString(), done: false },
  { id: 'a3', title: '程序设计基础第 3 周实验报告', course: '程序设计基础', due: new Date(now + 3 * 86400e3).toISOString(), done: true },
]
await page.addInitScript(
  ([key, value]) => window.localStorage.setItem(key, JSON.stringify(value)),
  [HW_KEY, seeded]
)
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

const before = await page.$$eval('.hwitem', (els) =>
  els.map((e) => ({
    title: e.querySelector('.hwitem__title').textContent.trim(),
    left: e.querySelector('.hwitem__left').textContent.trim(),
    cls: e.className,
  }))
)

// 走一遍真实的新增：点「+ 加一项」，写名字，选课程，改截止时间，保存
await page.locator('.hw__head .btn').click()
await page.waitForTimeout(250)
await page.locator('.sheet .field input').first().fill('高数第 5 章习题')
await page.locator('.sheet select').selectOption({ label: '高等数学(1)机电' })
const dueInput = page.locator('.sheet input[type="datetime-local"]')
await dueInput.fill('2026-11-05T22:00')
await page.locator('.sheet .btn--primary').click()
await page.waitForTimeout(400)

const after = await page.$$eval('.hwitem', (els) =>
  els.map((e) => ({
    title: e.querySelector('.hwitem__title').textContent.trim(),
    left: e.querySelector('.hwitem__left').textContent.trim(),
    cls: e.className,
  }))
)

// 打勾第一条（英语作文）
await page.locator('.hwitem__check').first().click()
await page.waitForTimeout(300)
const afterToggle = await page.$$eval('.hwitem', (els) =>
  els.map((e) => ({ title: e.querySelector('.hwitem__title').textContent.trim(), cls: e.className }))
)
const stored = await page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) || '[]'), HW_KEY)

console.log(JSON.stringify({ before, after, afterToggle, storedCount: stored.length, foot: await page.locator('.foot__line').textContent() }, null, 2))

await page.screenshot({ path: OUT + 'hw.png', fullPage: true })
await browser.close()