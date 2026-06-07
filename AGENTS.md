# Agent Working Guide

## Goal
Hold ændringer små, testbare og fokuserede på én funktion ad gangen.

## Setup
```bash
npm install
```

## Run
```bash
npm run dev
```

## Validate before and after changes
```bash
npm run lint
npm run build
```

## Key files
- `src/App.tsx`: Hovedlogik for UI, state og forretningsregler.
- `src/main.tsx`: App bootstrap.
- `scripts/generate-changelog.mjs`: Build-time changelog generation.
- `scripts/google-sheets-sync.gs`: Google Apps Script til ekstern sync.
- `README.md`: Bruger- og opsætningsdokumentation.

## Change workflow (recommended)
1. Identificér berørte filer.
2. Lav mindst mulige ændring.
3. Kør lint + build.
4. Opdater README ved adfærds-/opsætningsændringer.
