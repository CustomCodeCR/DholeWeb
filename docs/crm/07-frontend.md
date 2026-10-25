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
