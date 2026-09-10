# References Codex

Production-ready Vue 3 starter application using TypeScript, Vite, Tailwind CSS, Pinia, Vue Router, Vue I18n, Axios, and Notyf.

## Requirements

- Node.js 24 or newer
- npm
- Docker or Podman with Compose support

## Getting started

Install dependencies:

```bash
npm install
```

Create a local environment file from the example:

```bash
cp .env.example .env
```

Start the development server:

```bash
npm run dev
```

The application is available at [http://localhost:5173](http://localhost:5173).

## Container development

The container uses `node:24.18-alpine`, binds Vite to `0.0.0.0`, mounts the source tree, and keeps dependencies in a named volume.

```bash
podman compose up --build
```

Docker Compose is also supported:

```bash
docker compose up --build
```


## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create a production build |
| `npm run preview` | Preview the production build |
| `npm run type-check` | Run `vue-tsc` without emitting files |
| `npm run lint` | Run ESLint and Oxlint |
| `npm run format` | Format files with Prettier |
| `npm run format:check` | Verify Prettier formatting |

## Environment variables

```env
VITE_API_BASE_URL=http://localhost:8000
```

The shared Axios client is available from `src/services/api.ts`. It exposes `createApi()` and `getApi()` and guarantees that only one Axios instance is created.

## Architecture

```text
src/
├── assets/              Global styles
├── components/          Reusable UI components
├── composable/          Reusable Composition API logic
├── i18n/                Vue I18n setup and locale files
├── router/              Vue Router configuration
├── services/            Shared Axios and Notyf services
├── stores/              Pinia stores, including persisted theme state
├── views/               Route-level components
├── App.vue              Router outlet only
└── main.ts              Application bootstrap
```

## Application behavior

- Vue Router uses HTML5 history mode with lazy-loaded route views.
- Route metadata updates the browser page title after navigation.
- The theme store toggles light/dark mode and persists the preference under `theme_mode` in local storage.
- Vue I18n uses Composition API mode and persists the selected locale under `locale` in local storage.
- Notyf is configured as a shared notification service.
- Tailwind CSS 4 is integrated through the Vite plugin, with PostCSS and Autoprefixer configured.
