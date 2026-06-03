import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const OUTPUT_PATH = resolve(process.cwd(), 'public/changelog.json')
const MAX_ENTRIES = 20

function getGitLogEntries() {
  try {
    const raw = execSync(
      `git log -n ${MAX_ENTRIES} --date=iso-strict --pretty=format:%H%x1f%h%x1f%aI%x1f%s%x1e`,
      { encoding: 'utf8' },
    )

    return raw
      .split('\x1e')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [commit, version, timestamp, message] = line.split('\x1f')
        return { commit, version, timestamp, message }
      })
  } catch {
    return []
  }
}

const entries = getGitLogEntries()
const payload = {
  generatedAt: new Date().toISOString(),
  entries,
}

mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

console.log(`Wrote ${entries.length} changelog entries to ${OUTPUT_PATH}`)
