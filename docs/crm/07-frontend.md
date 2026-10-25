# DholeCRM Fase 7 — Frontend DholeWeb

Fuente funcional: CODEX_DHOLECRM_IMPLEMENTACION_COMPLETA.md, secciones 7–9 y fase 7.

## Implementado con APIs reales de las Fases 2–6

Menú y rutas protegidas mediante scopes efectivos. La variable VITE_CRM_ENABLED=true habilita la interfaz solo después de validar CRM Gateway/Auth/staging; sin esa variable, CRM queda oculto y las rutas redirigen.

Pantallas: dashboard con datos permitidos, cuentas, prospectos, oportunidades, Kanban, actividades, agenda de siete días, seguimientos, análisis, administración de pipelines, crédito y contratos. Fichas con contactos, preferencias de contacto, no-contactar, consentimiento con evidencia, notas, etapas, vínculos a cotizaciones y solicitudes reales Pricing, políticas de seguimiento, crédito y renovaciones.

Búsqueda global federada de cuentas, leads y oportunidades autorizadas. El backend sigue validando scope y propiedad, no la interfaz. JWT y refresh usan el fetchClient existente. POST críticos reutilizan Idempotency-Key en reintentos de igual contenido. Solo HTTP mediante Gateway, nunca gRPC desde el navegador.

ES/EN, responsive, tabs existentes y control de concurrencia rowVersion. No se crean migraciones ni nuevos workers en Fase 7; se reutilizan las fases anteriores.

## Funciones no verificables sin backend adicional

Las fases previas no proporcionan actualmente rutas /api/crm/dashboard, /api/crm/targets, /api/crm/campaigns, /api/crm/integrations/jobs ni /api/crm/search. No se simula ejecución de esas rutas.

Dashboard muestra los conteos de registros autorizados; valor ponderado únicamente si todos los registros relevantes caben en la página cargada. No afirma mostrar metas, forecast total ni estados completos de todas las cotizaciones.

El panel de campañas y Dynamics/Hacienda no se activa como si existiera. La integración Dynamics corresponde a Fase 8. Las metas y reportes globales precisan endpoints seguros adicionales antes de una entrega completa según la especificación.

## Promoción segura

1. Integrar y desplegar Fases 1–6 en orden antes de habilitar Fase 7.
2. Verificar el Compose efectivo de servidor que puede incluir /opt/dhole/docker-compose.services.yml; redes, CRM_HTTP_URL, Auth, Config, Pricing, Storage, PostgreSQL y Redis.
3. Activar Features__CrmEnabled y Features__CrmGatewayEnabled en staging, asignar scopes reales de mínimo privilegio; compilar DholeWeb staging con VITE_CRM_ENABLED=true.
4. Probar flujos reales vendedor/jefe/finanzas, incluyendo 403/409, contactos, cancelación de consentimiento, Pricing, crédito y renovaciones.
5. Ejecutar pnpm run test:crm, type-check, build-only y audit. La CI general Maersk fallaba ya por prueba no relacionada con CRM.
6. Promover a producción solo con staging comprobado y aprobación explícita.

Rollback: desactivar VITE_CRM_ENABLED y restaurar la imagen frontend previa sin borrar datos ni revertir la base de datos.

No se desplegó a staging ni a producción en esta implementación.

## Revisión del 25/10/2026 — mejoras sin adelantar Fase 8

- Agenda de actividades/seguimientos: los registros almacenados como instantes UTC ahora se agrupan por fecha **local del navegador**; el cálculo de siete días usa fechas calendario y no suma 86.400.000 ms (evita desfases al cambiar el horario de verano). La vista explica cuando solo están cargados los primeros registros paginados; no anuncia una agenda global completa.
- Finanzas: la selección de cuenta consulta cuentas **autorizadas** usando GET `/api/crm/accounts` con búsqueda. No exige copiar UUID manualmente. El backend sigue aplicando controles por registro y scopes de crédito/contrato.
- Pruebas añadidas: `tests/crmAgenda.test.ts` (conversión UTC→Costa Rica, límites de mes/año, orden cronológico, DST) y regresiones de permisos e interfaz en `tests/crmFrontend.test.ts`. `pnpm run test:crm` ejecuta ambas suites; el workflow dedicado también.
- Riesgos no resueltos: las fases 1–6 siguen en PR independientes y no están integradas en `develop`; sin ello no hay E2E autenticado/staging de CRM. El audit de dependencias del frontend y las pruebas de Maersk pueden bloquear la promoción; no se suprimen validaciones.
