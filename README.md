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

## Projektstruktur (hurtigt overblik)

- `src/App.tsx` — primær UI- og domænelogik
- `src/main.tsx` — app bootstrap
- `scripts/generate-changelog.mjs` — genererer `public/changelog.json`
- `scripts/google-sheets-sync.gs` — Google Apps Script til Sheets sync
- `public/` — statiske filer (inkl. changelog output)

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
2. Erstat standardindholdet med koden fra:
   - `scripts/google-sheets-sync.gs`
3. Sæt `PASSWORD` og `SPREADSHEET_ID` til dine egne værdier.
4. Klik **Deploy → New deployment**, vælg type **Web app**.
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
5. Kopiér den genererede URL (ender på `/exec`).

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
