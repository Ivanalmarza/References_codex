# Despliegue en AXET FLOWS

## 1. Elegir la exportación

### `PARALLEL`

`flows/flows-references-codex-vue-PARALLEL.json` contiene el flujo original y la migración Vue. Los 13 formularios Form.io y sus acciones permanecen activos, por lo que permite comparar ambos frontends y volver al original sin otra importación.

### `CUTOVER`

`flows/flows-references-codex-vue-CUTOVER.json` contiene el mismo backend, pero marca como deshabilitados:

- 13 nodos `axetflows-form`;
- 29 nodos `axetflows-view-action`;
- el nodo `axetflows-app` legacy.

La SPA y las 17 rutas HTTP permanecen activas.

**No importes `flows-references-codex-vue-added-nodes.json` como solución autónoma.** Ese fichero sirve para revisar los nodos añadidos; el flujo completo incluye además conexiones modificadas en puntos de entrada y salida del backend actual.

## 2. Copia de seguridad

Antes de importar:

1. Exporta el flujo desplegado actualmente.
2. Guarda el JSON y anota la revisión de Git o fecha de despliegue.
3. Evita importar el flujo completo como una segunda copia paralela dentro del mismo proyecto. Debe utilizarse como reemplazo/versionado del flujo existente para no duplicar IDs, endpoints ni ejecuciones.

## 3. Seguridad obligatoria

La exportación original contenía una credencial de aplicación dentro del Function `env settings`. Las nuevas exportaciones eliminan el valor y lo obtienen del entorno:

```text
AXET_CLIENT_ID
AXET_CLIENT_SECRET
AXET_SCOPE
```

Acciones necesarias:

1. Revocar o rotar la credencial expuesta en la exportación anterior.
2. Guardar el nuevo secreto en la configuración segura del runtime de FLOWS.
3. No introducirlo en Vue, Git, `.env` del navegador ni otro Function.

`AXET_SCOPE` dispone del mismo fallback de scope que utilizaba el flujo, pero conviene declararlo de forma explícita en cada entorno.

## 4. Subir el proyecto Vue a Git

Desde el repositorio:

```bash
npm ci
npm run check:migration
npm run build
git add .
git commit -m "Migrate References Generator frontend to Vue"
git push origin main
```

La URL de clonación debe ser accesible desde el runtime que ejecuta el nodo SPA.

## 5. Importar `PARALLEL`

Importa:

```text
flows/flows-references-codex-vue-PARALLEL.json
```

La exportación instala como dependencia global:

```text
axet-flows-contrib-nodes-axet-ui-spa: 1.0.1
```

Revisa que el módulo esté disponible y que los nodos no aparezcan como desconocidos antes de desplegar.

## 6. Configurar el nodo SPA

Abre `[VUE MIGRATION] References Codex Vue` y configura:

```text
appId: references-codex
appName: References Codex
mode: http
entryFile: index.html
gitUrl: <URL_REAL_DEL_REPOSITORIO>
gitBranch: main
gitInstallCmd: npm ci
gitBuildCmd: npm run build
gitOutputDir: dist
authType: none
accessControl: auto
sessionExpireTimeInMinutes: 90
```

`authType: none` no significa que las APIs de negocio sean anónimas. La sesión la gestiona la plataforma y cada Function HTTP vuelve a resolver el usuario desde `msg.__axetFlowsSecurityContext` o `msg.req.user`.

## 7. Desplegar y ejecutar pruebas de humo

### Infraestructura

1. Abrir la SPA correspondiente al `appId` `references-codex`.
2. Confirmar que carga el usuario desde `/_auth/user`.
3. Consultar `GET /references-codex/api/health` y comprobar HTTP 200.
4. Consultar el bootstrap y confirmar plantillas, proyectos procesados y sectores.

### Nueva ejecución

1. Probar solo proyecto procesado.
2. Probar solo oportunidad MANA.
3. Probar solo archivos propios.
4. Probar una combinación de fuentes.
5. Confirmar que `POST /executions` devuelve HTTP 202 con `sessionId`.
6. Confirmar que la ejecución continúa aunque se cierre o recargue la pestaña.
7. Confirmar que el progreso se recupera desde `SESSION_STATE.json`.
8. Probar la parada y verificar que no se lanzan más batches.

### Resultados

1. Verificar que una ejecución correcta abre el detalle final.
2. Generar Excel.
3. Generar DOCX o PPTX según la plantilla.
4. Publicar en SharePoint.
5. Forzar o recuperar una sesión detenida/error y confirmar que el detalle se puede consultar, pero los entregables quedan deshabilitados si no hay éxito.

### MANA

1. Seleccionar una oportunidad mediante filtros.
2. Subir un documento.
3. Comprobar PDF/CSV.
4. Listar documentos.
5. Eliminar un documento seleccionado.

## 8. Pasar a `CUTOVER`

Cuando las pruebas funcionales sean correctas, importa como nueva revisión:

```text
flows/flows-references-codex-vue-CUTOVER.json
```

Comprueba que la SPA sigue habilitada y que los nodos legacy aparecen deshabilitados, no eliminados. Esto conserva una reversión rápida y permite comparar la configuración histórica.

## 9. Rollback

Hay dos opciones:

- Reimportar `PARALLEL` para volver a habilitar Form.io sin retirar Vue.
- Reimportar la copia de seguridad previa a la migración para volver exactamente al estado anterior.

Las carpetas de sesiones y los artefactos existentes no se borran al cambiar entre ambas exportaciones.
