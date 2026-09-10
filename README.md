# References Codex Vue

Migración completa del frontend de **References Generator** desde nodos Form.io de AXET FLOWS a una SPA construida con **Vue 3, TypeScript, Axios y Tailwind CSS**.

El backend de negocio se conserva: preparación de fuentes, oportunidades MANA, Codex, `SESSION_STATE.json`, parada, Excel, DOCX, PPTX, SharePoint, Microsoft Graph y monitorización siguen ejecutándose en los nodos Function/subflow existentes. La migración añade una capa HTTP que adapta las peticiones de Vue al contrato `msg.submission` que ya consumía el flujo.

## Contenido entregado

- SPA Vue completa con las pantallas de inicio, nueva ejecución, seguimiento, detalle final, logs, MANA y administración.
- `flows/flows-references-codex-vue-PARALLEL.json`: flujo completo con Vue y Form.io activos simultáneamente.
- `flows/flows-references-codex-vue-CUTOVER.json`: flujo completo con la SPA activa y los nodos de interfaz legacy deshabilitados.
- `flows/flows-references-codex-vue-added-nodes.json`: nodos nuevos para revisión técnica. No debe importarse solo, porque la migración también contiene rewires controlados sobre nodos existentes.
- `flows/migration-manifest.json`: inventario de rutas y estadísticas de ambas exportaciones.
- `flows/functions/`: código fuente de los adaptadores HTTP insertados en las exportaciones.
- `scripts/build-flow-migration.cjs`: regenerador reproducible de las exportaciones a partir del flujo original.
- `scripts/test-flow-functions.cjs`: pruebas de contratos, autorización, uploads, catálogo y sesiones.
- `scripts/typecheck-with-stubs.cjs`: type-check del frontend sin descargar dependencias, mediante declaraciones temporales controladas.
- `scripts/validate-frontend-syntax.cjs`: validación sintáctica de TypeScript y de los bloques `<script>` de los SFC Vue.
- `scripts/validate-project.cjs`: comprobación de código, grafo, rutas, SPA, conexiones y secretos.
- `scripts/validate-migration.cjs`: comparación profunda de las exportaciones generadas contra el flujo fuente.

## Arquitectura

```text
Navegador
  ├─ GET /_auth/user
  └─ ./api/* mediante Axios y cookies de sesión
          │
          ▼
HTTP In de FLOWS
          │
          ▼
Adaptadores [VUE MIGRATION]
  ├─ validación y autorización por usuario
  ├─ msg.payload HTTP -> msg.submission legacy
  ├─ respuesta HTTP 202 inmediata al iniciar
  └─ lectura de SESSION_STATE.json
          │
          ▼
Functions, subflows, Graph y generadores existentes
```

La aplicación utiliza:

```ts
base: './'
VITE_API_BASE_URL='./api/'
```

Las llamadas de negocio quedan relativas al punto de montaje del nodo SPA. La identidad se obtiene mediante la ruta de plataforma en el origen:

```text
/_auth/user
```

## Pantallas Vue

| Ruta hash | Función |
| --- | --- |
| `#/` | Bienvenida, usuario y recuperación de sesión activa |
| `#/new` | Formulario completo de fuentes y salida |
| `#/execution/:sessionId` | Progreso, fases, fuentes, log y parada |
| `#/results/:sessionId` | Éxito, error o parada; respuestas, métricas y entregables |
| `#/logs` | Sesiones autorizadas y visor de log |
| `#/mana` | Subir, comprobar, listar y eliminar documentos de oportunidad |
| `#/admin` | Acceso a capacidades administrativas disponibles |

## Desarrollo local

El contenedor de desarrollo usa Node.js 24.18.

```bash
cp .env.example .env
npm ci
npm run dev
```

Para trabajar contra una instancia de FLOWS:

```env
VITE_API_BASE_URL="./api/"
VITE_DEV_PROXY_TARGET="http://localhost:1880"
```

Vite mantiene las llamadas del navegador como `/api/*` en local y las reescribe hacia `/references-codex/api/*` en la instancia configurada.

## Docker

```bash
docker compose up --build
```

La aplicación de desarrollo queda publicada en `http://localhost:5173`.

## Build para `axet-spa-app`

```bash
npm ci
npm run build
```

El artefacto se genera en `dist/`. La exportación de FLOWS deja preparado el nodo SPA con:

```text
appId: references-codex
entryFile: index.html
gitBranch: main
gitInstallCmd: npm ci
gitBuildCmd: npm run build
gitOutputDir: dist
```

Solo queda informar `gitUrl` con la URL real del repositorio accesible desde FLOWS.

## Comprobaciones incluidas

```bash
npm run test:flow
npm run type-check:stubs
npm run validate:frontend
npm run validate:migration
npm run check:migration
npm run validate:flow-source -- "/ruta/al/flujo-fuente.json"
npm run type-check
npm run lint
npm run build
```

Las cinco primeras no necesitan levantar FLOWS ni instalar el árbol npm completo. `type-check`, `lint` y `build` requieren haber ejecutado correctamente `npm ci`.

## Despliegue

El procedimiento recomendado es:

1. Rotar la credencial que estaba embebida en la exportación original.
2. Configurar `AXET_CLIENT_ID`, `AXET_CLIENT_SECRET` y `AXET_SCOPE` como variables seguras del runtime.
3. Subir este proyecto a Git.
4. Importar primero la exportación `PARALLEL` como sustitución controlada del flujo actual.
5. Configurar `gitUrl` en el nodo `[VUE MIGRATION] References Codex Vue`.
6. Validar identidad, bootstrap, búsqueda, ejecución, parada, resultados y MANA.
7. Importar `CUTOVER` cuando Vue haya sido aceptado funcionalmente.

Consulta `FLOWS_DEPLOYMENT.md`, `MIGRATION.md` y `docs/API_CONTRACT.md` para el detalle completo.
