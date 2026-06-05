# FamilieMad & Pligter

Første version af en lokal PWA til familien, hvor man kan:

- melde ind om man spiser med til aftensmad nogle dage frem
- få advarsel og log over manglende svar efter fristen dagen før
- aktivere bruger-notifikation kl. 17.30 hvis der mangler svar for næste dag
- registrere huslige pligter pr. person

## Lokal udvikling

```bash
npm install
npm run dev
```

## Validering

```bash
npm run lint
npm run build
```

## Lagring

Alle data gemmes lokalt i browserens `localStorage` på den enkelte enhed.

## Changelog og versioner

- `npm run build` genererer automatisk `public/changelog.json` ud fra de nyeste commits med dato/tidsstempel.
- Appen viser de 5 seneste versioner fra changelog.
- App-version sættes via `VITE_APP_VERSION` (fallback er build-tidspunkt) og bruges også til PWA-cache versionering.

## Google Sheets Sync

Appen understøtter tovejs-synkronisering med Google Sheets via Google Apps Script.  
Data synkroniseres automatisk hvert 2. minut og kan synkroniseres manuelt fra forsiden.  
**Den valgte aktive bruger gemmes kun lokalt på den enkelte enhed** og synkroniseres ikke.

### 1. Opret et Google Sheets-regneark

Opret et tomt Google Sheets-regneark. Kopiér regneark-ID'et fra URL'en:  
`https://docs.google.com/spreadsheets/d/**<SPREADSHEET_ID>**/edit`

Scriptet opretter automatisk de nødvendige faner: `MealPlan`, `DayOverrides`, `DateCreatedAt`, `ChoreLogs`, `LateLogs` og `Settings`.

### 2. Opret et Google Apps Script

1. Gå til [script.google.com](https://script.google.com) og opret et nyt projekt.
2. Erstat standardindholdet med koden nedenfor.
3. Sæt `PASSWORD` og `SPREADSHEET_ID` til dine egne værdier.
4. Klik **Deploy → New deployment**, vælg type **Web app**.
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
5. Kopiér den genererede URL (ender på `/exec`).

```javascript
const PASSWORD = 'dit-hemmelige-kodeord';
const SPREADSHEET_ID = 'dit-regneark-id';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.password !== PASSWORD) {
      return jsonResponse({ ok: false, error: 'Forkert adgangskode' });
    }
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (body.action === 'test') {
      return jsonResponse({ ok: true });
    }
    if (body.action === 'push') {
      writeData(ss, body.data || {});
      return jsonResponse({ ok: true });
    }
    if (body.action === 'pull') {
      return jsonResponse({ ok: true, data: readData(ss) });
    }
    return jsonResponse({ ok: false, error: 'Ukendt handling: ' + body.action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function writeData(ss, d) {
  writeSheet(ss, 'MealPlan',
    Object.entries(d.mealPlan || {}).map(([k, v]) => [k, JSON.stringify(v)]));
  writeSheet(ss, 'DayOverrides',
    Object.entries(d.dayOverrides || {}).map(([k, v]) => [k, JSON.stringify(v)]));
  writeSheet(ss, 'DateCreatedAt',
    Object.entries(d.dateCreatedAt || {}).map(([k, v]) => [k, v]));
  writeSheet(ss, 'ChoreLogs',
    (d.choreLogs || []).map(e => [e.id, e.person, e.task, e.notedAt]));
  writeSheet(ss, 'LateLogs',
    (d.lateLogs || []).map(e => [e.id, e.mealDate, e.person, e.loggedAt]));
  writeSheet(ss, 'Settings', [['data', JSON.stringify(d.settings || {})]]);
}

function readData(ss) {
  const mealPlan = {};
  readSheet(ss, 'MealPlan').forEach(([k, v]) => {
    try { mealPlan[k] = JSON.parse(v); } catch {}
  });
  const dayOverrides = {};
  readSheet(ss, 'DayOverrides').forEach(([k, v]) => {
    try { dayOverrides[k] = JSON.parse(v); } catch {}
  });
  const dateCreatedAt = {};
  readSheet(ss, 'DateCreatedAt').forEach(([k, v]) => { dateCreatedAt[k] = v; });
  const choreLogs = readSheet(ss, 'ChoreLogs')
    .map(([id, person, task, notedAt]) => ({ id, person, task, notedAt }));
  const lateLogs = readSheet(ss, 'LateLogs')
    .map(([id, mealDate, person, loggedAt]) => ({ id, mealDate, person, loggedAt }));
  let settings = {};
  const settingsRows = readSheet(ss, 'Settings');
  if (settingsRows.length > 0) {
    try { settings = JSON.parse(settingsRows[0][1]); } catch {}
  }
  return { mealPlan, dayOverrides, dateCreatedAt, choreLogs, lateLogs, settings };
}

function writeSheet(ss, name, rows) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clearContents();
  if (rows.length > 0)
    sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
}

function readSheet(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet || sheet.getLastRow() === 0) return [];
  return sheet.getDataRange().getValues();
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 3. Konfigurér appen

Gå til **Indstillinger → Google Sheets Sync** og udfyld:
- **Google Apps Script URL** — den URL du kopierede i trin 2.
- **Adgangskode** — det kodeord du satte i scriptet.

Klik **Test forbindelse** for at bekræfte opsætningen.



Workflowfilen `.github/workflows/deploy-pages.yml` deployer automatisk ved push til `main`.

Hvis du skal sætte mere op i GitHub:

1. Gå til **Settings → Pages**.
2. Under **Source**, vælg **GitHub Actions** (ikke "Deploy from a branch").
3. Gem ændringen og lav et nyt push til `main`.
