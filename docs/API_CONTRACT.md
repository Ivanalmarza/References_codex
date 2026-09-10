# Contrato HTTP de References Codex Vue

Base desplegada en FLOWS:

```text
/references-codex/api/
```

Base utilizada por el navegador:

```text
./api/
```

Todas las peticiones usan la cookie/sesión de la plataforma. El backend resuelve nuevamente la identidad; no acepta una clave de usuario proporcionada por Vue.

## Respuestas de error

Formato general:

```json
{
  "ok": false,
  "error": "ERROR_CODE",
  "message": "Descripción legible",
  "details": null
}
```

Códigos habituales:

- `400`: petición o selección inválida;
- `401`: no existe contexto autenticado;
- `403`: la sesión o upload pertenece a otro usuario;
- `404`: recurso no encontrado;
- `409`: ejecución todavía no terminal o resultado todavía no disponible;
- `413`: fichero por encima del límite lógico;
- `500`: error no controlado de generación o integración.

## Identidad

### `GET /_auth/user`

Ruta de plataforma, fuera de `./api/`. Vue la usa para mostrar el usuario. La autorización real se repite dentro de cada endpoint de FLOWS.

## Salud y bootstrap

### `GET ./api/health`

Devuelve información mínima del servicio sin construir el catálogo completo de oportunidades.

### `GET ./api/bootstrap`

Devuelve:

- configuración de la aplicación;
- estado del cache de selectores;
- idiomas;
- formatos sectoriales;
- plantillas;
- unidades/proyectos procesados;
- sectores de oportunidad;
- sesión activa autorizada;
- usuario resuelto por FLOWS.

No incluye todas las oportunidades.

## Oportunidades

### `GET ./api/opportunities`

Parámetros opcionales:

```text
sector
unit
customer
businessId
opportunityId
q
page
size
```

Reglas:

- sin filtro suficiente se devuelven únicamente facetas;
- `q` debe tener al menos 3 caracteres;
- `size` está limitado en backend;
- el resultado se pagina.

Respuesta simplificada:

```json
{
  "ok": true,
  "requiresFilter": false,
  "facets": {
    "sectors": [],
    "units": [],
    "customers": []
  },
  "items": [],
  "pagination": {
    "page": 1,
    "size": 25,
    "total": 0,
    "pages": 1
  }
}
```

## Uploads temporales

### `POST ./api/uploads`

```json
{
  "name": "proposal.pdf",
  "type": "application/pdf",
  "size": 123456,
  "scope": "execution",
  "data": "data:application/pdf;base64,..."
}
```

Respuesta HTTP 201:

```json
{
  "ok": true,
  "upload": {
    "uploadId": "...",
    "name": "proposal.pdf",
    "type": "application/pdf",
    "size": 123456,
    "scope": "execution",
    "createdAt": "..."
  }
}
```

### `DELETE ./api/uploads/:uploadId`

Elimina un upload temporal si pertenece al usuario autenticado.

## Ejecuciones

### `POST ./api/executions`

Petición:

```json
{
  "includeProcessed": true,
  "includeOpportunity": true,
  "includeUploads": true,
  "unidadProcesado": "Unidad",
  "proyectoProcesado": "Proyecto",
  "opportunitySelectionMode": "filters",
  "businessOpportunityIdSearch": "",
  "sector": "Sector",
  "unidadOportunidad": "Unidad",
  "cliente": "Cliente",
  "opportunityId": "OPPORTUNITY_ID",
  "uploadIds": ["UPLOAD_ID"],
  "idioma": "Español (ES)",
  "plantilla": "PPTX_General.pptx",
  "sector_outputformat": "general",
  "instruccionEspecifica": "Texto opcional"
}
```

Debe activarse al menos una fuente. Los campos de cada bloque solo son obligatorios cuando su fuente está activa.

Respuesta HTTP 202:

```json
{
  "ok": true,
  "accepted": true,
  "sessionId": "32_hex_chars",
  "status": "queued",
  "selectedSources": ["processed", "opportunity", "uploads"],
  "sourceType": "mixed",
  "createdAt": "...",
  "links": {
    "status": "./api/executions/<id>",
    "results": "./api/executions/<id>/results",
    "stop": "./api/executions/<id>/stop"
  }
}
```

### `GET ./api/executions/active`

Devuelve la sesión activa del usuario o `null`.

### `GET ./api/executions/:sessionId`

Devuelve resumen, fases, fuentes materializadas, runtime y cola de logs. Indicadores principales:

```json
{
  "ready": false,
  "failed": false,
  "stopped": false,
  "terminal": false,
  "canStop": true
}
```

### `POST ./api/executions/:sessionId/stop`

Marca `stopRequested`, actualiza `SESSION_STATE.json` y solicita la terminación del PID/worker registrado. El worker también comprueba periódicamente la marca para no lanzar más batches.

### `POST ./api/executions/:sessionId/release`

Libera la referencia de sesión activa. No elimina automáticamente el workspace ni los artefactos finales.

### `GET ./api/executions/:sessionId/results`

- HTTP 409 mientras la sesión no sea terminal y no exista resultado.
- HTTP 200 para éxito, error o parada terminal.
- `success=true` únicamente para una ejecución correcta.
- Puede incluir `answers=null` en una parada/error sin `respuestas.json`.

## Logs

### `GET ./api/logs`

Lista sesiones visibles para el usuario. Los roles administradores pueden disponer de alcance ampliado según el contexto entregado por la plataforma.

### `GET ./api/logs?sessionId=<id>&lines=320`

Devuelve la cola final del log unificado de una sesión autorizada.

## Entregables

### `POST ./api/executions/:sessionId/export/excel`

Reutiliza la rama Excel actual y devuelve un `.xlsx` binario.

### `POST ./api/executions/:sessionId/export/template`

Reutiliza `prepare payload plantilla` y la rama DOCX/PPTX según la plantilla bloqueada en `SESSION_STATE.json`.

### `POST ./api/executions/:sessionId/sharepoint`

Genera los ficheros necesarios y reutiliza la cola de upload a SharePoint existente. Devuelve JSON con los ficheros publicados.

Las tres acciones requieren `respuestas.json` y autorización sobre la sesión.

## MANA

### `GET ./api/mana/bootstrap`

Devuelve las opciones necesarias para abrir la pantalla MANA sin cargar todas las oportunidades.

### `POST ./api/mana/actions`

Acción de subida:

```json
{
  "action": "upload",
  "opportunityId": "...",
  "sector": "...",
  "unidadOportunidad": "...",
  "cliente": "...",
  "uploadIds": ["..."]
}
```

Comprobación:

```json
{
  "action": "checkRequired",
  "opportunityId": "..."
}
```

Preparar borrado:

```json
{
  "action": "deleteDoc",
  "opportunityId": "..."
}
```

Confirmar borrado:

```json
{
  "action": "deleteDocConfirm",
  "opportunityId": "...",
  "deleteFileName": "document.pdf"
}
```
