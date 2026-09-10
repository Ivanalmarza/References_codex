# Diseño de la migración Form.io → Vue

## Inventario del frontend original

La exportación analizada contiene:

- 13 nodos `axetflows-form`;
- 29 nodos `axetflows-view-action`;
- 1 nodo `axetflows-app`;
- 0 rutas `http in` antes de la migración.

Los formularios cubrían bienvenida, routing de entrada, recuperación de sesión, ejecución detenida, arranque, progreso, logs, resultado, administración MANA, selector de eliminación y acciones finales.

## Mapa de pantallas

| Form.io / comportamiento original | Vue |
| --- | --- |
| Welcome Codex WorkSpace Agent | Dashboard `#/` |
| Entry Router + Session Choice | Bootstrap y sesión activa en Dashboard |
| Codex Code Generator v3 | Nueva ejecución `#/new` |
| Codex Starting + Progress Monitor + Front progreso | Seguimiento `#/execution/:sessionId` |
| Execution Stopped | Estado detenido dentro de seguimiento/detalle final |
| Codex Final Result Actions | Detalle final `#/results/:sessionId` |
| Log Viewer | Logs `#/logs` |
| Subir/comprobar/eliminar documentos | MANA `#/mana` |
| Resultado PDF/CSV y selector de borrado | Resultado integrado dentro de MANA |
| Menú administrativo | Administración `#/admin` |

No se replican redirecciones internas de Form.io. Vue Router agrupa esas pantallas y decide la vista a partir del estado real de la sesión.

## Principio de compatibilidad

La migración no sustituye la lógica de negocio. El adaptador de inicio reconstruye el contrato esperado por `Extract Security Context`:

```js
msg.msgid = sessionId
msg.sessionId = sessionId
msg.submission = {
  includeProcessed,
  includeOpportunity,
  includeUploads,
  unidadProcesado,
  proyectoProcesado,
  opportunitySelectionMode,
  businessOpportunityIdSearch,
  sector,
  unidadOportunidad,
  cliente,
  opportunityId,
  uploadFiles,
  idioma,
  plantilla,
  sector_outputformat,
  instruccionEspecifica,
  extract: true
}
msg.onInitSubmission = { ...msg.submission, sessionId, projectPath }
```

Después entra en el mismo recorrido que utilizaba el formulario:

```text
Finalize active execution
  → subflow Ejecución (1)
  → Extract Security Context
  → preparación/fusión de fuentes
  → Codex detached
  → SESSION_STATE.json
  → reportes y generadores existentes
```

## Inicio asíncrono

`POST /executions` no mantiene abierta la petición durante el proceso Codex:

1. Valida usuario, fuentes, proyecto, oportunidad, uploads y plantilla.
2. Crea un `sessionId` de 32 caracteres hexadecimales.
3. Escribe un `SESSION_STATE.json` inicial con estado `queued`.
4. Registra el propietario de la sesión.
5. Devuelve HTTP 202 inmediatamente.
6. En una segunda salida, sin `req` ni `res`, llama al nodo existente que detiene/limpia la sesión anterior.
7. El subflujo existente registra la nueva sesión activa y continúa en background.

Este orden evita que el finalizador confunda la nueva sesión con la anterior.

## Persistencia y seguimiento

La ejecución larga ya persistía el estado de forma atómica en:

```text
/internal-storage-files/files/codex-workspace/<sessionId>/codex-docs/SESSION_STATE.json
```

Vue consulta ese estado periódicamente. La API diferencia:

- `ready`: resultado correcto confirmado;
- `failed`: error terminal;
- `stopped`: parada manual;
- `terminal`: cualquiera de los estados finales;
- `canStop`: sesión aún no terminal.

Las sesiones detenidas o con error se pueden inspeccionar. Las acciones de generación solo se habilitan con éxito y `respuestas.json` disponible.

## Oportunidades

El índice puede contener decenas de miles de oportunidades. El bootstrap no envía esa colección al navegador.

La API mantiene un catálogo normalizado en el backend y expone:

- sectores;
- unidades dependientes del sector;
- clientes dependientes de sector y unidad;
- búsqueda por Business Opportunity ID;
- búsqueda textual;
- paginación.

El navegador recibe únicamente facetas y la página filtrada.

## Archivos temporales

Vue sube cada fichero a una ruta temporal por usuario y obtiene un `uploadId`. Al iniciar:

1. La API verifica propietario y ruta.
2. `Extract Security Context` materializa el fichero en el workspace.
3. Un nodo de limpieza nuevo elimina el staging temporal una vez copiado.

También existe una purga de uploads temporales con más de 24 horas. El límite lógico del Function es 250 MB por fichero, pero el proxy o la configuración HTTP de FLOWS pueden imponer un límite inferior.

## Resultados y transportes

Las ramas existentes de Excel, DOCX, PPTX y SharePoint siguen siendo las mismas. Se añadieron gates de transporte al final:

```text
_transport=http/vue → HTTP response
sin _transport       → axetflows-view-action legacy
```

Así `PARALLEL` puede atender simultáneamente Vue y Form.io.

La respuesta binaria añade:

- MIME según extensión;
- `Content-Disposition` con nombre UTF-8;
- `Content-Length`;
- `Cache-Control: no-store`;
- `X-Content-Type-Options: nosniff`.

Se amplió la captura de errores a toda la rama de entregables y se preserva el contexto HTTP en los errores explícitos de PPTX.

## MANA

Las acciones Vue se convierten en los valores que esperaba el formulario MANA:

- `upload`;
- `checkRequired`;
- `deleteDoc`;
- `deleteDocConfirm`.

A partir de ahí se reutilizan los nodos Graph existentes de upload, get-files y delete-file. Los resultados de las antiguas pantallas de comprobación y eliminación se normalizan como JSON para Vue.

## Cambios deliberados sobre el flujo original

1. Se añade el módulo SPA a `global-config`.
2. `env settings` deja de contener la credencial y lee variables del runtime.
3. Se añaden un inicializador de entorno y un gate para conservar el arranque legacy.
4. Se añaden 17 rutas HTTP y sus adaptadores.
5. Se conecta el inicio Vue al finalizador de sesión anterior y luego al subflujo existente.
6. Se inserta limpieza de uploads tras su materialización.
7. Se añaden gates HTTP/Form.io en Excel, documento, SharePoint y MANA.
8. Se suprimen las redirecciones Form.io únicamente para ejecuciones iniciadas por Vue.
9. Se preserva el contexto original en el error explícito de PPTX.
10. Se hace capturable el caso “sin ficheros para SharePoint”.

No se reemplazan los Functions de Codex, procesamiento documental, fusión, generación de informes, Excel, DOCX/PPTX ni Microsoft Graph.

## Modos de exportación

### PARALLEL

- Vue: activo.
- Form.io: activo.
- Recomendado para pruebas y aceptación.

### CUTOVER

- Vue: activo.
- 13 Forms, 29 view-actions y 1 app legacy: deshabilitados.
- Backend compartido: activo.

## Ausencias del JSON recibido

El menú histórico hacía referencia a “Admin files” y “User Okta search”, pero los nodos de esas utilidades no están presentes en la exportación completa recibida. La SPA no inventa sus APIs: la pantalla de administración los marca como no disponibles.
