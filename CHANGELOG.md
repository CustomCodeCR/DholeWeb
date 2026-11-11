## [1.22.0] - 2026-11-10

- MINOR DH-20261110-CRM-LEAD-QUO-PARITY-080: vista de Prospectos alineada con Cuentas (Ficha, Análisis comercial, Cotizaciones, Historial de rutas, Seguimientos), todas las QUO por ClientLeadId desde Pricing sin depender de oportunidades CRM. Indicadores oficiales de Pricing y rutas automáticas vinculadas por ID.
- Permite vincular QUO históricas sin asignar desde acordeón exclusivo de superadministradores con confirmación, sin reasignar cuotas de otras cuentas/prospectos; actualización coordinada con DholePricingService 1.10.0 y DholeSystem 1.22.0. Conserva CRM y sus permisos, SignalR/REST y los cambios de contactos de 1.21.0.

## [1.21.0] - 2026-11-10

- MINOR DH-20261110-CRM-CONTACTS-ROLE-MULTISELECT-079: DhMultiSelect en creación de actividad y participantes del detalle; selección múltiple de contactos vinculados a la cuenta; solo vendedores y superusuarios elegibles para asignación.
- Se mantienen API REST y realtime existentes. Validación por CI y staging antes de confirmar despliegue.

## [1.20.1] - 2026-11-10

- PATCH DH-20261110-CRM-SELLERS-COMMITMENTS-078: solo vendedores activos en filtros y asignación de agenda, y casilla para completar compromisos vinculados con el scope crm.activity.update del responsable; sin permitir acciones sobre compromisos ajenos.
- Versión global 1.20.1; REST y SignalR conservados, CI y staging pendientes.

## [1.20.0] - 2026-11-10

- MINOR DH-20261110-CRM-AGENDA-UNIFIED-077: unifica Nueva actividad en cuentas/prospectos, selector de participantes desde contactos, minuta redimensionable, asignación de vendedor en agendas con scopes globales y checkbox funcional para compromisos vinculados.
- Backport de las mejoras de CRM de develop sin modificar otras pantallas. Requiere DholeCRMService 1.5.0. CI y staging previos al merge, sin migraciones.

## [1.19.5] - 2026-11-10

- PATCH DH-20261110-CRM-GLOBAL-AGENDAS-076: la agenda muestra registros de todos los vendedores a usuarios con crm.activity.read-all o ambos scopes globales de clientes y prospectos; el selector permite elegir usuarios activos mediante un directorio CRM protegido, sin depender del permiso auth.users.view.
- Versión global Dhole 1.19.5; requiere Auth/CRM del mismo release; CI y staging pendientes.

## [1.17.20] - 2026-11-10

- PATCH DH-20261110-CRM-HISTORICAL-ACTIVITIES-075: permite guardar actividades con fechas pasadas, marcando como completadas las ya finalizadas y evitando recordatorios retroactivos. Preserva minuta, acuerdos y todos los cambios existentes de master hasta 1.17.19.
- Coordinado con CRM 1.4.6 y System 1.17.20. CI/staging requeridos.

## [1.17.19] - 2026-11-10

- PATCH DH-20261110-PRICING-CRM-PROSPECT-REQUESTS-MASTER-076: hotfix aislado de Pricing para resolver la cuenta o prospecto CRM y su ejecutivo comercial vigente por ID al enviar solicitudes normales, editar solicitudes del vendedor, solicitar modificaciones desde Ventas y guardar modificaciones LCL desde pantalla 5 sin montar el selector de pantalla 3. Incluye las correcciones equivalentes de develop 1.19.1 y 1.19.2 sin importar cambios ajenos.
- Conservar cambios voluntarios de cliente, permisos CRM, vendedor Castro Fallas y QUO históricas no vinculadas; rechazar vendedores sin asignación vigente. Incluye regresiones y mantiene REST/SignalR. DholeWeb y DholeSystem 1.17.19; otros servicios sin cambios. CI y staging requeridos.

## [1.17.18] - 2026-11-10

- DH-20261110-CRM-LEAD-TABBED-DETAIL-073: evita que el panel genérico de otros módulos vuelva a mostrar los campos del prospecto bajo las pestañas Análisis, Cotizaciones, Agenda o Conversión. Mantiene una sola pestaña visible por vez.

## [1.17.17] - 2026-11-10

- DH-20261110-CRM-LEAD-TABBED-DETAIL-073: ficha de prospectos con pestañas como Cuentas (Prospecto, Análisis comercial y rutas, Cotizaciones, Agenda y seguimientos, Convertir a cuenta), una sección visible a la vez; conserva permisos y los enlaces directos de conversión.
- Panel comercial reutilizado en modos análisis/cotizaciones para evitar solicitudes y formularios fuera de la pestaña activa; sin cambios en CRM API, Auth ni migraciones. Ecosistema Dhole 1.17.17.

## [1.17.16] - 2026-11-10

- DH-20261110-CRM-PROSPECT-SELLER-072: en la lista y detalle de Prospectos se muestra el vendedor asignado, con nombres obtenidos de Auth vía CRM y permisos por registro. Administrador puede crear y reasignar prospectos a vendedores activos con crm.lead.assign y auth.users.view.
- Reutiliza selector comercial sin vendedor institucional para prospectos; vendedor sin permiso sigue asignándose a sí mismo. Ecosistema Dhole 1.17.16.

## [1.17.15] - 2026-11-10

- DH-20261110-CRM-PROSPECT-ROUTES-QUOTES-069: nombres de prospectos en UPPER CASE desde API y UI, análisis comercial con rutas y cotizaciones vinculadas mediante oportunidades de CRM y Pricing.
- Release Dhole 1.17.15, sin migraciones de datos.

## [1.17.14] - 2026-11-10

- PATCH DH-20261110-CRM-ACTIVITY-FULL-DETAIL-068: muestra información completa de actividades y seguimientos (cliente, ejecutivo, contacto, fechas, recordatorios, minuta, acuerdos, compromisos y actividad principal). Integra los cambios verificados en staging de DholeWeb 1.17.11 sin revertir el release 1.17.12 de identidad CRM/Pricing.
- Coordinado con DholeCRMService 1.4.3 y DholeSystem 1.17.14; endpoints de lectura autorizados, sin migraciones ni cambios de SignalR.

## [1.17.12] - 2026-11-10

- PATCH DH-20261110-PRICING-CRM-REQUEST-IDENTITY-067: solicitudes normales, edición y modificaciones de QUO recuperan el ejecutivo comercial vigente desde el CRM por ID, conservan executiveUserId al enviar y no reemplazan al vendedor con el usuario conectado. Se respetan cuentas Castro Fallas, permisos CRM, delegación y cotizaciones históricas sin vincular. Prueba de regresión pricingCrmRequestCommercialOwner; Pricing 1.9.10 y CRM 1.7.5 en develop / 1.4.2 en master.

## [1.17.10] - 2026-11-10

- PATCH DH-20261110-CRM-AGENDA-CLIENT-EXECUTIVE-065: Agenda y seguimientos presenta Cliente y Ejecutivo comercial en actividades y seguimientos, con nombres autorizados de cuentas, prospectos y responsables desde el endpoint ya existente `calendar/labels`, en lotes de 100.
- Se conserva búsqueda por cédula de 1.17.9, permisos CRM, paginación, filtros y registros históricos. Incluye tests de resolución de ejecutivo y respaldo para vínculos antiguos; sin cambios en backend ni SignalR.

## [1.17.9] - 2026-11-10

- PATCH DH-20261110-CRM-ACCOUNT-SEARCH-064: la búsqueda en CRM > Cuentas permite localizar por nombre comercial, razón social y cédula/identificación fiscal. El backend filtra antes de paginar; se mantienen roles y filtros.
- Añade regresión de UI para búsqueda por identidad, conserva contratos REST y SignalR, y se coordina con DholeCRMService 1.7.3 en develop / 1.4.1 en master; pendiente de CI y staging, sin producción autorizada.

# Changelog

## [1.17.8] - 2026-11-10

- PATCH DH-20261110-CRM-QUO-STATUS-061: el historial y resumen de QUO del CRM, así como los listados de vinculación histórica, muestran etiquetas comerciales traducidas en lugar de nombres de enum. Se admiten español/inglés y estados plurales heredados sin alterar el estado persistido.
- Resolución coordinada del conflicto con releases 1.17.6 y 1.17.7 (solicitudes múltiples POE de vendedores), preservándolos. Ecosistema 1.17.8; DholeWeb y DholeSystem 1.17.8.

## [1.17.7] - 2026-11-10

- FIX DH-20261110-PRICING-SELLER-MULTI-POE-063: corregir la referencia de plantilla a sellerModificationRateId, que se inyecta durante las transformaciones Vite pero no forma parte de los props visibles a vue-tsc. La validación de tipo del selector FCL múltiple para Ventas se realiza mediante una propiedad calculada tipada, sin exponer selección múltiple durante modificaciones de una tarifa existente.
- Mantener las selecciones de POE en el JSON de solicitudes para Pricing, edición y duplicación; agregar prueba de regresión del contrato y la plantilla. Se conserva un solo POE en modalidades distintas de FCL marítimo.

## [1.17.6] - 2026-11-10

- PATCH DH-20261110-PRICING-SELLER-MULTI-POE-062: Ventas puede seleccionar varios destinos POE marítimos FCL al solicitar tarifas. Se guardan todos en la solicitud, se recuperan al editar, duplicar y continuar en Pricing, y se muestran en la bandeja de solicitudes; las solicitudes anteriores conservan compatibilidad. Se mantiene la limitación de un POE para LCL, terrestre, aéreo y modificaciones de tarifas existentes.

## [1.17.4] - 2026-11-10

- PATCH DH-20261110-PRICING-LAND-TRANSIT-060: mostrar «Días de tránsito para la entrega» en la pantalla 6 de tarifas terrestres FTL/LTL, incluso cuando no está seleccionado transporte internacional.
- Conservar los días introducidos al navegar entre pantallas, guardarlos como transitDays/transitTime al crear o editar y presentarlos en el resumen. Mantener ocultos el flete internacional y días libres cuando no aplican; sin cambios al contrato REST.

## [1.17.3] - 2026-11-10

- PATCH DH-20261110-PRICING-CRM-EXECUTIVE-059: Pricing envía el executiveUserId de Auth asociado a la cuenta o prospecto CRM junto con su nombre al crear y actualizar SPOT/tarifarios. Evita el error «Debe seleccionar un ejecutivo comercial» cuando el vendedor ya aparece asignado en pantalla 3.
- Valida las asignaciones incompletas antes del POST sin sustituir el vendedor CRM, preserva Castro Fallas, compatibilidad REST y precios. Coordinado con DholePricingService 1.9.5 y ecosistema 1.17.3.

## [1.17.2] - 2026-11-10

- PATCH DH-20261110-CRM-QUO-SUPERADMIN-058: la vinculación de QUO históricas solo se muestra en un acordeón cerrado inicialmente a SuperAdmin, SuperAdministrador, SuperUsuario y SuperUser. El contenido solo consulta la API al desplegarse.
- Se mantienen disponibles cotizaciones, indicadores y rutas ordinarios del cliente. Restricción adicional en Pricing 1.9.4; ecosistema 1.17.2.

## [1.17.1] - 2026-11-10

- PATCH DH-20261110-CRM-QUO-LIVE-057: indicadores y rutas CRM se consultan directamente en las QUO de Pricing vinculadas por ID de cuenta; se eliminan ceros causados por registros de oportunidades CRM no relacionados.
- Selección masiva segura de QUO pendientes por página o por resultados filtrados (hasta 1000), revisión y confirmación explícita, refresco de historial e indicadores tras vincular.
- Coordinado con DholePricingService 1.9.3, DholeSystem 1.17.1. Sin alterar importes ni estados.

## [1.16.1] - 2026-11-09

- PATCH DH-20261109-CRM-QUO-LINK-SYNC-056: migración CRM presenta únicamente QUO sin vínculo, elimina del listado las que se vinculan y refleja nombre y ejecutivo CRM en las tarifas Pricing.
- Reconciliación manual de datos en QUO previamente vinculadas, refresco de cotizaciones y rutas sin cambiar cifras ni estados. Pricing 1.9.2, ecosistema 1.16.2.

## [1.16.0] - 2026-11-09

- MINOR: Todas las QUO históricas se muestran en el CRM mediante DhDataTable y DhPagination; búsqueda por código, cliente y ruta, selección y vinculación manual por ID a la cuenta actual.
- Identidades de otros clientes y prospectos permanecen protegidas. Cotizaciones ya vinculadas se muestran en solo lectura; no cambian cifras, revisiones ni estados.
- Release DH-20261109-CRM-LEGACY-QUO-CATALOG-055 con Pricing 1.9.0, ecosistema 1.16.0; staging y controles CI obligatorios antes de producción.

## [1.15.0] - 2026-11-09

- Backport CRM: cuentas/prospectos como cliente, ejecutivo asignado y conciliación de QUO históricas.

## [1.12.22] - 2026-11-09

- PATCH QUO-00000-000269: mostrar el estado real Open (Abierta) de Pricing en el panel y detalle comercial incluso cuando el snapshot de la última cotización enviada tenga estado Sent. Filtros, contadores e indicadores comerciales comparten el estado actual.
- La API separa currentRateStatus de status del snapshot; no publica borradores, cargos ni importes internos. Las acciones permanecen bloqueadas mientras revisionPending sea true.
- Regression tests para cotización abierta, solicitud de modificación abierta, aprobación y compatibilidad con APIs anteriores. Release DH-20261109-QUO269-SELLER-STATUS-053 con DholePricingService 1.5.22 y ecosistema 1.12.22 (master).

## [1.12.21] - 2026-11-09

- PATCH Ventas/Pricing: una revisión pendiente de publicación no implica trabajo abierto en Pricing. El badge solo muestra «En modificación por Pricing» con una solicitud realmente abierta; en los demás casos identifica la actualización pendiente.
- Sin exposición de borradores ni desbloqueo indebido de acciones; refresco periódico de tarifas y solicitudes. Regresión automatizada añadida.
- Release DH-20261109-SELLER-PRICING-STATUS-052 (master candidate); DholePricingService 1.5.21 y ecosistema 1.12.21.

## [1.12.20] - 2026-11-09

- PATCH Pricing: mostrar inventario LCL del POE si no hay salidas compatibles y vigentes; ETD vencidas y otros POL son solo consulta, nunca cotizables.
- Preservar matriz Shanghai/Ningbo, POL físico Yantian, Balboa/Moín y guardas de selección. Contratos REST y backend sin cambios.
- Release DH-20261109-PRICING-OWNLCL-VISIBILITY-051 (master).

## [1.12.19] - 2026-11-09

- PATCH CRM: tablas y paginación unificadas con DhDataTable y DhPagination en cuentas, prospectos, contactos, agenda, relaciones, historial de cambios y rutas.
- Selección de 10/25/50 filas; conserva filtros y permisos de API, con reinicio de página al cambiar filtros o tamaño.
- Release DH-20261109-CRM-DHPAGINATION-050 para master tras validación de staging desde develop.

## [1.12.18] - 2026-11-09

- ALL IN solo cuando la alternativa FCL es marítima/multimodal, su POE está en Panamá y el POD final en Costa Rica; Caldera, Moín y otros destinos mantienen desglose. La decisión se calcula para cada alternativa al crear MultiQUO y se visualiza por subtarifa en pantalla 8.
- Release coordinado DH-20261109-PRICING-FCL-PANAMA-ALLIN-049; DholeWeb 1.12.18 / DholePricingService 1.5.20.
- Pruebas unitarias y de regresión más validación de staging antes de master.

## [1.12.17] - 2026-11-09

- Gestión de tarifas muestra una sola fila por MultiQUO, con número principal, contador de opciones y paginación real desde Pricing; conserva todas las alternativas en el detalle.
- Flete marítimo manual: el POE viene de la ruta activa; comentarios, tarifa manual guardada y huella de idempotencia quedan aislados por POE y naviera, sin repetir valores en otras opciones.
- No elimina datos ni modifica la selección de fletes importados. Release coordinado DH-20261109-PRICING-QUO-PORT-ISOLATION-048 con DholePricingService 1.5.19.
- Compilación, regresiones y staging antes de integrar a master.

## [1.12.16] - 2026-11-08

- Hotfix DH-20261108-PRICING-RATE-SELECTION-047: preserva `selectedFclBundlesByOption` y su restauración por POE/naviera fuera del bloque que `pricingWizardMixedCarrierExpiry` reemplaza, evitando `ReferenceError` al elegir tarifas FCL.
- Pantalla 5 resalta exclusivamente la oferta FCL seleccionada por RateId; las fuentes comerciales agrupadas conservan botones y selección individuales sin marcar toda la naviera.
- Guard de compilación para bindings FCL posteriores a los plugins de Vite y pruebas de regresión; conserva IDs de importación, comentarios, precios, vigencias, contratos REST y datos persistidos.
- Release coordinado con DholePricingService 1.5.18. Validación obligatoria de CI, smoke minificado y staging antes de integrar a producción.

## [1.12.15] - 2026-11-08

- Release `DH-20261108-PRICING-SETUP-TDZ-046`: soluciona la referencia anticipada de `form` causada por el watcher de fecha que un plugin introducía antes de `const form = reactive(...)` en el asistente de Pricing. Esta era la segunda excepción `Cannot access 'G' before initialization` que bloqueaba el renderizado en master.
- La nueva validación de CI monta el asistente con Chrome sobre el JavaScript de producción minificado y evita merges que entreguen una pantalla negra aunque `vite build` compile.
- Mantiene íntegros los RateId, cotizaciones existentes, contratos REST y correcciones de FCL. Release coordinado con DholePricingService 1.5.17 y validación en staging antes de producción.

## [1.12.14] - 2026-11-08

- Hotfix `DH-20261108-PRICING-SETUP-TDZ-045`: mueve los estados centrales de costos y líneas antes del punto donde los plugins Vite inyectan los cálculos FCL. Corrige el fallo en Firefox `can't access lexical declaration 'W' before initialization`, identificado en el bundle real como el ref `costs`.
- Reubica también el watcher automático de vigencia del flete marítimo manual después de la inicialización del formulario reactivo: el bundle de master reveló un segundo TDZ (`G`/`form`), bloqueado por el nuevo smoke test.
- Añade una prueba de montaje Vue SSR y una prueba funcional de apertura en Chrome mediante DevTools Protocol para impedir releases donde «Crear tarifa» compile pero falle en runtime.
- Conserva la selección de ofertas FCL, tarifas, RateId y APIs REST; no modifica datos de producción. Release coordinado con DholePricingService 1.5.16. CI y staging obligatorios antes de producción.

## [1.12.13] - 2026-11-08

- Hotfix `DH-20261108-PRICING-RENDER-GUARD-044`: elimina un computed de cobertura FCL que dependía de bundles durante la inicialización, evitando referencias adelantadas y fallos de renderizado en Crear tarifa.
- Los badges FCL obtienen ofertas únicas del arreglo filtrado por contenedor y el total de registros importados se calcula independientemente y con protección ante datos incompletos. Se conserva la selección y deduplicación de RateId reales.
- Regresión automatizada para impedir `.reduce` directo sobre la propiedad de cobertura no inicializada y verificar la pantalla recuperable `PricingWizardBoundary` en staging.
- Release coordinado con DholePricingService 1.5.15. Requiere compilación, pruebas y verificación en staging antes de integración a producción.

## [1.12.12] - 2026-11-08

- **Corrección crítica en producción:** Pantalla «Crear tarifa» quedaba completamente vacía después de 1.12.11 por `ReferenceError: fclBundleHasSelectedSources is not defined` y `can't access lexical declaration before initialization` en el asistente Vue de Pricing.
- Reutiliza `isSelectedFclBundle` (selección POE/naviera/clave de tarifa) y `selectedFclBundleKey`, funciones existentes del asistente, para evitar referencias de runtime introducidas tardíamente en las transformaciones de Vite. Conserva el resaltado exacto de tarjetas, incluso con fuentes agrupadas.
- Declara `fclRateCoverage` después de `fclRateBundles` para evitar referencias adelantadas a declaraciones léxicas; el contador sigue distinguiendo las ofertas comerciales únicas de los registros de importación.
- Regresión automatizada que bloquea la reintroducción del helper sin enlazar y la declaración de cobertura antes de su dependencia. Release coordinado `DH-20261108-PRICING-BLANK-043` con DholePricingService 1.5.14. Sin modificación de datos, contratos REST o reglas de tarifas.

## [1.12.11] - 2026-11-08

- FCL Pantalla 5: el contador de contenedores muestra **ofertas comerciales únicas** y separa la cantidad de registros de importación; el resultado de filtros cuenta únicamente las tarjetas realmente presentadas.
- La deduplicación ya no elimina tarifas con diferencias de flete oceánico, costo total, cargos de origen/destino, recargos, tiempo de tránsito, comentarios, mercancía, perfil de importación ni fuente tarifaria. Los duplicados verdaderos con vigencias superpuestas se agrupan sin borrar sus IDs.
- La selección se verifica por el RateId real del equipo, naviera y POE; la clave de tarjeta es estable entre ordenamientos. Pantalla 5 distingue «Tarifa elegida» de «Naviera agregada, elija tarifa» y conserva la selección cuando la fuente queda agrupada.
- Incluye pruebas con 108 registros y variantes comerciales que deben permanecer visibles. Release `DH-20261108-FCL-OFFER-COVERAGE-042` coordinado con Pricing 1.5.13; no cambia contratos REST ni registros persistidos.

## [1.12.10] - 2026-11-08

- Hotfix de recuperación: restaurado el renderizado comprobado de la Pantalla 5 FCL v1.12.7, retirando el agrupador experimental introducido en v1.12.8 que precedió a la pantalla negra. Se mantienen las agrupaciones equivalentes que ya funcionaban en v1.12.7.
- Conserva la corrección para no marcar tarifas ajenas al seleccionar una naviera y mantiene los vínculos de fuentes de correo bajo demanda, sin cientos de solicitudes `/source` ni modificar los registros originales.
- Añade prueba de regresión para impedir que se reinserte el agrupador experimental hasta disponer de una prueba E2E real de pantalla 5. La deduplicación adicional por naviera se pospone hasta validar el navegador.
- Release `DH-20261108-FCL-RESTORE-RENDER-041`, con DholePricingService 1.5.12, mismo contrato REST, CI y staging obligatorios.

## [1.12.9] - 2026-11-08

- Evita que Pantalla 5 FCL quede en negro durante la carga de muchas tarifas: elimina las consultas paralelas innecesarias a /source para los 36 lotes asociados a 110 registros de importación. Los correos fuente se consultan al abrir el modal correspondiente.
- Añade recuperación no destructiva si falla la agrupación visual de ofertas FCL: el usuario puede seguir viendo y seleccionando tarjetas individuales, conservando todos los RateId y detalles comerciales.
- Protege la selección visual cuando se reciben ofertas parcialmente hidratadas.
- Nuevas pruebas de regresión para la carga de tarifas sin peticiones masivas y el fallback de Pantalla 5. Release `DH-20261108-FCL-BLANK-SCREEN-040`. DholePricingService 1.5.11 mantiene el contrato API.

## [1.12.8] - 2026-11-08

- Pantalla 5 FCL: genera cada oferta a partir de su RateId antes de agrupar; evita perder precios distintos al escoger la primera fuente de un grupo naviera/agente/moneda.
- Muestra una sola tarjeta por naviera en cada POE, con las ofertas de distinto precio, vigencia y condiciones desplegables y seleccionables; las fuentes realmente duplicadas permanecen como respaldo.
- El indicador «Tarifa elegida» y su resaltado exigen coincidencia exacta de POE, naviera, clave del grupo y todos los RateId de sus contenedores. Añadir navieras manualmente ya no selecciona tarifas.
- La selección FCL no reemplaza el POD escogido por un valor importado «Por asignar» y la resolución de naviera usa ID o nombre exacto.
- Regresión con distribución de 110 filas de origen, cinco navieras y varias ofertas por naviera. Release `DH-20261108-FCL-CARRIER-CARDS-SELECTION-039` con DholePricingService 1.5.10.

## [1.12.7] - 2026-11-08

- Pantalla 5 FCL: agrupa en una sola tarjeta las ofertas visualmente iguales con vigencia superpuesta incluso cuando sus fuentes tienen comentarios, tránsito o metadatos distintos.
- Conserva todas las alternativas y los ID originales seleccionables en una sección colapsable, sin repetir tarjetas principales ni borrar tarifas importadas.
- Respeta diferencias de ruta, naviera, agente, moneda, equipo, costo, días libres y vigencia no superpuesta. Pruebas de regresión MAERSK Caldera 04/05 noviembre.
- Release coordinado `DH-20261108-FCL-VISUAL-GROUPS-038`, CI y staging antes de integrar a master.

## [1.12.6] - 2026-11-08

- Corrige los términos de «Tarifa incluye», «Sujeta a» y «Tarifa no incluye» persistidos como un solo texto con `\\n` o `\\r\\n`: se convierten en ítems individuales sin alterar cotizaciones históricas.
- Normaliza líneas reales, comas heredadas (sin dividir decimales), términos repetidos y saltos escapados dos veces; prioriza registros activos del catálogo.
- Emplea el mismo normalizador para el selector, carga y guardado de cotizaciones en el wizard, y para conceptos manuales pegados con múltiples líneas.
- Da a las tarjetas ajuste de palabras y agrega pruebas de regresión para contenido histórico y compilación del wizard.
- Release `DH-20261108-PRICING-COMMERCIAL-TERMS-037`: validaciones CI y staging antes de master; mantiene las mejoras FCL de 1.12.5.

## [1.12.5] - 2026-11-08

- Pantalla 5 FCL: consolida las tarjetas equivalentes que tienen los mismos identificadores de naviera, agente, moneda y puertos aunque la importación utilice nombres o alias distintos.
- Corrige MAERSK Caldera con fechas 04-13 y 05-13 de noviembre; conserva una sola opción con la vigencia más amplia y el ID auténtico de origen.
- Mantiene separadas las rutas, agentes, monedas, precios, días libres, condiciones comerciales y vigencias no superpuestas; no borra tarifas importadas.
- Release coordinado `DH-20261108-FCL-VISIBLE-DEDUP-036`; validar CI/staging antes de promover a master; producción sin autorizar.

## [1.12.4] - 2026-11-08

- Pantalla 8 FCL: los encabezados de las sub-QUO vuelven a responder en modo visualización. La excepción de eventos se limita a los botones de desplegar/ocultar y el resto del wizard continúa en solo lectura.
- Pantalla 5 FCL: deduplicación definitiva sobre las tarjetas visibles tras construir combinaciones y aplicar filtros de naviera/fecha. Evita dos MAERSK con mismo precio/equipo/ruta y vigencias superpuestas, incluso con diferencias menores de metadatos de importación.
- Respeta distintas rutas, agentes, equipos, costos, condiciones, días libres, tránsito y vigencias que no se superponen, sin eliminar registros de la base de datos.
- Pruebas de regresión nuevas del filtro final y del control de acordeones en vista, sin cambiar APIs REST.
- Release coordinado `DH-20261108-PRICING-VIEW-ACCORDION-FCL-UNIQUE-035`; requiere CI, staging y validación antes de promoción.

## [1.12.3] - 2026-11-08

- Agenda CRM: mantiene los botones Guardar/Cancelar visibles en un pie de modal fijo, aunque haya muchos campos y se desplace el formulario.
- Explica que programar una actividad no activa recordatorios hasta guardarla y muestra los errores de validación junto al botón.
- Corrige el mensaje de confirmación para diferenciar el guardado y encolado de la entrega efectiva de avisos.
- Incluye regresiones de la interfaz de calendario y conserva la compatibilidad con otros modales.

## [1.12.2] - 2026-11-08

- Pantalla 5 FCL elimina ofertas visualmente repetidas de un mismo POL, POE, POD, naviera, equipo, agente, moneda, importe y condiciones comerciales aunque difiera la fecha inicial, cuando sus vigencias se superponen.
- Conserva una sola tarjeta con el intervalo de validez más amplio o la fecha de vencimiento posterior. Diferencias de precio, ruta, días libres, tránsito, agente o periodos no superpuestos permanecen visibles.
- Deduplicación solo en pantalla; no elimina/importa de nuevo fuentes ni modifica tarifas almacenadas. Incluye pruebas de regresión con MAERSK 04/05 noviembre.
- Promoción coordinada junto con la finalización irrevocable de MultiQUO y PDF individual de 1.12.1, Pricing 1.5.6.
- Release `DH-20261108-FCL-EQUIVALENT-RATES-033`: compilación, pruebas y staging obligatorios antes de producción.

## [1.12.1] - 2026-11-08

- Finaliza la sub-QUO seleccionada con el número comercial sin sufijo y redirige enlaces de alternativas históricas a la cotización definitiva.
- Bloquea la reselección de sub-QUO descartadas y restringe a la ruta elegida los controles comerciales y el PDF individual.
- Pantallas 8 y 9 usan acordeones Vue reales con botones y contenido renderizado únicamente al expandir.
- Release coordinado DH-20261108-MULTIQUO-FINAL-INDIVIDUAL-032; compatibilidad con Pricing v1.5.5, CI/staging obligatorios, sin autorización de producción.

## [1.12.0] - 2026-11-07

- Agenda CRM: configura repetición diaria, semanal, quincenal o cada 30 días de visitas, llamadas y reuniones.
- Configura recordatorios periódicos de 5 minutos a un día mientras la actividad siga pendiente, además de recordatorios antes y al inicio.
- Muestra frecuencias guardadas en el detalle e incorpora prueba de regresión del contrato.

## [1.11.5] - 2026-11-07

- Al elegir una sub-QUO, esa alternativa se convierte en la principal comercial en el wizard, queda destacada y se muestra primero, sin alterar el ancla inmutable del grupo.
- Pantallas 8 y 9 permiten expandir y contraer cada sub-QUO guardada con controles explícitos; corrige el estado visual durante navegación.
- Pantalla 5 elimina tarjetas de tarifas importadas equivalentes incluso si proceden de diferentes correos/batches, conservando ofertas con condiciones distintas.
- Actualiza el contrato de Pricing para identificar la sub-QUO seleccionada y priorizarla en el índice PDF.
- Release `DH-20261107-MULTIQUO-PRINCIPAL-DEDUP-ACCORDION-030`. Requiere CI y staging antes de integración en master; no autoriza despliegue a producción.

## [1.11.4] - 2026-11-07

- Pantalla 8 en visualización/edición de MultiQUO muestra acordeones independientes con datos guardados: subQUO, POE, naviera, haulage, flete, rubros, costos y totales; se ocultan los resúmenes de la única tarifa y los controles de creación.
- Release `DH-20261107-MULTIQUO-SAVED-ACCORDIONS-029`. Pruebas de compilación/CI y staging previas a la promoción coordinada.

## [1.11.3] - 2026-11-07

- Conserva la selección Carrier/Merchant del POE y naviera al pasar de Pantalla 6 a Pantalla 7; retira botones redundantes y garantiza Inland y su tarifa desde los mismos CostIds configurados.
- Release `DH-20261107-FCL-HAULAGE-HANDOFF-028`. Integración primero en `develop`, validación staging y promoción del mismo lote a `master`.

## [1.11.2] - 2026-11-07

- Corrige selección automática del Inland configurado según POE/naviera Merchant o Carrier sin reintroducir precios cero del borrador; muestra advertencia si no existe precio válido. Monedas por Value y resumen comercial de ancho completo.
- Release DH-20261107-MULTIQUO-VALUE-INDEX-027. Merge coordinado a develop y master sujeto a CI y staging.

## [1.11.1] - 2026-11-07 (pendiente de CI/staging)

- Recupera todos los POE, navieras, Merchant/Carrier y las líneas persistidas al visualizar una multiQUO FCL; pantalla 8 ocupa todo el ancho y pantalla 9 presenta acordeones individuales de cada subQUO. Corrige saltos de línea comerciales.
- Release DH-20261107-MULTIQUO-PERSISTED-PDF-026; sin autorización de despliegue a producción.

## [1.11.0] - 2026-11-07 (en validación)

- Recupera POE/POD, navieras, importaciones y precios independientes de cada alternativa desde borradores.
- Corrige duplicación de flete FCL y recupera Merchant/Carrier y cargos opcionales.
- Amplía al ancho completo los campos de cliente y habilita navegación a subQUO guardadas.
- Envía multiQUO de 2 a 52 alternativas FCL en una transacción única de Pricing.
- Release coordinado DH-20261107-PRICING-MULTIQUO-025; CI y staging pendientes; producción no autorizada.


## [1.10.1] - 2026-11-07

- Corrige selección visual de tarifas FCL y agrega navegación sticky entre POE y navieras.
- Añade Merchant/Carrier Haulage en pantalla 7 por alternativa y rediseña pantalla 8 con acordeones y desglose comercial por subtarifa.
- Restringe las sub-QUO multi-POE a FCL; continúa pendiente el guardado transaccional.
## [1.10.0] - 2026-11-07

- Mantiene visibles y seleccionados los POE en pantalla 3, conserva su orden y ofrece regresar directamente a modificar POE o POD desde pantallas 5 a 8.
- Mueve Anterior POE, Siguiente POE y Configurar alternativas al encabezado de pantalla 5; habilita el mismo recorrido secuencial en la barra inferior.
- Aísla consultas de costos por POE, POD, naviera, agente, Incoterm, modalidad y servicios. Reintenta consultas fallidas, admite recarga manual y evita que respuestas tardías sobrescriban otra ruta.
- Conserva precios editados, cargos manuales y líneas al reconstruir los costos de cada combinación POE–naviera.
- Rediseña pantalla 8 en tarjetas de subtarifas con su costo, venta, utilidad, margen y desglose exclusivos; oculta totales y tablas de una sola tarifa cuando hay múltiples opciones.
- Añade pruebas de selección, navegación, edición de costos y vista agrupada. Mantiene pendiente el guardado transaccional de la QUO principal y sub-QUO en Pricing.

## [1.9.0] - 2026-11-07

- Rediseña pantalla 5 como selección secuencial por cada POE: tarifas preaprobadas y preautorizadas primero, y navieras sin tarifa en un panel manual opcional.
- Elimina la confirmación redundante «¿Desea añadir más navieras?»; el usuario marca todas las alternativas y continúa al siguiente POE.
- Las pantallas 6 y 7 recorren cada combinación POE–naviera una a una, preservando flete, agente, costos, moneda y fuente de cada opción; al completar todas pasa a pantalla 8.
- Agrega navegación anterior/siguiente por opción, recuperación de tarifas vigentes para POE nuevos y pruebas del recorrido Caldera → Balboa → Moín.
- Conserva el bloqueo de persistencia agrupada: el endpoint transaccional de tarifa principal y sub-QUO en Pricing aún es requisito antes de habilitar creación y despliegue.

## [1.8.0] - 2026-11-07

- La pantalla 5 permite seleccionar todas las navieras manualmente por POE mediante una lista visible con búsqueda, selección múltiple y contadores; convive con tarifas preaprobadas, preautorizadas y fletes capturados manualmente. Tras cada selección pregunta si desea añadir otra naviera o continuar.
- Evita cambios involuntarios de naviera al marcar o desmarcar opciones y conserva la fuente de cada tarifa y activa la primera combinación POE–naviera al continuar.
- Conserva agente, moneda, flete, venta, días, comentarios, costos configurados y líneas editadas por cada combinación POE–naviera al alternar.
- Reorganiza las pantallas 6 y 7 con identificación de la ruta activa, contador de alternativas y navegación anterior/siguiente; indica dónde ingresar flete y cargos independientes.
- Mantiene la compatibilidad de modalidades existentes y bloquea guardados comerciales parciales de grupos mientras Pricing no admita el endpoint transaccional.
- Agrega pruebas de selección manual, aislamiento y navegación; release DH-20261107-MANUAL-CARRIER-WIZARD-021.


## [1.7.0] - 2026-11-07

- Rediseña pantalla 3 para mostrar POE seleccionados en tarjetas numeradas, compactas y removibles; conserva buscador sin chips duplicados.
- Añade en pantalla 5 selección múltiple real de navieras por cada POE, con cobertura de destinos, filtro de tarifas separado y validación antes de continuar a Proveedor.
- Las tarjetas preaprobadas FCL agregan alternativas y no saltan directamente a pantalla 6; conserva la tarifa elegida por combinación POE–naviera.
- Añade pestañas por alternativa POE–naviera en pantallas 6–8 con flete, costos, agente, divisa y líneas de borrador aislados durante la sesión.
- Mantiene el guardado seguro: para grupos de alternativas el backend transaccional sigue pendiente y no debe crearse una tarifa parcial.
- Añade pruebas de normalización, rutas únicas y cobertura. Release DH-20261107-MULTI-POE-CARRIERS-020.


## [1.6.0] - 2026-11-07

- Permite seleccionar y quitar múltiples POE desde la pantalla 3 mediante un selector con búsqueda y chips.
- Incorpora pestañas por POE en pantallas 5–8, conserva flete, naviera y líneas de cada ruta al alternar, y evita resultados cruzados de consultas concurrentes.
- Protege el guardado: no se crea una única tarifa silenciosamente cuando el usuario seleccionó múltiples POE; la persistencia de sub-QUO agrupadas sigue pendiente de API transaccional en Pricing.
- Mantiene el flujo de selección simple para modificaciones y solicitudes del vendedor, con pruebas de regresión.
- Release coordinado DH-20261107-MULTI-POE-SELECTOR-019.


## [1.5.0] - 2026-11-06 (en desarrollo)

- Incorpora las reglas compartidas de identidad de sub-QUO A..Z/AA, combinaciones únicas POE/naviera/Merchant/Carrier y aceptación exclusiva en borradores.
- Añade regresiones de numeración, estabilidad y aislamiento de alternativas; la integración del wizard y el backend queda pendiente para el batch coordinado.
- Release DH-20261106-MULTI-QUO-018, en rama intermedia: no desplegado.


## [1.4.0] - 2026-11-06

- Añade ruta y comentarios de la naviera en pantalla 6, conserva ambos datos al editar y los envía al PDF de la cotización.
- Release coordinado DH-20261106-CARRIER-ROUTE-COMMENTS-017 con Pricing y Reports; mantiene separadas las rutas comercial y de la naviera.

## [1.3.7] - 2026-11-06

- Corrige la validación LCL que exigía una naviera oculta pese a seleccionar agente y moneda.
- Permite registrar explícitamente el punto de entrega o recolección sin exigir coordenadas del mapa.
- Guarda y recupera ambas direcciones en la QUO mediante DholePricingService 1.2.8.
- Muestra los campos realmente pendientes al continuar y añade pruebas de regresión.
- Registra el release global Dhole 1.3.14 (DH-20261106-PRICING-INLAND-LCL-016).

## [1.3.6] - 2026-11-06

- Coloca el nombre del cliente debajo de la QUO, en una línea propia con todo el ancho disponible, tanto en escritorio como en móvil.
- Evita que los nombres se compriman letra por letra en la lista de tarifas; añade una prueba de regresión del diseño.
- Incrementa DholeWeb a 1.3.6 (PATCH) y registra el release global Dhole 1.3.13 (DH-20261106-PRICING-QUO-CLIENT-015).

## [1.3.5] - 2026-11-06

- Muestra «Completada · requiere revisión» cuando Ollama terminó y falló una etapa posterior, sin llamar «Fallida» a la ejecución del modelo.
- Añade contador independiente de trabajos pendientes de revisión y mantiene los fallos reales en su categoría.
- Traduce los nuevos estados y explicaciones en español e inglés, incluyendo móvil y escritorio.
- Incluye regresiones para estado operativo y traducciones, con release global Dhole 1.3.11 (DH-20261106-AI-COMPLETED-REVIEW-013).

## [1.3.4] - 2026-11-06

- Separa Guardar tarifa de Enviar revisión al vendedor sin crear revisiones duplicadas.
- Valida la existencia de la función de envío después de las transformaciones del wizard y antes de compilar Vue; incorpora regresiones en CI.
- Renueva los recursos del frontend con versión PATCH para evitar un paquete JavaScript obsoleto.

## [1.3.3] - 2026-11-06

- Separates saving a Pricing seller-modification revision from explicitly sending it; the request remains open after save.
- Prevents the wizard from treating a backend auto-closed request as a successful send, and avoids duplicate quote revisions.
- Requires the operator to choose a cancellation reason and transmits explicit seller-modification cancellation intent.
- Adds regression checks for explicit completion, cancellation, and request dashboard refresh.


## [1.3.2] - 2026-11-06

- Corrige que Configuración desaparezca en celular: botón visible en la barra superior y acceso secundario en el menú lateral.
- Traduce de forma reactiva la bandeja de correos de Pricing, sus filtros, tablas, estados y panel de detalle, sin utilizar IA para traducir.
- Respeta EN/ES en fechas, estados de extracción y acciones; corrige la traducción invertida de «Operations Platform».
- Asegura tarjetas móviles para tablas operativas bajo 640 px y evita desbordamientos en el detalle del correo.
- Añade pruebas de regresión i18n/responsive y verificación obligatoria de CI.

## [1.3.1] - 2026-11-06

- Elimina la traducción por IA, su botón, eventos y dependencias de contenido.
- Completa traducciones ES/EN en navegación, dashboards, reportes y solicitudes de Pricing; formatos de fechas según idioma activo.
- Corrige responsive en celulares: barra de navegación, pestañas, formularios, tablas, modales y drawers; evita que el resumen fijo tape las acciones.
- Incorpora pruebas de regresión de idioma y diseño móvil en CI.

## [1.3.0] - 2026-11-05

- Convierte «Otras pestañas» en un panel integrado que no cubre el contenido, con navegación y cierre accesibles.
- Integra versiones verificadas del servicio y versiones declaradas en el manifiesto del release, señalando su origen.
- Agrega validaciones y pruebas de regresión para ambos cambios.

## [1.2.4] - 2026-11-05

- Actualiza DholeWeb SemVer 1.2.4 y manifiesto al release global Dhole 1.3.1.
- Verifica versión real del bundle sin número fijo y mantiene despliegue automático master/develop.

## [1.2.3] - 2026-11-05

- Asegurar que el botón Asignar IDTRA aparezca en Pantalla 9 para tarifas aceptadas sin identificador válido, incluyendo marcadores heredados como Pendiente.
- Separar visibilidad de permisos: si faltan permisos, mostrar botón deshabilitado con explicación.
- Validar en CI que el botón esté presente en el JavaScript final generado por Vite.

## [1.2.2] - 2026-11-05

- Corregir el error `if is already defined` que impedia iniciar el workflow de produccion.
- Restaurar la ejecucion del despliegue al integrar cambios en master, conservando la opcion de lanzamiento manual.
- Agregar una prueba de regresion para validar los disparadores y evitar condiciones duplicadas en el job.

## [1.2.1] - 2026-11-05

- Habilitar la asignación del IDTRA en la tarjeta Identificación de Pantalla 9, reutilizando el modal y endpoint existente para cotizaciones aceptadas sin IDTRA y refrescando los datos al guardar.

- Mostrar el cliente junto al número QUO con mayor jerarquía visual en escritorio y móvil.
- Ampliar la columna Tarifa sin perder etiquetas REV, SPOT/TARIFA, ruta ni IDTRA.

## [1.2.0] - 2026-11-05

- Add universal version governance, GitHub Actions release gate and permanent Codex policy.
- Synchronize DholeWeb version with the ecosystem release batch.

## [1.1.0] - 2026-11-05

- Mejoras responsive en formularios, tablas, diálogos y barra superior.
- Traducción unificada mediante diccionarios i18n de los módulos registrados.
- Traducción voluntaria de contenido visible con Dhole AI, con restauración del original y sin modificar formularios.

## [1.0.0] - 2026-11-04

- Inicio del versionamiento formal de Dhole Web bajo MAJOR.MINOR.PATCH.
- Información de versión y compilación visible en el sistema.
- Scripts para validación, actualización y registro de futuras versiones.

