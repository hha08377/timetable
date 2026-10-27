// ============================================================
// App.jsx —— 课表版块（v0.3：真实课表已载入）
// 现在有的：5 大节 × 7 天、当天 ±5 天切换、点格子改课、点时间改作息、
//          数据存 localStorage、截断的地点上标「待补」
// 还没有的：作业倒计时、到点提醒（见 docs/立项卡.md）
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_PERIODS, SEED_COURSES, WEEKDAYS, placeIncomplete } from './data/timetable.js'
import { buildICS, downloadICS } from './ics.js'

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
  // 一个大节 = 两个小节：1 → 1-2 节，2 → 3-4 节 …（学校按小节排课）
  const sections = `${period.id * 2 - 1}-${period.id * 2} 节`
  return (
    <li className={'slot' + (state === 'now' ? ' slot--now' : '')}>
      <button className="slot__time" onClick={onEditTime} title="点击修改这一节的上课时间">
        <span className="slot__id">{period.id}</span>
        <span className="slot__sec">{sections}</span>
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

// ---------- 作业倒计时 ----------

const HW_KEY = 'kxb.homework.v1'

// 截止时间怎么显示：11/3 23:59
const formatDue = (iso) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
const toInputValue = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`

// 剩多久：不到 24 小时 → urgent（标红），过期 → late
const hwLeft = (due, nowMs) => {
  const ms = new Date(due).getTime() - nowMs
  const hours = ms / 3_600_000
  if (ms < 0) return { text: '已逾期', level: 'late' }
  if (hours < 1) return { text: `剩 ${Math.max(1, Math.round(hours * 60))} 分钟`, level: 'urgent' }
  if (hours < 24) return { text: `剩 ${Math.floor(hours)} 小时`, level: 'urgent' }
  const days = Math.floor(hours / 24)
  return { text: `剩 ${days} 天 ${Math.floor(hours - days * 24)} 小时`, level: 'ok' }
}

function HomeworkBoard({ items, courseNames, onToggle, onRemove, onAdd }) {
  return (
    <section className="hw" aria-label="作业倒计时">
      <header className="hw__head">
        <h2 className="hw__title">作业倒计时</h2>
        <button type="button" className="btn btn--primary btn--sm" onClick={onAdd}>
          + 加一项
        </button>
      </header>

      {items.length === 0 ? (
        <p className="hw__empty">
          还没有作业。点「+ 加一项」写上名字和截止时间，剩不到 24 小时会自己变红。
        </p>
      ) : (
        <ul className="hw__list">
          {items.map((h) => {
            const left = hwLeft(h.due, Date.now())
            return (
              <li
                key={h.id}
                className={`hwitem hwitem--${left.level}${h.done ? ' hwitem--done' : ''}`}
              >
                <button
                  type="button"
                  className="hwitem__check"
                  onClick={() => onToggle(h.id)}
                  aria-label={h.done ? '标记成没做完' : '标记成做完了'}
                >
                  {h.done ? '✓' : ''}
                </button>

                <div className="hwitem__main">
                  <p className="hwitem__title">{h.title}</p>
                  <p className="hwitem__meta">
                    {h.course && <span className="hwitem__course">{h.course}</span>}
                    <span>{formatDue(h.due)} 截止</span>
                  </p>
                </div>

                <span className={`hwitem__left hwitem__left--${left.level}`}>
                  {h.done ? '已完成' : left.text}
                </span>

                <button type="button" className="hwitem__del" onClick={() => onRemove(h.id)} aria-label="删除">
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function HomeworkEditor({ courseNames, onClose, onSave }) {
  const [title, setTitle] = useState('')
  const [course, setCourse] = useState('')
  // 默认给个「明天晚上 22:00」，省得每次都点日历
  const [due, setDue] = useState(() => {
    const d = addDays(new Date(), 1)
    d.setHours(22, 0, 0, 0)
    return toInputValue(d)
  })

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim() || !due) return
    onSave({ id: String(Date.now()), title: title.trim(), course: course.trim(), due, done: false })
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="sheet__head">
          <span className="sheet__when">新作业</span>
          <span className="sheet__time">截止时间</span>
        </header>

        <label className="field">
          <span>作业名字</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如 高数第 5 章习题 / 英语作文草稿"
            maxLength={40}
            autoFocus
          />
        </label>

        <label className="field">
          <span>哪门课（可空）</span>
          <select value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">不关联课程</option>
            {courseNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>截止到</span>
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} required />
        </label>

        <div className="sheet__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn btn--primary" disabled={!title.trim()}>
            加上
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
  const [homework, setHomework] = useState(() => readJSON(HW_KEY, [])) // [{ id, title, course, due, done }]
  const [addingHw, setAddingHw] = useState(false)
  const [, setTick] = useState(0) // 每分钟 +1，用来重算「现在第几节」和「作业还剩多久」

  const days = useMemo(() => buildDays(new Date()), [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(courses))
  }, [courses])

  useEffect(() => {
    window.localStorage.setItem(PERIODS_KEY, JSON.stringify(periods))
  }, [periods])

  useEffect(() => {
    window.localStorage.setItem(HW_KEY, JSON.stringify(homework))
  }, [homework])

  // 每 60 秒刷新一次时间，正在上的课会自动亮起来
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  const day = days.find((d) => d.key === selected) || days[SPAN]
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const isToday = dateKey(now) === day.key
  const isWeekend = day.weekday >= 6 // 6=周六、7=周日：双休，课表上没有课

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

  // 作业列表：没做完的排前面，同一组里按截止时间从早到晚
  const courseNames = useMemo(
    () => [...new Set(Object.values(courses).map((c) => c.name))].sort((a, b) => a.localeCompare(b, 'zh')),
    [courses]
  )
  const hwSorted = useMemo(
    () =>
      [...homework].sort(
        (a, b) => Number(a.done) - Number(b.done) || new Date(a.due).getTime() - new Date(b.due).getTime()
      ),
    [homework]
  )
  const hwOpen = homework.filter((h) => !h.done).length

  const resetToSeed = () => {
    if (!window.confirm('把课表恢复成从截图里导入的那 11 门课？当前的修改会丢掉。')) return
    setCourses(SEED_COURSES)
    setPeriods(DEFAULT_PERIODS)
  }

  // 导出 .ics：课程每周重复、每个事件课前 12h / 2h 各一个提醒
  const exportCalendar = () => {
    const ics = buildICS(courses, periods, homework)
    downloadICS('课表-作业提醒.ics', ics)
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="hero__eyebrow">timetable · v0.4</p>
        <h1 className="hero__title">
          课表<span className="hero__dot">·</span>作业提醒
        </h1>
        <p className="hero__lede">
          11 门课已导入：点格子改课，点左边时间改作息；下面能记作业，剩不到一天会自己变红。
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
            {isWeekend ? '双休' : `${filledOfDay}/${periods.length} 节有课`}
          </span>
        </div>

        {isWeekend ? (
          <div className="rest">
            <p className="rest__title">周末双休</p>
            <p className="rest__hint">课表上没有课，留给作业和睡觉。作业的截止时间在下面的「作业倒计时」里盯着。</p>
          </div>
        ) : (
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
        )}
      </section>

      {pendingRooms > 0 && (
        <p className="notice">
          有 {pendingRooms} 处地点在截图里被截断了（显示「待补」），点一下格子补上完整房号。
        </p>
      )}

      <HomeworkBoard
        items={hwSorted}
        courseNames={courseNames}
        onToggle={(id) =>
          setHomework((prev) => prev.map((h) => (h.id === id ? { ...h, done: !h.done } : h)))
        }
        onRemove={(id) => setHomework((prev) => prev.filter((h) => h.id !== id))}
        onAdd={() => setAddingHw(true)}
      />

      <section className="remind" aria-label="到点提醒">
        <h2 className="remind__title">到点提醒</h2>
        <p className="remind__hint">
          网页一关就不会响（浏览器不允许），所以提醒交给手机自带日历：导出这个文件导进去，
          每门课<b>课前 12 小时</b>和<b>课前 2 小时</b>各响一次，作业截止也一样。
        </p>
        <button type="button" className="btn btn--primary btn--sm" onClick={exportCalendar}>
          导出日历（.ics）
        </button>
      </section>

      <footer className="foot">
        <p className="foot__line">
          课表 + 作业倒计时 + 日历导出可用 · {hwOpen} 项作业没做完
        </p>
        <p className="foot__hint">
          共 {totalCourses} 门课，数据存在浏览器本地（localStorage）
          <button className="foot__link foot__link--inline" onClick={resetToSeed}>
            恢复成导入的课表
          </button>
        </p>
      </footer>

      {addingHw && (
        <HomeworkEditor
          courseNames={courseNames}
          onClose={() => setAddingHw(false)}
          onSave={(item) => {
            setHomework((prev) => [...prev, item])
            setAddingHw(false)
          }}
        />
      )}

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