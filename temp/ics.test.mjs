// 验证 ics 生成：结构、VEVENT 数、折行字节数、转义
import { buildICS } from './ics.mjs'
import { SEED_COURSES, DEFAULT_PERIODS } from './timetable.mjs'

const ics = buildICS(
  SEED_COURSES,
  DEFAULT_PERIODS,
  [
    { id: 'x1', title: '高数第5章, 习题', course: '高等数学(1)机电', due: '2026-11-05T22:00', done: false },
    { id: 'x2', title: '已经做完的作业', course: '', due: '2026-11-01T10:00', done: true },
  ],
  { termStart: new Date('2026-08-31T00:00:00'), now: new Date('2026-10-28T01:00:00') }
)

const lines = ics.split('\r\n').filter(Boolean)
const enc = new TextEncoder()
console.log(ics)
console.error(
  JSON.stringify(
    {
      vevents: (ics.match(/BEGIN:VEVENT/g) || []).length,
      valarms: (ics.match(/BEGIN:VALARM/g) || []).length,
      maxLineBytes: Math.max(...lines.map((l) => enc.encode(l).length)),
      longLines: lines.filter((l) => enc.encode(l).length > 75).length,
      commaEscaped: ics.includes('高数第5章\\, 习题'),
      doneSkipped: !ics.includes('已经做完的作业'),
      endsOk: ics.trimEnd().endsWith('END:VCALENDAR'),
    },
    null,
    2
  )
)