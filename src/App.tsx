import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

const FAMILY_MEMBERS = ['Tommy', 'Tanja', 'Magnus', 'Robert', 'Sara'] as const
const STORAGE_KEY = 'family-meal-and-chores/v1'
const PLANNING_DAYS = 10
const APP_VERSION = __APP_VERSION__

type FamilyMember = (typeof FAMILY_MEMBERS)[number]
type AttendanceStatus = 'yes' | 'no' | 'pending'

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

type AppState = {
  mealPlan: MealPlan
  dateCreatedAt: Record<string, string>
  lateLogs: LateLogEntry[]
  choreLogs: ChoreLogEntry[]
}

const statusLabels: Record<AttendanceStatus, string> = {
  yes: 'Spiser med',
  no: 'Spiser ikke med',
  pending: 'Ikke meldt ind',
}

const statusChoices: AttendanceStatus[] = ['yes', 'no', 'pending']

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
      mealPlan[dateKey] = createEmptyDay()
      dateCreatedAt[dateKey] = now.toISOString()
      changed = true
      continue
    }

    let dayChanged = false
    const filledDay = { ...existingDay }

    for (const member of FAMILY_MEMBERS) {
      if (!filledDay[member]) {
        filledDay[member] = 'pending'
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
  const [selectedPerson, setSelectedPerson] = useState<FamilyMember>(FAMILY_MEMBERS[0])
  const [choreTask, setChoreTask] = useState('')
  const [releaseHistory, setReleaseHistory] = useState<ChangelogEntry[]>([])
  const [updateReady, setUpdateReady] = useState(false)
  const [applyUpdate, setApplyUpdate] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null)

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

  const totalYes = planningDates.reduce((count, dateKey) => {
    const day = state.mealPlan[dateKey]
    return count + FAMILY_MEMBERS.filter((member) => day?.[member] === 'yes').length
  }, 0)

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

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Familie-app · lokal første version</p>
          <h1>FamilieMad &amp; Pligter</h1>
          <p className="lead">
            Planlæg aftensmad nogle dage frem, få besked om manglende svar og registrer huslige
            pligter på samme enhed.
          </p>
        </div>
        <div className="hero-note">
          <strong>Data gemmes kun lokalt.</strong>
          <span>Perfekt til første test på én enhed før senere synkronisering.</span>
          <span>App-version: {APP_VERSION}</span>
          <button type="button" className="primary-button utility-button" onClick={reloadLatestVersion}>
            {updateReady ? 'Ny version klar · genindlæs' : 'Genindlæs appen'}
          </button>
        </div>
      </header>

      <section className="summary-grid" aria-label="Overblik">
        <article className="summary-card">
          <span className="summary-label">Planlagte dage</span>
          <strong>{planningDates.length}</strong>
          <span>Rullende overblik fra i dag og frem.</span>
        </article>
        <article className="summary-card">
          <span className="summary-label">Spiser med</span>
          <strong>{totalYes}</strong>
          <span>Bekræftede deltagere i den viste periode.</span>
        </article>
        <article className="summary-card warning">
          <span className="summary-label">Manglende svar efter frist</span>
          <strong>{pendingLateCount}</strong>
          <span>Der logges automatisk, når fristen er overskredet.</span>
        </article>
        <article className="summary-card">
          <span className="summary-label">Registrerede pligter</span>
          <strong>{state.choreLogs.length}</strong>
          <span>Alle pligter bliver liggende på denne enhed.</span>
        </article>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Aftensmad</h2>
            <p>Meld ind for hver person. Fristen er senest dagen før.</p>
          </div>
          <span className="chip">Opdateret {formatDateTime(currentTime.toISOString())}</span>
        </div>

        <div className="meal-grid">
          {planningDates.map((dateKey) => {
            const day = state.mealPlan[dateKey] ?? createEmptyDay()
            const lateMembers =
              lateWarnings.find((warning) => warning.dateKey === dateKey)?.pendingMembers ?? []

            return (
              <article className="meal-card" key={dateKey}>
                <div className="meal-card-header">
                  <div>
                    <h3>{formatDate(dateKey)}</h3>
                    <p>Frist: {formatDeadlineDate(dateKey)}</p>
                  </div>
                  {lateMembers.length > 0 ? (
                    <span className="status-pill danger">{lateMembers.length} for sent</span>
                  ) : (
                    <span className="status-pill ok">Åben / opdateret</span>
                  )}
                </div>

                <ul className="person-list">
                  {FAMILY_MEMBERS.map((member) => (
                    <li key={member} className="person-row">
                      <div>
                        <strong>{member}</strong>
                        <p>{statusLabels[day[member]]}</p>
                      </div>
                      <div className="choice-group" role="group" aria-label={`${member} ${dateKey}`}>
                        {statusChoices.map((status) => (
                          <button
                            key={status}
                            type="button"
                            className={`choice ${status} ${day[member] === status ? 'active' : ''}`}
                            onClick={() => updateAttendance(dateKey, member, status)}
                          >
                            {status === 'yes' ? 'Ja' : status === 'no' ? 'Nej' : 'Uafklaret'}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>

                {lateMembers.length > 0 && (
                  <div className="alert">
                    <strong>Advarsel:</strong> {lateMembers.join(', ')} mangler stadig at melde ind
                    i tide.
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Huslige pligter</h2>
              <p>Registrer når nogen har hjulpet.</p>
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

        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Log over for sene svar</h2>
              <p>Automatisk log over personer, der ikke meldte ind senest dagen før.</p>
            </div>
          </div>

          <div className="log-list">
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
      </div>
    </main>
  )
}

export default App
