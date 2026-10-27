// ============================================================
// App.jsx —— 课表版块（v0.2）
// 现在有的：5 时段 × 7 天、当天 ±5 天切换、点格子加课、存 localStorage
// 还没有的：作业倒计时、到点提醒（见 docs/立项卡.md）
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react'

// 学校固定的 5 个时段（立项卡里的原话，别改）
const PERIODS = [
  { id: 1, start: '08:30', end: '10:10' },
  { id: 2, start: '10:30', end: '12:10' },
  { id: 3, start: '14:20', end: '16:00' },
  { id: 4, start: '16:20', end: '18:00' },
  { id: 5, start: '19:00', end: '20:35' },
]

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const STORAGE_KEY = 'kxb.courses.v1'
const SPAN = 5 // 当天前后各 5 天

// ---------- 一点日期小工具（Date 是新手最容易栽的地方，见 README） ----------

const pad2 = (n) => String(n).padStart(2, '0')
const dateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
// JS 里 getDay() 是 0=周日、1=周一……，换算成 1=周一、7=周日
const isoWeekday = (d) => ((d.getDay() + 6) % 7) + 1
// '08:30' → 510（分钟数），比较时间用分钟最省心
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function buildDays(today) {
  return Array.from({ length: SPAN * 2 + 1 }, (_, i) => {
    const d = addDays(today, i - SPAN)
    return {
      key: dateKey(d),
      date: d,
      weekday: isoWeekday(d),
      weekdayLabel: WEEKDAYS[isoWeekday(d) - 1],
      monthDay: `${d.getMonth() + 1}/${d.getDate()}`,
      isToday: i === SPAN,
    }
  })
}

// ---------- 存取 ----------

function loadCourses() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

// 存的格式：{ "2-1": { name: "高等数学", place: "教三 305" } }  键 = 星期几-第几节
const courseKey = (weekday, periodId) => `${weekday}-${periodId}`

// ---------- 组件 ----------

function DayStrip({ days, selected, onSelect }) {
  const stripRef = useRef(null)

  // 一进页面就把「今天」滚到正中间，不然手机上默认看到的是 5 天前
  useEffect(() => {
    const strip = stripRef.current
    const today = strip?.querySelector('.pill--today')
    if (!strip || !today) return
    // 等一帧再算，否则元素还没排版完，offsetLeft 是 0
    const raf = requestAnimationFrame(() => {
      strip.scrollLeft = today.offsetLeft - (strip.clientWidth - today.offsetWidth) / 2
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="strip" role="tablist" aria-label="选择日期" ref={stripRef}>
      {days.map((d) => (
        <button
          key={d.key}
          role="tab"
          aria-selected={d.key === selected}
          className={'pill' + (d.key === selected ? ' pill--on' : '') + (d.isToday ? ' pill--today' : '')}
          onClick={() => onSelect(d.key)}
        >
          <span className="pill__wd">{d.weekdayLabel.slice(1)}</span>
          <span className="pill__md">{d.monthDay}</span>
        </button>
      ))}
    </div>
  )
}

function PeriodRow({ period, course, state, onEdit }) {
  // state: 'past' | 'now' | 'future' —— 只用来做一点视觉暗示
  return (
    <li className={'slot' + (state === 'now' ? ' slot--now' : '')}>
      <div className="slot__time">
        <span className="slot__id">{period.id}</span>
        <span className="slot__hhmm">{period.start}</span>
        <span className="slot__hhmm slot__hhmm--dim">{period.end}</span>
      </div>
      <button className={'slot__body' + (course ? ' slot__body--filled' : '')} onClick={onEdit}>
        {course ? (
          <>
            <span className="slot__name">{course.name}</span>
            <span className="slot__place">{course.place || '未填地点'}</span>
          </>
        ) : (
          <span className="slot__empty">＋ 添加</span>
        )}
      </button>
    </li>
  )
}

function Editor({ target, course, onClose, onSave, onDelete }) {
  const [name, setName] = useState(course?.name || '')
  const [place, setPlace] = useState(course?.place || '')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onSave({ name: trimmed, place: place.trim() })
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="sheet__head">
          <span className="sheet__when">
            {WEEKDAYS[target.weekday - 1]} · 第 {target.period.id} 节
          </span>
          <span className="sheet__time">
            {target.period.start}–{target.period.end}
          </span>
        </header>

        <label className="field">
          <span>课程名</span>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如 高等数学"
            maxLength={20}
          />
        </label>

        <label className="field">
          <span>地点（可空）</span>
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="例如 教三 305"
            maxLength={20}
          />
        </label>

        <div className="sheet__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            取消
          </button>
          {course && (
            <button type="button" className="btn btn--danger" onClick={onDelete}>
              删除
            </button>
          )}
          <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
            保存
          </button>
        </div>
      </form>
    </div>
  )
}

// ---------- 主组件 ----------

export default function App() {
  const [courses, setCourses] = useState(loadCourses)
  const [selected, setSelected] = useState(() => dateKey(new Date()))
  const [editing, setEditing] = useState(null) // { weekday, period }
  const [tick, setTick] = useState(0) // 每分钟 +1，用来重算「现在第几节」

  const days = useMemo(() => buildDays(new Date()), [])

  // 存盘：courses 一变就写回 localStorage
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(courses))
  }, [courses])

  // 每 60 秒刷新一次时间，正在上的课会自动亮起来
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  const day = days.find((d) => d.key === selected) || days[SPAN]
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const isToday = dateKey(now) === day.key

  const slotState = (period) => {
    if (!isToday) return 'future'
    if (nowMinutes > toMinutes(period.end)) return 'past'
    if (nowMinutes >= toMinutes(period.start)) return 'now'
    return 'future'
  }

  const save = (payload) => {
    const key = courseKey(editing.weekday, editing.period.id)
    setCourses((prev) => ({ ...prev, [key]: payload }))
    setEditing(null)
  }

  const remove = () => {
    const key = courseKey(editing.weekday, editing.period.id)
    setCourses((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setEditing(null)
  }

  const filledOfDay = PERIODS.filter((p) => courses[courseKey(day.weekday, p.id)]).length
  const isEmpty = Object.keys(courses).length === 0

  const fillSample = () => {
    setCourses({
      '1-1': { name: '高等数学', place: '教三 305' },
      '1-2': { name: '英语听说', place: '语音室 2' },
      '2-1': { name: '程序设计基础', place: '机房 A' },
      '2-3': { name: '大学物理', place: '教二 108' },
      '3-2': { name: '线性代数', place: '教三 210' },
      '4-5': { name: '晚自习', place: '图书馆' },
    })
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="hero__eyebrow">timetable · v0.2</p>
        <h1 className="hero__title">
          课表<span className="hero__dot">·</span>作业提醒
        </h1>
        <p className="hero__lede">
          5 个时段，按周排；点空白格子加课，数据存在这台设备上。
        </p>
      </header>

      <section className="board">
        <DayStrip days={days} selected={selected} onSelect={setSelected} />

        <div className="dayhead">
          <span className="dayhead__date">
            {day.weekdayLabel} · {day.monthDay}
            {day.isToday && <em className="dayhead__now">今天</em>}
          </span>
          <span className="dayhead__count">
            {filledOfDay}/{PERIODS.length} 节有课
          </span>
        </div>

        <ol className="slots">
          {PERIODS.map((p) => (
            <PeriodRow
              key={p.id}
              period={p}
              course={courses[courseKey(day.weekday, p.id)]}
              state={slotState(p)}
              onEdit={() => setEditing({ weekday: day.weekday, period: p, existing: courses[courseKey(day.weekday, p.id)] })}
            />
          ))}
        </ol>
      </section>

      <section className="next" aria-label="还没做的两块">
        <p className="next__title">还没做</p>
        <ul className="next__list">
          <li>
            <span>作业倒计时</span>
            <em>剩 24h 标红 · 打勾移除</em>
          </li>
          <li>
            <span>到点提醒</span>
            <em>课前 12h / 2h（走系统日历）</em>
          </li>
        </ul>
      </section>

      <footer className="foot">
        <p className="foot__line">课表已可用 · 作业与提醒待接入</p>
        {isEmpty ? (
          <button className="foot__link" onClick={fillSample}>
            先填一份示例课表看看样子 →
          </button>
        ) : (
          <p className="foot__hint">改完刷新页面，数据还在（localStorage）</p>
        )}
      </footer>

      {editing && (
        <Editor
          target={editing}
          course={editing.existing}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={remove}
        />
      )}
    </main>
  )
}

