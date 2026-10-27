// ============================================================
// App.jsx —— 课表版块（v0.3：真实课表已载入）
// 现在有的：5 大节 × 7 天、当天 ±5 天切换、点格子改课、点时间改作息、
//          数据存 localStorage、截断的地点上标「待补」
// 还没有的：作业倒计时、到点提醒（见 docs/立项卡.md）
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_PERIODS, SEED_COURSES, WEEKDAYS, placeIncomplete } from './data/timetable.js'

const STORAGE_KEY = 'kxb.courses.v1'
const PERIODS_KEY = 'kxb.periods.v1'
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

const readJSON = (key, fallback) => {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

// 存的格式：{ "2-1": { name, place, color } }  键 = 星期几-大节号
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

function PeriodRow({ period, course, state, onEditCourse, onEditTime }) {
  // state: 'past' | 'now' | 'future' —— 只用来做一点视觉暗示
  const incomplete = course && placeIncomplete(course.place)
  return (
    <li className={'slot' + (state === 'now' ? ' slot--now' : '')}>
      <button className="slot__time" onClick={onEditTime} title="点击修改这一节的上课时间">
        <span className="slot__id">{period.id}</span>
        <span className="slot__hhmm">{period.start}</span>
        <span className="slot__hhmm slot__hhmm--dim">{period.end}</span>
      </button>
      <button
        className={'slot__body' + (course ? ` slot__body--filled ${course.color || 'c1'}` : '')}
        onClick={onEditCourse}
      >
        {course ? (
          <>
            <span className="slot__name">{course.name}</span>
            <span className="slot__place">
              {course.place || '未填地点'}
              {incomplete && <em className="slot__badge">待补</em>}
            </span>
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
            maxLength={24}
          />
        </label>

        <label className="field">
          <span>地点（可空）</span>
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="例如 弘远楼B0412"
            maxLength={24}
          />
        </label>

        {placeIncomplete(course?.place) && (
          <p className="sheet__tip">这间教室在原课表里被截断了，补上完整房号再保存。</p>
        )}

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

function TimeEditor({ period, onClose, onSave }) {
  const [start, setStart] = useState(period.start)
  const [end, setEnd] = useState(period.end)
  const submit = (e) => {
    e.preventDefault()
    onSave({ ...period, start, end })
  }
  return (
    <div className="overlay" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="sheet__head">
          <span className="sheet__when">第 {period.id} 大节</span>
          <span className="sheet__time">上课时间</span>
        </header>
        <div className="field field--row">
          <label className="field field--half">
            <span>开始</span>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field field--half">
            <span>结束</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <div className="sheet__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn btn--primary">
            保存
          </button>
        </div>
      </form>
    </div>
  )
}

// ---------- 主组件 ----------

export default function App() {
  // 第一次打开就用「导入的真实课表」当初始值；之后以本地存的为准
  const [courses, setCourses] = useState(() => readJSON(STORAGE_KEY, SEED_COURSES))
  const [periods, setPeriods] = useState(() => readJSON(PERIODS_KEY, DEFAULT_PERIODS))
  const [selected, setSelected] = useState(() => dateKey(new Date()))
  const [editing, setEditing] = useState(null) // { weekday, period, existing }
  const [editingTime, setEditingTime] = useState(null) // period
  const [, setTick] = useState(0) // 每分钟 +1，用来重算「现在第几节」

  const days = useMemo(() => buildDays(new Date()), [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(courses))
  }, [courses])

  useEffect(() => {
    window.localStorage.setItem(PERIODS_KEY, JSON.stringify(periods))
  }, [periods])

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
    const color = editing.existing?.color || 'c1'
    setCourses((prev) => ({ ...prev, [key]: { ...payload, color } }))
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

  const filledOfDay = periods.filter((p) => courses[courseKey(day.weekday, p.id)]).length
  const totalCourses = Object.keys(courses).length
  const pendingRooms = Object.values(courses).filter((c) => placeIncomplete(c.place)).length

  const resetToSeed = () => {
    if (!window.confirm('把课表恢复成从截图里导入的那 11 门课？当前的修改会丢掉。')) return
    setCourses(SEED_COURSES)
    setPeriods(DEFAULT_PERIODS)
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="hero__eyebrow">timetable · v0.3</p>
        <h1 className="hero__title">
          课表<span className="hero__dot">·</span>作业提醒
        </h1>
        <p className="hero__lede">
          你的 11 门课已经导进来了：点格子改课，点左边时间改作息，都存在这台设备上。
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
            {filledOfDay}/{periods.length} 节有课
          </span>
        </div>

        <ol className="slots">
          {periods.map((p) => (
            <PeriodRow
              key={p.id}
              period={p}
              course={courses[courseKey(day.weekday, p.id)]}
              state={slotState(p)}
              onEditCourse={() =>
                setEditing({ weekday: day.weekday, period: p, existing: courses[courseKey(day.weekday, p.id)] })
              }
              onEditTime={() => setEditingTime(p)}
            />
          ))}
        </ol>
      </section>

      {pendingRooms > 0 && (
        <p className="notice">
          有 {pendingRooms} 处地点在截图里被截断了（显示「待补」），点一下格子补上完整房号。
        </p>
      )}

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
        <p className="foot__hint">
          共 {totalCourses} 门课，数据存在浏览器本地（localStorage）
          <button className="foot__link foot__link--inline" onClick={resetToSeed}>
            恢复成导入的课表
          </button>
        </p>
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

      {editingTime && (
        <TimeEditor
          period={editingTime}
          onClose={() => setEditingTime(null)}
          onSave={(next) => {
            setPeriods((prev) => prev.map((p) => (p.id === next.id ? next : p)))
            setEditingTime(null)
          }}
        />
      )}
    </main>
  )
}