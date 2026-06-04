import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

const FAMILY_MEMBERS = ['Tommy', 'Tanja', 'Magnus', 'Robert', 'Sara'] as const
const STORAGE_KEY = 'family-meal-and-chores/v1'
const PLANNING_DAYS = 10

type FamilyMember = (typeof FAMILY_MEMBERS)[number]
type AttendanceStatus = 'yes' | 'no' | 'pending'
type WeekParity = 'even' | 'odd'
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

type MealPlan = Record<string, Record<FamilyMember, AttendanceStatus>>

type LateLogEntry = {
  id: string
  mealDate: string
  person: FamilyMember
  loggedAt: string
}

type ChoreLogEntry = {
  id: string
  person: FamilyMember
  task: string
  notedAt: string
}

type ChangelogEntry = {
  commit: string
  version: string
  timestamp: string
  message: string
}

type ActiveTab = 'meals' | 'chores' | 'settings'

type PartTimeSchedule = {
  even: Record<number, AttendanceStatus>
  odd: Record<number, AttendanceStatus>
}

type UserSchedule =
  | { type: 'fulltime' }
  | { type: 'parttime'; schedule: PartTimeSchedule }

type KitchenClosedRule = {
  dayOfWeek: DayOfWeek
  parity: 'always' | WeekParity
}

type AppSettings = {
  userSchedules: Partial<Record<FamilyMember, UserSchedule>>
  kitchenClosed: KitchenClosedRule[]
}

type AppState = {
  mealPlan: MealPlan
  dateCreatedAt: Record<string, string>
  lateLogs: LateLogEntry[]
  choreLogs: ChoreLogEntry[]
  settings: AppSettings
}

const statusLabels: Record<AttendanceStatus, string> = {
  yes: 'Spiser med',
  no: 'Spiser ikke med',
  pending: 'Ikke meldt ind',
}

const statusChoices: AttendanceStatus[] = ['yes', 'no', 'pending']

const DAY_NAMES: Record<number, string> = {
  0: 'Søndag',
  1: 'Mandag',
  2: 'Tirsdag',
  3: 'Onsdag',
  4: 'Torsdag',
  5: 'Fredag',
  6: 'Lørdag',
}

const WEEK_DAYS_ORDER: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0]

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat('da-DK', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${dateKey}T12:00:00`))
}

function formatDateTime(dateValue: string) {
  return new Intl.DateTimeFormat('da-DK', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateValue))
}

function formatDeadlineDate(dateKey: string) {
  return formatDate(toDateKey(addDays(new Date(`${dateKey}T12:00:00`), -1)))
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getWeekParity(date: Date): WeekParity {
  return getISOWeekNumber(date) % 2 === 0 ? 'even' : 'odd'
}

function isKitchenClosed(dateKey: string, rules: KitchenClosedRule[]): boolean {
  const date = new Date(`${dateKey}T12:00:00`)
  const dow = date.getDay() as DayOfWeek
  const parity = getWeekParity(date)
  return rules.some(
    (rule) => rule.dayOfWeek === dow && (rule.parity === 'always' || rule.parity === parity),
  )
}

function getDefaultStatus(member: FamilyMember, dateKey: string, settings: AppSettings): AttendanceStatus {
  if (isKitchenClosed(dateKey, settings.kitchenClosed)) {
    return 'no'
  }
  const schedule = settings.userSchedules[member]
  if (!schedule || schedule.type === 'fulltime') {
    return 'yes'
  }
  const date = new Date(`${dateKey}T12:00:00`)
  const parity = getWeekParity(date)
  const dow = date.getDay()
  return schedule.schedule[parity][dow] ?? 'pending'
}

function createDefaultPartTimeSchedule(): PartTimeSchedule {
  const allPending = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, 'pending' as AttendanceStatus]))
  return { even: { ...allPending }, odd: { ...allPending } }
}

function createDefaultSettings(): AppSettings {
  return { userSchedules: {}, kitchenClosed: [] }
}

function createDayForDate(dateKey: string, settings: AppSettings): Record<FamilyMember, AttendanceStatus> {
  return Object.fromEntries(
    FAMILY_MEMBERS.map((member) => [member, getDefaultStatus(member, dateKey, settings)]),
  ) as Record<FamilyMember, AttendanceStatus>
}

function createEmptyDay() {
  return Object.fromEntries(
    FAMILY_MEMBERS.map((member) => [member, 'pending']),
  ) as Record<FamilyMember, AttendanceStatus>
}

function getDeadline(dateKey: string) {
  const deadline = new Date(`${dateKey}T12:00:00`)
  deadline.setDate(deadline.getDate() - 1)
  deadline.setHours(23, 59, 59, 999)
  return deadline
}

function buildPlanningDates(now: Date) {
  return Array.from({ length: PLANNING_DAYS }, (_, offset) => toDateKey(addDays(now, offset)))
}

function ensurePlanningDates(state: AppState, now: Date) {
  let changed = false
  const mealPlan = { ...state.mealPlan }
  const dateCreatedAt = { ...state.dateCreatedAt }

  for (const dateKey of buildPlanningDates(now)) {
    const existingDay = mealPlan[dateKey]

    if (!existingDay) {
      mealPlan[dateKey] = createDayForDate(dateKey, state.settings)
      dateCreatedAt[dateKey] = now.toISOString()
      changed = true
      continue
    }

    let dayChanged = false
    const filledDay = { ...existingDay }

    for (const member of FAMILY_MEMBERS) {
      if (!filledDay[member]) {
        filledDay[member] = getDefaultStatus(member, dateKey, state.settings)
        dayChanged = true
      }
    }

    if (dayChanged) {
      mealPlan[dateKey] = filledDay
      changed = true
    }

    if (!dateCreatedAt[dateKey]) {
      dateCreatedAt[dateKey] = now.toISOString()
      changed = true
    }
  }

  if (!changed) {
    return state
  }

  return { ...state, mealPlan, dateCreatedAt }
}

function appendLateLogs(state: AppState, now: Date) {
  const lateLogIds = new Set(state.lateLogs.map((entry) => entry.id))
  const additions: LateLogEntry[] = []

  for (const [dateKey, day] of Object.entries(state.mealPlan)) {
    const deadline = getDeadline(dateKey)
    const createdAt = state.dateCreatedAt[dateKey]

    if (!createdAt || new Date(createdAt) >= deadline || now <= deadline) {
      continue
    }

    for (const member of FAMILY_MEMBERS) {
      if (day[member] !== 'pending') {
        continue
      }

      const id = `${dateKey}:${member}`

      if (lateLogIds.has(id)) {
        continue
      }

      lateLogIds.add(id)
      additions.push({
        id,
        mealDate: dateKey,
        person: member,
        loggedAt: now.toISOString(),
      })
    }
  }

  if (additions.length === 0) {
    return state
  }

  return {
    ...state,
    lateLogs: [...additions, ...state.lateLogs],
  }
}

function reconcileState(state: AppState, now: Date) {
  return appendLateLogs(ensurePlanningDates(state, now), now)
}

function createInitialState(now: Date): AppState {
  return reconcileState(
    {
      mealPlan: {},
      dateCreatedAt: {},
      lateLogs: [],
      choreLogs: [],
      settings: createDefaultSettings(),
    },
    now,
  )
}

function loadState() {
  const now = new Date()

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return createInitialState(now)
    }

    const parsed = JSON.parse(raw) as Partial<AppState>

    return reconcileState(
      {
        mealPlan: parsed.mealPlan ?? {},
        dateCreatedAt: parsed.dateCreatedAt ?? {},
        lateLogs: parsed.lateLogs ?? [],
        choreLogs: parsed.choreLogs ?? [],
        settings: parsed.settings ?? createDefaultSettings(),
      },
      now,
    )
  } catch {
    return createInitialState(now)
  }
}

function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [activeTab, setActiveTab] = useState<ActiveTab>('meals')
  const [selectedMember, setSelectedMember] = useState<FamilyMember>(FAMILY_MEMBERS[0])
  const [selectedPerson, setSelectedPerson] = useState<FamilyMember>(FAMILY_MEMBERS[0])
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [choreTask, setChoreTask] = useState('')
  const [releaseHistory, setReleaseHistory] = useState<ChangelogEntry[]>([])
  const [updateReady, setUpdateReady] = useState(false)
  const [applyUpdate, setApplyUpdate] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null)
  const [newKitchenDow, setNewKitchenDow] = useState<DayOfWeek>(5)
  const [newKitchenParity, setNewKitchenParity] = useState<'always' | WeekParity>('odd')

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    let active = true

    async function loadChangelog() {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}changelog.json`, {
          cache: 'no-store',
        })

        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as { entries?: ChangelogEntry[] }

        if (active) {
          setReleaseHistory((payload.entries ?? []).slice(0, 5))
        }
      } catch {
        if (active) {
          setReleaseHistory([])
        }
      }
    }

    loadChangelog()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    function onUpdateAvailable(event: Event) {
      const updateEvent = event as CustomEvent<((reloadPage?: boolean) => Promise<void>) | undefined>
      setUpdateReady(true)
      setApplyUpdate(() => updateEvent.detail ?? null)
    }

    window.addEventListener('pwa:update-available', onUpdateAvailable)
    return () => window.removeEventListener('pwa:update-available', onUpdateAvailable)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date()
      setCurrentTime(now)
      setState((previous) => reconcileState(previous, now))
    }, 60_000)

    return () => window.clearInterval(timer)
  }, [])

  const planningDates = useMemo(() => buildPlanningDates(currentTime), [currentTime])

  const activeExpandedDay = planningDates.includes(expandedDay ?? '') ? expandedDay : planningDates[0] ?? null

  const lateWarnings = useMemo(
    () =>
      planningDates.map((dateKey) => {
        const pendingMembers = FAMILY_MEMBERS.filter((member) => {
          const day = state.mealPlan[dateKey]
          const createdAt = state.dateCreatedAt[dateKey]

          if (!day || !createdAt) {
            return false
          }

          return day[member] === 'pending' && new Date(createdAt) < getDeadline(dateKey) && currentTime > getDeadline(dateKey)
        })

        return { dateKey, pendingMembers }
      }),
    [currentTime, planningDates, state.dateCreatedAt, state.mealPlan],
  )

  const pendingLateCount = lateWarnings.reduce((count, day) => count + day.pendingMembers.length, 0)

  const choreSummary = FAMILY_MEMBERS.map((member) => ({
    member,
    count: state.choreLogs.filter((entry) => entry.person === member).length,
  }))

  const recentLateLogs = [...state.lateLogs]
    .sort((left, right) => right.loggedAt.localeCompare(left.loggedAt))
    .slice(0, 8)

  const recentChoreLogs = [...state.choreLogs]
    .sort((left, right) => right.notedAt.localeCompare(left.notedAt))
    .slice(0, 8)

  function updateAttendance(dateKey: string, person: FamilyMember, status: AttendanceStatus) {
    setState((previous) =>
      reconcileState(
        {
          ...previous,
          mealPlan: {
            ...previous.mealPlan,
            [dateKey]: {
              ...(previous.mealPlan[dateKey] ?? createEmptyDay()),
              [person]: status,
            },
          },
        },
        new Date(),
      ),
    )
  }

  function addChoreLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedTask = choreTask.trim()

    if (!trimmedTask) {
      return
    }

    const nextEntry: ChoreLogEntry = {
      id: `${Date.now()}-${selectedPerson}`,
      person: selectedPerson,
      task: trimmedTask,
      notedAt: new Date().toISOString(),
    }

    setState((previous) => ({
      ...previous,
      choreLogs: [nextEntry, ...previous.choreLogs],
    }))
    setChoreTask('')
  }

  function reloadLatestVersion() {
    if (applyUpdate) {
      void applyUpdate(true)
      return
    }

    window.location.reload()
  }

  function updateSettings(updater: (prev: AppSettings) => AppSettings) {
    setState((prev) => reconcileState({ ...prev, settings: updater(prev.settings) }, new Date()))
  }

  function setUserScheduleType(member: FamilyMember, type: 'fulltime' | 'parttime') {
    updateSettings((prev) => {
      const existing = prev.userSchedules[member]
      const schedule: UserSchedule =
        type === 'fulltime'
          ? { type: 'fulltime' }
          : {
              type: 'parttime',
              schedule: existing?.type === 'parttime' ? existing.schedule : createDefaultPartTimeSchedule(),
            }
      return { ...prev, userSchedules: { ...prev.userSchedules, [member]: schedule } }
    })
  }

  function setPartTimeDay(member: FamilyMember, parity: WeekParity, dow: number, status: AttendanceStatus) {
    updateSettings((prev) => {
      const existing = prev.userSchedules[member]
      if (existing?.type !== 'parttime') return prev
      return {
        ...prev,
        userSchedules: {
          ...prev.userSchedules,
          [member]: {
            ...existing,
            schedule: {
              ...existing.schedule,
              [parity]: { ...existing.schedule[parity], [dow]: status },
            },
          },
        },
      }
    })
  }

  function addKitchenClosedRule() {
    updateSettings((prev) => {
      const exists = prev.kitchenClosed.some((r) => r.dayOfWeek === newKitchenDow && r.parity === newKitchenParity)
      if (exists) return prev
      return { ...prev, kitchenClosed: [...prev.kitchenClosed, { dayOfWeek: newKitchenDow, parity: newKitchenParity }] }
    })
  }

  function removeKitchenClosedRule(index: number) {
    updateSettings((prev) => ({
      ...prev,
      kitchenClosed: prev.kitchenClosed.filter((_, i) => i !== index),
    }))
  }

  const parityLabel: Record<'always' | WeekParity, string> = {
    always: 'Altid',
    even: 'Lige uger',
    odd: 'Ulige uger',
  }

  return (
    <div className="app-shell">
      <header className="slim-header">
        <span className="active-user-label">
          Aktiv bruger: <strong>{selectedMember}</strong>
        </span>
        {updateReady && (
          <button type="button" className="update-badge" onClick={reloadLatestVersion}>
            Opdatering klar
          </button>
        )}
      </header>

      <div className="content-layout">
        <nav className="tab-bar" aria-label="Hovedfaner">
          <button
            type="button"
            className={`tab-button ${activeTab === 'meals' ? 'active' : ''}`}
            onClick={() => setActiveTab('meals')}
          >
            Aftensmad
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'chores' ? 'active' : ''}`}
            onClick={() => setActiveTab('chores')}
          >
            Pligter
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Indstillinger
          </button>
        </nav>

        <div className="main-content">
          {activeTab === 'meals' && (
            <>
              <section className="summary-grid" aria-label="Overblik">
                <article className="summary-card warning">
                  <span className="summary-label">Manglende svar efter frist</span>
                  <strong>{pendingLateCount}</strong>
                  <span>Der logges automatisk, når fristen er overskredet.</span>
                </article>
              </section>

              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Aftensmad</h2>
                    <p>Tryk på en dag for detaljer. Kun {selectedMember} kan meldes ind herfra.</p>
                  </div>
                  <span className="chip">Opdateret {formatDateTime(currentTime.toISOString())}</span>
                </div>

                <div className="meal-grid">
                  {planningDates.map((dateKey) => {
                    const day = state.mealPlan[dateKey] ?? createEmptyDay()
                    const lateMembers =
                      lateWarnings.find((warning) => warning.dateKey === dateKey)?.pendingMembers ?? []
                    const yesMembers = FAMILY_MEMBERS.filter((member) => day[member] === 'yes')
                    const noMembers = FAMILY_MEMBERS.filter((member) => day[member] === 'no')
                    const pendingMembers = FAMILY_MEMBERS.filter((member) => day[member] === 'pending')
                    const isExpanded = activeExpandedDay === dateKey
                    const kitchenClosed = isKitchenClosed(dateKey, state.settings.kitchenClosed)

                    return (
                      <article className={`meal-card${kitchenClosed ? ' kitchen-closed' : ''}`} key={dateKey}>
                        <button
                          type="button"
                          className="meal-summary-button"
                          onClick={() => setExpandedDay(isExpanded ? null : dateKey)}
                          aria-expanded={isExpanded}
                        >
                          <div className="meal-card-header">
                            <div>
                              <h3>{formatDate(dateKey)}</h3>
                              <p>Frist: {formatDeadlineDate(dateKey)}</p>
                            </div>
                            {lateMembers.length > 0 ? (
                              <span className="status-pill danger">{lateMembers.length} for sent</span>
                            ) : (
                              <span className="status-pill ok">Klar</span>
                            )}
                          </div>

                          <div className="compact-status">
                            <p>
                              <strong>Ja:</strong> {yesMembers.join(', ') || 'Ingen endnu'}
                            </p>
                            <p>
                              <strong>Nej:</strong> {noMembers.join(', ') || 'Ingen endnu'}
                            </p>
                            <p>
                              <strong>Afventer:</strong> {pendingMembers.join(', ') || 'Ingen'}
                            </p>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="meal-editor">
                            <p>
                              <strong>{selectedMember}</strong> · {statusLabels[day[selectedMember]]}
                            </p>
                            <div className="choice-group" role="group" aria-label={`${selectedMember} ${dateKey}`}>
                              {statusChoices.map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  className={`choice ${status} ${day[selectedMember] === status ? 'active' : ''}`}
                                  onClick={() => updateAttendance(dateKey, selectedMember, status)}
                                >
                                  {status === 'yes' ? 'Ja' : status === 'no' ? 'Nej' : 'Uafklaret'}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>
            </>
          )}

          {activeTab === 'chores' && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Huslige pligter</h2>
                  <p>
                    Registrer når nogen har hjulpet.{' '}
                    <strong>{state.choreLogs.length}</strong> registreret i alt.
                  </p>
                </div>
              </div>

              <form className="chore-form" onSubmit={addChoreLog}>
                <label>
                  Person
                  <select
                    value={selectedPerson}
                    onChange={(event) => setSelectedPerson(event.target.value as FamilyMember)}
                  >
                    {FAMILY_MEMBERS.map((member) => (
                      <option key={member} value={member}>
                        {member}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="task-field">
                  Hvad blev der hjulpet med?
                  <input
                    type="text"
                    value={choreTask}
                    onChange={(event) => setChoreTask(event.target.value)}
                    placeholder="Fx dækkede bord, tømte opvasker eller gik med skrald"
                  />
                </label>
                <button type="submit" className="primary-button">
                  Gem pligt
                </button>
              </form>

              <div className="mini-stats">
                {choreSummary.map(({ member, count }) => (
                  <article key={member} className="mini-stat">
                    <strong>{member}</strong>
                    <span>{count} registreringer</span>
                  </article>
                ))}
              </div>

              <div className="log-list">
                <h3>Seneste pligter</h3>
                {recentChoreLogs.length === 0 ? (
                  <p className="empty-state">Ingen pligter registreret endnu.</p>
                ) : (
                  <ul>
                    {recentChoreLogs.map((entry) => (
                      <li key={entry.id}>
                        <strong>{entry.person}</strong> · {entry.task}
                        <span>{formatDateTime(entry.notedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {activeTab === 'settings' && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Indstillinger</h2>
                  <p>Aktiv bruger, madplan-standarder og lukkedage.</p>
                </div>
              </div>

              <div className="settings-grid">
                <label>
                  Aktiv bruger til aftensmad
                  <select
                    value={selectedMember}
                    onChange={(event) => setSelectedMember(event.target.value as FamilyMember)}
                  >
                    {FAMILY_MEMBERS.map((member) => (
                      <option key={member} value={member}>
                        {member}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="primary-button utility-button"
                  onClick={reloadLatestVersion}
                >
                  {updateReady ? 'Ny version klar · genindlæs' : 'Genindlæs appen'}
                </button>
              </div>

              <div className="settings-section">
                <h3>Brugeres madplan-standard</h3>
                <p className="settings-hint">
                  Fuld tid: spiser altid med som udgangspunkt. Deltid: vælg standard for hver ugedag og ligeuger/uligeuger.
                </p>
                {FAMILY_MEMBERS.map((member) => {
                  const schedule = state.settings.userSchedules[member] ?? { type: 'fulltime' as const }
                  return (
                    <div key={member} className="user-schedule-card">
                      <div className="user-schedule-header">
                        <strong>{member}</strong>
                        <div className="radio-group">
                          <label>
                            <input
                              type="radio"
                              name={`schedule-${member}`}
                              checked={schedule.type === 'fulltime'}
                              onChange={() => setUserScheduleType(member, 'fulltime')}
                            />
                            Fuld tid
                          </label>
                          <label>
                            <input
                              type="radio"
                              name={`schedule-${member}`}
                              checked={schedule.type === 'parttime'}
                              onChange={() => setUserScheduleType(member, 'parttime')}
                            />
                            Deltid
                          </label>
                        </div>
                      </div>

                      {schedule.type === 'parttime' && (
                        <div className="parttime-schedule">
                          <table className="schedule-table">
                            <thead>
                              <tr>
                                <th>Dag</th>
                                <th>Lige uger</th>
                                <th>Ulige uger</th>
                              </tr>
                            </thead>
                            <tbody>
                              {WEEK_DAYS_ORDER.map((dow) => (
                                <tr key={dow}>
                                  <td>{DAY_NAMES[dow]}</td>
                                  <td>
                                    <select
                                      value={schedule.schedule.even[dow] ?? 'pending'}
                                      onChange={(e) =>
                                        setPartTimeDay(member, 'even', dow, e.target.value as AttendanceStatus)
                                      }
                                    >
                                      <option value="yes">Spiser med</option>
                                      <option value="no">Spiser ikke</option>
                                      <option value="pending">Uafklaret</option>
                                    </select>
                                  </td>
                                  <td>
                                    <select
                                      value={schedule.schedule.odd[dow] ?? 'pending'}
                                      onChange={(e) =>
                                        setPartTimeDay(member, 'odd', dow, e.target.value as AttendanceStatus)
                                      }
                                    >
                                      <option value="yes">Spiser med</option>
                                      <option value="no">Spiser ikke</option>
                                      <option value="pending">Uafklaret</option>
                                    </select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="settings-section">
                <h3>Køkken lukket</h3>
                <p className="settings-hint">
                  Angiv dage hvor køkkenet er lukket. Disse dage sættes automatisk til &ldquo;Spiser ikke&rdquo; for alle.
                </p>

                {state.settings.kitchenClosed.length > 0 && (
                  <ul className="kitchen-rules-list">
                    {state.settings.kitchenClosed.map((rule, index) => (
                      <li key={index} className="kitchen-rule">
                        <span>
                          {DAY_NAMES[rule.dayOfWeek]} · {parityLabel[rule.parity]}
                        </span>
                        <button
                          type="button"
                          className="remove-button"
                          onClick={() => removeKitchenClosedRule(index)}
                        >
                          Fjern
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="add-kitchen-rule">
                  <label>
                    Ugedag
                    <select
                      value={newKitchenDow}
                      onChange={(e) => setNewKitchenDow(Number(e.target.value) as DayOfWeek)}
                    >
                      {WEEK_DAYS_ORDER.map((dow) => (
                        <option key={dow} value={dow}>
                          {DAY_NAMES[dow]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Hyppighed
                    <select
                      value={newKitchenParity}
                      onChange={(e) => setNewKitchenParity(e.target.value as 'always' | WeekParity)}
                    >
                      <option value="always">Altid</option>
                      <option value="even">Lige uger</option>
                      <option value="odd">Ulige uger</option>
                    </select>
                  </label>
                  <button type="button" className="primary-button" onClick={addKitchenClosedRule}>
                    Tilføj lukkedag
                  </button>
                </div>
              </div>

              <div className="log-list">
                <h3>Historik · sene svar</h3>
                {recentLateLogs.length === 0 ? (
                  <p className="empty-state">Ingen sene svar registreret endnu.</p>
                ) : (
                  <ul>
                    {recentLateLogs.map((entry) => (
                      <li key={entry.id}>
                        <strong>{entry.person}</strong> meldte ikke ind til {formatDate(entry.mealDate)}
                        <span>Logget {formatDateTime(entry.loggedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="log-list">
                <h3>Versionshistorik (seneste 5)</h3>
                {releaseHistory.length === 0 ? (
                  <p className="empty-state">Ingen changelog-data fundet endnu.</p>
                ) : (
                  <ul>
                    {releaseHistory.map((entry) => (
                      <li key={entry.commit}>
                        <strong>{entry.version}</strong> · {entry.message}
                        <span>{formatDateTime(entry.timestamp)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
