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

## GitHub Pages deploy (automatisk)

Workflowfilen `.github/workflows/deploy-pages.yml` deployer automatisk ved push til `main`.

Hvis du skal sætte mere op i GitHub:

1. Gå til **Settings → Pages**.
2. Under **Source**, vælg **GitHub Actions** (ikke "Deploy from a branch").
3. Gem ændringen og lav et nyt push til `main`.
