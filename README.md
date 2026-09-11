# References Codex — Vue + AXET FLOWS

Frontend Vue 3 para el caso de uso References. Esta variante es el **cutover final**: el frontend antiguo Form.io y `axetflows-app` no forman parte del flow de despliegue.

## Arquitectura

```text
Browser
  -> axet-spa-app (Git, build Vite, Okta FLOWS)
       -> Vue hash router
       -> ./api/*
          -> HTTP In / Function adapters / HTTP Response
             -> backend de negocio existente de References
             -> SharePoint / NoSQL / Codex
             -> /internal-storage-files/files
```

El usuario se obtiene primero mediante `/_auth/user`. Si esa respuesta de plataforma viene vacía, Vue utiliza la identidad autenticada que `GET ./api/bootstrap` obtiene de `msg.__axetFlowsSecurityContext`.

## Configuración del nodo SPA

- `appId`: `references-codex`
- `mode`: `http`
- `gitUrl`: `https://github.com/Ivanalmarza/References_codex.git`
- `gitBranch`: `main`
- `gitSubdir`: vacío
- `gitInstallCmd`: `npm ci --include=dev`
- `gitBuildCmd`: `npm run build`
- `gitOutputDir`: `dist`
- `entryFile`: `index.html`
- `authType`: `okta`
- `customOkta`: `false`

## Datos persistentes esperados

El frontend no se copia manualmente a internal storage: lo clona y compila `axet-spa-app`. El backend sigue siendo el flow. Internal storage conserva datos, cachés y artefactos:

```text
/internal-storage-files/files/PLAN.md
/internal-storage-files/files/references.json
/internal-storage-files/files/opportunities_index.json
/internal-storage-files/files/opportunities_filters.json
/internal-storage-files/files/plantillas/
/internal-storage-files/files/procesado/
/internal-storage-files/files/codex-workspace/
/internal-storage-files/files/_active-sessions/
/internal-storage-files/files/_vue-uploads/
/internal-storage-files/files/_vue-session-owners/
/internal-storage-files/files/pptxFiles/
/internal-storage-files/files/docxFiles/
/internal-storage-files/files/excelFiles/
```

## Variables privadas del runtime FLOWS

Nunca deben estar en Git ni en el bundle del navegador:

```text
AXET_CLIENT_ID
AXET_CLIENT_SECRET
AXET_SCOPE
SF_USERNAME
SF_PASSWORD
SF_SECURITY_TOKEN
```

Las tres variables Salesforce solo son necesarias para la acción administrativa que refresca MANA desde ese origen.

## API principal

Todas las llamadas del navegador usan `./api/`, que bajo el `appId` se resuelve a `/references-codex/api/...`. La API cubre bootstrap, búsqueda paginada de oportunidades, uploads temporales, ejecuciones, stop/release, progreso/resultados/logs, generación Excel/plantilla, SharePoint, MANA, administración de Internal Files y CRUD de usuarios Okta/NoSQL. Las pantallas administrativas conservan el acceso ROLE_PUBLIC del menú anterior: las rutas exigen identidad autenticada de FLOWS, pero no añaden una restricción ROLE_ADMIN nueva.

## Build local

```bash
npm ci
npm run build
```

Vite usa `base: './'` y Vue Router usa hash history para que el SPA funcione bajo la ruta montada por `axet-spa-app` sin depender de history fallback del servidor.

## Ajuste obligatorio al importar en un proyecto FLOWS nuevo

Los cuatro nodos `use-case` conservan su `usecaseid`, pero el `projectid` se entrega vacío a propósito para no apuntar accidentalmente al proyecto antiguo. Tras importar, selecciona el proyecto nuevo en esos nodos y despliega.
