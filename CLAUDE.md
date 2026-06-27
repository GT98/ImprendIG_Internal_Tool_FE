# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # dev server at http://localhost:4200
npm run build      # production build → dist/
npm run watch      # incremental dev build (watch mode)
npm test           # unit tests via Vitest
npx prettier --write .   # format all files
```

There is no dedicated lint script; TypeScript strict mode enforces correctness at build time.

## Tech Stack

- **Angular 22** — standalone components, signals, `@angular/router` with lazy-loaded feature routes
- **TypeScript 6** — strict mode enabled (`noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`)
- **Tailwind CSS v4** — imported globally in `src/styles.css` via `@import 'tailwindcss'`; configured via `.postcssrc.json`
- **Vitest** — test runner, invoked through `@angular/build:unit-test` builder
- **Prettier** — 100-char print width, single quotes, `angular` parser for `.html` files

## Architecture

The app bootstraps from `src/main.ts` → `src/app/app.config.ts` (providers) → `src/app/app.ts` (root component).

Routes are defined in `src/app/app.routes.ts`. Feature areas should be lazy-loaded from here as the app grows.

Global styles live in `src/styles.css`; component-scoped styles go in files alongside their `.ts` file.
