# Registro de validación

## Flujo generado

La generación reproducible se ejecutó con:

```bash
node scripts/build-flow-migration.cjs "/ruta/al/flows - 2026-09-02T122949.321.json"
```

Resultados:

| Modo | Nodos | HTTP In | Forms conservados | UI legacy deshabilitada |
| --- | ---: | ---: | ---: | ---: |
| PARALLEL | 286 | 17 | 13 | 0 |
| CUTOVER | 286 | 17 | 13 | 43 |

Comprobaciones superadas:

- IDs únicos.
- Todos los wires y links apuntan a nodos existentes.
- 17 combinaciones método+ruta únicas.
- Nodo `axet-spa-app` con `appId=references-codex`.
- Inicio Vue con dos salidas: HTTP 202 y background hacia `Finalize active execution`.
- Conexión posterior al subflow existente conservada.
- Limpieza de uploads después de `Extract Security Context`.
- Gates de redirección final y progreso para ejecuciones Vue.
- Captura ampliada de errores de Excel/DOCX/PPTX/SharePoint.
- Adaptadores HTTP/Form.io en las ramas de resultados y MANA.
- 13 Forms activos en PARALLEL.
- 13 Forms, 29 view-actions y 1 app legacy deshabilitados en CUTOVER.
- Módulo `axet-flows-contrib-nodes-axet-ui-spa: 1.0.1` presente.
- Ausencia de un valor de `AXET_CLIENT_SECRET` embebido en las exportaciones generadas.

## Pruebas de Functions

Ejecutadas mediante:

```bash
node scripts/test-flow-functions.cjs
```

Se validaron:

- sintaxis de los 12 Functions HTTP;
- health y bootstrap compactos;
- catálogo backend simulado con 45.000 oportunidades;
- facetas sector → unidad → cliente;
- búsqueda por Business Opportunity ID;
- rechazo de búsquedas textuales demasiado cortas;
- creación y eliminación de uploads temporales;
- hidratación y limpieza de uploads para MANA;
- aceptación de ejecución con HTTP 202;
- contrato `msg.submission` del backend actual;
- propietario de sesión y autorización entre usuarios;
- estado de ejecución y capacidad de parada;
- sesiones correctas, fallidas y detenidas;
- consulta de detalle terminal para error/parada;
- export action routing;
- stop y release.

La prueba sintética de 45.000 elementos construyó el catálogo normalizado en aproximadamente 0,3 segundos en este contenedor. Es una medida de prueba aislada, no una garantía de rendimiento en el runtime de producción.

## Código Vue

Se ejecutaron correctamente:

```bash
node scripts/typecheck-with-stubs.cjs
node scripts/validate-frontend-syntax.cjs
node scripts/validate-project.cjs
node scripts/validate-migration.cjs "/ruta/al/flows - 2026-09-02T122949.321.json"
```

Estas comprobaciones validan:

- type-check controlado del frontend mediante stubs temporales;
- sintaxis TypeScript de 12 ficheros `.ts`;
- sintaxis de los bloques TypeScript de 18 componentes/vistas `.vue`;
- presencia de templates en los SFC;
- coherencia de `package.json` y `package-lock.json`;
- `base: './'` en Vite;
- base de Axios relativa `./api/`;
- identidad mediante `/_auth/user`;
- las invariantes de ambos grafos de FLOWS descritas arriba.

La comparación profunda confirmó además que ambas exportaciones conservan los 220 nodos del flujo fuente, incorporan 66 nodos de migración, mantienen IDs y enlaces válidos y contienen exactamente 17 rutas HTTP únicas.

## Limitación del entorno de ejecución

No se pudo completar aquí un `npm ci`, `vue-tsc`, ESLint ni el build de Vite porque el proceso de npm no consiguió descargar dependencias del registro y quedó bloqueado por conectividad/DNS. Se eliminó el `node_modules` parcial antes de empaquetar el proyecto.

Por tanto:

- la sintaxis y los contratos del código sí están verificados;
- el grafo FLOWS y sus Functions sí están verificados;
- el build frontend de producción debe ejecutarse en la red corporativa o directamente por el nodo SPA configurado con `npm ci` y `npm run build`.

## Prueba end-to-end pendiente de entorno

La validación definitiva requiere una instancia real de AXET FLOWS con:

- sesión Okta/SAP activa;
- módulo SPA instalado;
- almacenamiento `/internal-storage-files/files`;
- Microsoft Graph configurado;
- secretos del enabler configurados;
- repositorio Git accesible desde el runtime.

La secuencia está documentada en `FLOWS_DEPLOYMENT.md`.
