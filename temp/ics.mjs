// ============================================================
// ics.js —— 把课表和作业倒计时导出成 .ics 日历文件
//
// 为什么是 .ics：浏览器不允许网页在关着的时候自己弹通知，
// 所以「课前 12h / 2h 提醒」交给手机自带日历去响 —— 系统闹钟最靠得住。
//
// 这里只做三件事：拼字符串、按行折行（RFC 5545 要求 75 字节折一次）、转义逗号分号。
// 不引任何依赖，因为需求就这么点。
// ============================================================

const pad2 = (n) => String(n).padStart(2, '0')

// Date → '20260831T082000'（浮动本地时间，手机按本地时区解读，跨设备最稳）
const stamp = (d) =>
  `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(
    d.getMinutes()
  )}00`

// UTC 时间戳（RRULE 的 UNTIL 必须是 UTC，末尾带 Z）
const stampUTC = (d) =>
  `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(
    d.getUTCHours()
  )}${pad2(d.getUTCMinutes())}00Z`

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

// RFC 5545 文本转义：反斜杠、分号、逗号要转，换行要写成 \n
const esc = (s) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')

// 每 75 个字节折一行（按 UTF-8 字节算，中文一个字 3 字节），续行以空格开头
function fold(line) {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const out = []
  let chunk = ''
  let len = 0
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length
    if (len + b > 75) {
      out.push(chunk)
      chunk = ' '
      len = 1
    }
    chunk += ch
    len += b
  }
  if (chunk) out.push(chunk)
  return out.join('\r\n')
}

const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const at = (day, hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(day)
  d.setHours(h, m, 0, 0)
  return d
}

/**
 * @param {object} courses  { '2-1': { name, place, color } }
 * @param {Array}  periods  [{ id, start, end }]
 * @param {Array}  homework [{ id, title, course, due, done }]
 * @param {object} opts     { termStart: Date, weeks: number, now: Date }
 */
export function buildICS(courses, periods, homework = [], opts = {}) {
  const now = opts.now || new Date()
  const termStart = opts.termStart || new Date('2026-08-31T00:00:00') // 第 1 周周一
  const weeks = opts.weeks || 18
  const lastDay = addDays(termStart, weeks * 7 - 1) // 第 18 周周日

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//timetable-react//课表作业提醒//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:课表 · 作业提醒',
    'X-WR-TIMEZONE:Asia/Shanghai',
  ]

  // ---- 课程：每周重复，课前 12h / 2h 各响一次 ----
  for (const [key, course] of Object.entries(courses)) {
    if (!course?.name) continue
    const [weekdayStr, periodStr] = key.split('-')
    const weekday = Number(weekdayStr) // 1=周一 … 7=周日
    const period = periods.find((p) => p.id === Number(periodStr))
    if (!period || weekday < 1 || weekday > 7) continue

    const first = addDays(termStart, weekday - 1)
    const start = at(first, period.start)
    const end = at(first, period.end)

    lines.push(
      'BEGIN:VEVENT',
      `UID:course-${key}-${stamp(now)}@timetable.local`,
      `DTSTAMP:${stampUTC(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[weekday - 1]};UNTIL=${stampUTC(addDays(lastDay, 1))}`,
      `SUMMARY:${esc(course.name)}`,
      course.place ? `LOCATION:${esc(course.place)}` : null,
      `DESCRIPTION:${esc(`第 ${period.id} 大节 ${period.start}-${period.end}`)}`,
      // VALARM 只能放在 VEVENT 里：提前 12 小时、提前 2 小时
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:-PT12H',
      `DESCRIPTION:${esc(`明天有课：${course.name}`)}`,
      'END:VALARM',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:-PT2H',
      `DESCRIPTION:${esc(`2 小时后上课：${course.name}`)}`,
      'END:VALARM',
      'END:VEVENT'
    )
  }

  // ---- 作业：到点前 12h / 2h 提醒，做完的不导出 ----
  for (const h of homework) {
    if (h.done || !h.due) continue
    const due = new Date(h.due)
    if (Number.isNaN(due.getTime())) continue
    lines.push(
      'BEGIN:VEVENT',
      `UID:hw-${h.id}-${stamp(now)}@timetable.local`,
      `DTSTAMP:${stampUTC(now)}`,
      `DTSTART:${stamp(due)}`,
      'DURATION:PT15M',
      `SUMMARY:${esc(`作业截止：${h.title}`)}`,
      h.course ? `DESCRIPTION:${esc(h.course)}` : null,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:-PT12H',
      `DESCRIPTION:${esc(`还有 12 小时：${h.title}`)}`,
      'END:VALARM',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:-PT2H',
      `DESCRIPTION:${esc(`还有 2 小时：${h.title}`)}`,
      'END:VALARM',
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')

  return lines
    .filter(Boolean)
    .map(fold)
    .join('\r\n') + '\r\n'
}

// 浏览器里下载：生成 Blob 再点一个隐形 <a>
export function downloadICS(filename, content) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 给浏览器一点时间把下载接住，再回收
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}