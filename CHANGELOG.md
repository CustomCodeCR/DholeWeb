## [1.141.0] - 2026-11-26

- MINOR candidato: scopes granulares y controles DH independientes para consulta, asignación y remoción de miembros. CI y staging pendientes.

## [1.140.0] - 2026-11-26

- MINOR candidato: responsabilidades de equipos con DhSelect, integrantes agrupados por cargo, perfiles de scopes efectivos y acceso transversal separado del pool; nombres del catálogo simplificados sin alterar enrutamiento. Conserva supervisión anterior y sincronización realtime. CI y staging pendientes.

## [1.139.0] - 2026-11-26

- MINOR: interfaz DH de equipos informa la asignación y retirada automática de scopes según membresía y responsabilidad. Conserva permisos independientes y los componentes existentes. CI y staging pendientes.

## [1.138.0] - 2026-11-26

- MINOR candidato: perfiles de scopes de equipo visibles mediante DhBadge y componentes existentes, distinguiendo recomendaciones y permisos efectivos. Origen permite WHS LCL, booking aéreo y recolecta declarada. Sin otorgamiento automático, sin alterar Pricing/CRM ni confirmar salida ficticia; CI y staging pendientes.

## [1.137.4] - 2026-11-26

- Operations: prioritize route, cargo, services, responsible team, QUO and pending validation in the detail and quick drawer; distinguish estimated and actual weight, combine measurement units and use backend applicability; keep existing DH controls, permissions and realtime reads.

## [1.137.3] - 2026-11-26

- PATCH: DH-20261126-PRICING-MULTIPLE-IDTRA. Pricing P9 presenta IDTRAs confirmados en una tarjeta DH independiente con contador, apertura manual/automática, estado, equipo y navegación individual; expansión para más de tres expedientes, referencias históricas separadas y sin duplicar coincidencias exactas; vinculación manual en tarjeta independiente. Conserva permisos, contratos y refresco realtime. CI y staging pendientes.

## [1.137.2] - 2026-11-26

- PATCH: DH-20261126-MANUAL-QUO-FIRST. Buscador de QUO aceptadas al inicio de la apertura manual, sin exigir cliente ni modalidad previos; selección explícita y consulta del detalle de Pricing para precargar cliente, modalidad, Incoterm, POL/POE/POD, naviera, agente, WHS, bultos, peso estimado, volumen, equipos, servicios y ubicaciones inland disponibles; recuperación de borradores antiguos y botón de recarga. Respeta datos ya elegidos, permisos y vínculo transaccional existente. Aceptación automática de otras QUO fuera de este incremento; CI y staging pendientes.

## [1.137.1] - 2026-11-26

- PATCH: DH-20261126-STAGING-DOCKER-DNS. Staging conserva la caché de Docker y prueba DNS desde la imagen Node; usa red host únicamente si la red bridge falla y host resuelve npm. No cambia DNS global, producción, dependencias ni contratos REST/realtime. CI y staging pendientes. La aceptación de QUO aún no aceptadas sigue pendiente.

## [1.137.0] - 2026-11-26

- MINOR (WIP, no integrar): DH-20261126-OPS-QUO-OPENING. Selector opcional de QUO aceptada durante apertura manual, persistencia del borrador, revisión y vista previa del vínculo en expediente. Pendientes aceptación de QUO no aceptada, pruebas CI y staging.

## [1.136.2] - 2026-11-26

- PATCH: DH-20261126-OPS-WHS-AGENT-METADATA. Reconoce las relaciones WHS existentes en Config (agentId, agentCode, agentCodes, agentName y agentNames). Distingue Xiamen WWL de RS Logistics, excluye otros propietarios y muestra agente y código cuando haya etiquetas repetidas. Conserva IDs físicos y almacenes realmente sin asignar; sin cambios de datos maestros. CI y staging pendientes.

## [1.136.1] - 2026-11-26

- PATCH: DH-20261126-OPS-WHS-LEGACY-OPTIONS. Selector WHS visible tras elegir agente, muestra primero almacenes vinculados y recupera almacenes históricos sin propietario del país de origen o sin país identificado. Identifica ausencia de vínculo, excluye propietarios incompatibles, mantiene el agente del trámite y no cambia Config. CI y staging pendientes.

## [1.136.0] - 2026-11-26

- DH-20261126-OPS-WHS-AGENT-RECONCILED: selección de agente antes del WHS, filtro por identidad de Config, limpieza de WHS incompatibles y resumen del agente. Catálogo WHS permite asociar un agente real, incluso en almacenes genéricos. Conserva release de reportes 1.135.0. CI y staging pendientes.

## [1.135.0] - 2026-11-26

- MINOR: DH-20261126-PRICING-CATEGORY-REPORT. Exportar Excel por categoría con permiso independiente; conserva el reporte comercial detallado. CI y staging pendientes.

## [1.134.1] - 2026-11-26

- PATCH: DH-20261126-OPS-WHS-DROPDOWN-LAYER. El selector WHS abre por encima de la tarjeta de equipo, sin recorte por DhCard y sin alterar los demás selectores. Regresión de apertura/cierre incluida; CI y staging pendientes.

## [1.134.0] - 2026-11-26

- DH-20261126-OPS-MANUAL-WHS-ROUTING: apertura manual con WHS LCL/LTL y FCL/FTL FCA, selección de modalidad y embarque mediante DhSelect, equivalencias junto a carga, validación visible y resumen del equipo previsto. El envío sigue delegado a Operations y conserva autoguardado. CI y staging pendientes.

## [1.133.1] - 2026-11-25

- PATCH: revisión de apertura manual con tarjetas DH, datos básicos por sección, asignación real por pool y únicamente campos bloqueantes. Mantiene validación de servidor y revisión histórica. CI/staging pendientes.

## [1.133.0] - 2026-11-25

- Move optional PO and invoice references to the existing Origin planning form; retain PO read-only in opening edits.

- Candidato: simplificar la apertura manual a cliente, ruta, servicios, bultos, volumen, peso y equipos; WHS para LCL/LTL y naviera para FCL. Mantener campos históricos en edición. La selección inicial de estado, asignación explícita y aceptación/revinculación QUO siguen pendientes; no promover.

## [1.132.3] - 2026-11-25

- DH-20261125-FTL-CUSTOMS-SCOPE: separar CUSTOMS_FOREIGN de CUSTOMS_CR en pantalla 7 y guardado; aliases históricos requieren país explícito. Conservar RateDetails FTL negociados en cambios exclusivos de agente elegible, sin tratar la naviera oculta como cambio de contexto. Regresiones incluidas; CI/staging pendientes.

## [1.132.2] - 2026-11-25

- DH-20261125-FTL-PERSISTED-AGENT-P6: recuperar el agente FTL persistido en consulta y edición sin sustituir su ID; respetar el filtro de país en nuevas rutas. Permitir revisar las líneas de pantalla 7 sin bloquear por el catálogo; la verificación final de contexto permanece en guardado. Pruebas de regresión incluidas; CI y staging pendientes.

## [1.132.1] - 2026-11-25
- Resolve service names using the shared catalog in case drawer and detail.
- Compact Aperturas validation with DH tabs and edit action.
- Move operational dates and consolidation to Origin.

## [1.132.0] - 2026-11-25

- Captura exclusiva del peso real desde Coordinación Origen, con componentes DH y comparación en kg.
- Unidades originales de dimensiones y equivalencias de peso y volumen en Aperturas.
- Justificación obligatoria para revisiones comerciales de discrepancias.
- Candidato parcial pendiente de CI y staging.

## [1.131.0] - 2026-11-25

- Filter opening agents by origin coverage, use shared searchable DH selects and compact the case summary.
- Link accepted QUOs to existing manual IDTRA from both modules with explicit pending/confirmed states and preserve prior references. CI and staging pending.

## [1.130.1] - 2026-11-25

- Restore opening service/provider capture, observations and compact grouped completeness review. Preserve all-status quotation export. CI/staging pending.

## [1.130.0] - 2026-11-25

- MINOR: exportación de Tarifas con las 23 columnas del reporte de cotizaciones y filtros de estado, fecha de creación y búsqueda. Mantiene el botón DH y permisos existentes. CI y staging pendientes.

## [1.129.3] - 2026-11-25

- Show server-calculated individual opening field states using shared DH badges; preserve draft and realtime contracts, and prevent approval with blocking fields. CI and staging pending.

## [1.127.4] - 2026-11-25

- Route Operations SignalR through trusted same-origin Gateway, reconcile after reconnect, refresh dashboard and case list, and validate the handoff regression. Preserves Pricing IDTRA release 1.127.3. CI/staging pending.

## [1.127.3] - 2026-11-25

- PATCH: el listado de Pricing consulta los IDTRA reales de Operations para la alternativa aceptada, incluye múltiples expedientes, conserva referencias históricas y distingue fallos de consulta. Retira la acción manual del flujo automático y concilia mediante SignalR y REST autorizados. CI y staging pendientes.

## [1.127.2] - 2026-11-25

- Subscribe the Operations dashboard to the existing authenticated SignalR Hub and reconcile after reconnect; refresh counters and recent openings through debounced authorized REST without clearing the current team snapshot during background refresh. Reuse existing DH components. CI and staging pending.

## [1.127.1] - 2026-11-25

- DH-20261125-PRICING-WIZARD-CONTEXT-P6: preserve the full canonical Pricing context through Vite runtime transforms, reject stale P6 responses explicitly, and restore Merchant/Carrier costs from the same wizard-bundle snapshot. Regression tests cover MSC Caldera, alternate routes, equipment, weight and customer identity. Existing REST, realtime and visual contracts unchanged. CI and staging pending.

## [1.127.0] - 2026-11-25

- Add optional Booking Request Shipper document category in Pricing screen 4, reusing the existing Storage upload and document metadata. CI and staging pending.

## [1.126.4] - 2026-11-25

- PATCH DH-20261125-OWN-LCL-DRAWER: mover creación, edición y consulta de consolidados LCL propios al DhDrawer compartido, con DhTabs para datos/costos, tarifario, FOB por país y QUOs vinculadas; pie de acciones fijo y permisos existentes. Sin cambios de contratos REST ni cálculos. CI y staging pendientes.

## [1.126.3] - 2026-11-25

- DH-20261125-OWN-LCL-WIZARD-BUNDLE: use /api/pricing/costs/wizard-bundle for own LCL destination charges with real selected context, show approved fallback provenance, retain saved tariff lines. CI/staging pending.

## [1.126.1] - 2026-11-25

- DH-20261125-OWN-LCL-MAERSK-BALBOA: load draft own-LCL pricing lines from Pricing API, surface destination/line load errors and reject stale preview responses. Preserve manual edits and existing DH components. CI/staging pending.

## [1.126.0] - 2026-11-24

- Display accepted-quote cost categories, charging units, scoped sale/tax totals and commercial conditions using existing DH tables/cards. Resolve catalog Incoterms using Pricing helper, align FCA and maritime-only rules, and capture pickup fields using existing DH controls. CI and visual/realtime staging pending.

- Fix approved-opening exit, reuse the Operations workspace tab, use shared DH pagination and synchronize team selection with its department.

## [1.125.0] - 2026-11-24

- Coordinated ecosystem version for multiple IDTRAs per accepted quotation. Existing DH Trámites list and individual IDTRA case routes retained.
- CI and staging verification pending.

## [1.124.34] - 2026-11-24

- Replace dual approval UI and counters with single-review workflow and direct Origin handoff. Preserve DH components and historical audit compatibility.
- CI and authenticated staging pending.

## [1.124.33] - 2026-11-24

- Show only the authorized active aperture decision, reload validation on case version changes, and use the shared DH controls to open and download linked Pricing documents.
- Candidate: CI and authenticated staging validation pending.

## [1.124.32] - 2026-11-24

- DH-20261124-PRICING-AIR-QUANTITY-SAVE: conservar precios unitarios negociados al editar agente elegible, peso y cantidades de carga de una cotización aérea existente, incluso combinados; recalcular cantidades mediante el flujo existente, mantener validación de ruta/servicios y respetar eliminaciones explícitas. Regresiones añadidas; CI/staging pendientes.

## [1.124.31] - 2026-11-24

- DH-20261124-PRICING-AIR-AGENT-SAVE: en cotizaciones aéreas existentes, conservar costos negociados al cambiar únicamente a un agente válido; evitar recalcular el catálogo para guardar, prevenir sustitución automática del agente en la misma ruta y mantener validaciones de cambios físicos adicionales. Regresiones incluidas; CI/staging pendientes.

## [1.124.30] - 2026-11-24

- DH-20261124-PRICING-EDIT-CONTEXT-NORMALIZATION: normalizar referencias equivalentes de edición y excluir fuentes FCL marítimas residuales en cotizaciones aéreas, terrestres y LCL; conservar cambios reales sujetos a consulta de costos y mostrar la causa específica del bloqueo de guardado. Pruebas de regresión incorporadas; CI, staging y manifiesto central pendientes.

## [1.124.29] - 2026-11-24

- DH-20261124-PRICING-COST-CONTEXT-RELINK: conservar operación al reseleccionar el cliente de la QUO; separar identidad CRM de la consulta física de cargos en edición; reutilizar reconciliación P7 verificada para la misma configuración; esperar actualización de Vue antes de capturar contexto y guardar. Mantener bloqueo para cambios de transporte no verificados. CI y staging pendientes.

## [1.124.28] - 2026-11-24

- DH-20261124-PRICING-DUPLICATE-RELINK: recuperar automáticamente vínculos CRM perdidos por duplicaciones anteriores al guardar una QUO. Exigir coincidencia exacta única, propietario comercial coincidente, consulta completa, verificación por ID y ausencia de cambios concurrentes; persistir el vínculo en el PUT normal. Pruebas de regresión; CI/staging pendientes.

## [1.124.27] - 2026-11-24

- DH-20261124-PRICING-HISTORICAL-EDIT: mostrar el error específico y solicitar el vínculo CRM explícito en duplicados afectados; capturar contexto de todas las modalidades al finalizar hidratación, reintentar una consulta de costos transitoria sin omitir validación de cambios reales. Pruebas de regresión añadidas; CI, manifiesto central y staging pendientes.

## [1.124.26] - 2026-11-24

- DH-20261124-VERSION-CARD-FIX: corregir encabezado duplicado de DhCard causado por la prop title; tooltip nativo en contenido interno, ancho ajustado al texto, altura alineada con controles y dos líneas compactas. Sin cambios en otros consumidores de DhCard. CI/staging pendientes.

## [1.124.25] - 2026-11-24

- DH-20261124-TOPBAR-VERSION-CARD: reutilizar DhCard con padding compacto compatible para mostrar versión entre notificaciones y usuario; canal en segunda línea fuera de producción y tooltip existente en pantallas estrechas. Centrar el logo del sidebar en el card completo con espacio simétrico para los controles y conservar su transición. CI/staging pendientes.

## [1.124.24] - 2026-11-24

- DH-20261124-TOPBAR-VERSION: retirar versión del sidebar y mostrarla discretamente en la barra superior, entre búsqueda y acciones; en pantallas estrechas consultar detalle mediante tooltip de configuración. Logo y animación sin cambios. CI/staging pendientes.

## [1.124.23] - 2026-11-24

- DH-20261124-SIDEBAR-VERSION-FOOTER: trasladar versión y canal al pie fijo del sidebar; modo compacto con icono informativo y tooltip de versión/commit. Logo, animación, login y contratos sin cambios. CI/staging pendientes.

## [1.124.22] - 2026-11-24

- DH-20261124-SIDEBAR-BRAND-MOTION: reducir 15% el logotipo del sidebar en ambos estados y animar su transición con el ancho del menú, respetando movimiento reducido. SVG, favicon, login y tooltip sin cambios. CI/staging pendientes.

## [1.124.21] - 2026-11-24

- DH-20261124-EXACT-SVG-LOGO: usar exactamente dhole-erp(1).svg entregado por el usuario; colores dinámicos mediante CSS, favicon transparente con rojo original #A90E19. Sin reconstruir los trazados. Descripciones de marca solo en tooltip sobre logo; se conserva versión visible. CI/staging pendientes.

## [1.124.20] - 2026-11-24

- DH-20261124-OFFICIAL-SQUARE-LOGO: geometría rectangular del logo oficial, O cuadrada, logotipo completo en menú expandido e inicio de sesión, símbolo compacto y favicon rojo original transparente. CI/staging pendientes.

## [1.124.19] - 2026-11-24

- DH-20261124-THEME-LOGO: nuevo logotipo SVG sin fondo, color primario y texto del tema, favicon ICO rojo original; regresiones de identidad visual. CI y staging pendientes.

## [1.124.18] - 2026-11-24

- DH-20261124-LCL-DIRECT-STEP6-COST: habilitar edición de costo de flete de coloader en cotizaciones existentes al entrar directamente a pantalla 6, sin desbloquear tarifas maestras de creación ni acceso de solo lectura/ventas. Prueba de regresión obligatoria en prebuild; CI y staging pendientes.

## [1.124.17] - 2026-11-24

- DH-20261124-LCL-EDIT-COST: normalizar el contexto LCL al terminar la hidratación, compartir reconciliaciones simultáneas y permitir revisar líneas de una cotización persistida ante fallas transitorias del catálogo; conservar validación previa al guardado y agregar regresiones. CI y staging pendientes.

## [1.124.16] - 2026-11-24

- DH-20261124-PERSISTED-DETAIL-IDENTITY: recuperar identidad original de cargos históricos obligatorios en revisiones sin cambio de contexto; reconocer flete CFZ–GAM sin marcador histórico y separarlo de Merchant/Naviera. Validar el mismo snapshot que se serializa, respetar eliminaciones explícitas y evitar duplicados. Pruebas de regresión añadidas; CI/staging pendientes.

## [1.124.15] - 2026-11-24

- DH-20261124-INLAND-PERSISTED-EDIT: conservar Inland Merchant/Naviera persistido al modificar cotizaciones, incluso Variable sin CostId. Recuperar el detalle original y sus precios sin duplicar el flete terrestre independiente; respetar eliminaciones explícitas. Prueba de regresión P6/P7; CI y staging pendientes.

## [1.124.11] - 2026-11-24 · DH-20261124-INLAND-AUTO-SELECTION

## [1.124.14] - 2026-11-24

- DH-20261124-EXPIRED-APPROVAL-TRANSACTION: sincronización obligatoria de versión con el ecosistema para la corrección de transacciones de autorización en Pricing 1.29.10; no hay cambios funcionales de frontend.


## [1.124.13] - 2026-11-24

- DH-20261124-EXPIRED-APPROVAL-ACCESS: historial de motivos y decisiones de vencimiento accesible en el detalle comercial y el historial de cotización, incluso tras renovar; reutiliza modal DH y SignalR. Pruebas de aprobación agregadas al CI de Pricing.


## [1.124.12] - 2026-11-24

- DH-20261124-EXPIRED-REASON-MODAL: mostrar siempre el campo de justificación de vencimiento salvo autorización pendiente/aprobada confirmada; manejar respuestas inválidas, errores y reintentos sin perder el texto; reutilizar DhTextarea/DhButton y mencionar únicamente a jefatura. El backend mantiene sus permisos, persistencia y notificaciones existentes.


- PATCH: restablece selección automática de inland Merchant/Naviera en P6 de cotizaciones editables persistidas cuando no existe una elección válida; usa la única alternativa o la de menor costo. Mantiene elecciones válidas, vista de solo lectura y conciliación histórica DH-387. El mensaje de selección automática requiere una elección real. Regresión DH-389 ampliada; CI/staging pendientes. Sin cambios REST, SignalR ni BD.

## [1.124.10] - 2026-11-24 · DH-20261124-PRICING-PANAMA-ROAD-DEDUP

- PATCH: concilia el tramo histórico CFZ–GAM con alias generados incluso si tienen CostId; bloquea su regeneración en P7, conserva excedente y valores negociados, y serializa ID e importes del mismo snapshot. Evita dos fletes de USD 2.140 y una segunda asignación Freight para un 40HC. Sin cambio de API, BD o realtime. CI/staging pendientes.

## [1.124.9] - 2026-11-24 · DH-20261124-GLOBAL-COMMERCIAL-ACTIONS

- PATCH: usuarios comerciales con view-all y create pueden solicitar modificaciones y renovaciones y aceptar/rechazar cotizaciones ajenas, conservando titularidad, estados, aprobación y componentes DH. CI y staging pendientes.

## [1.124.8] - 2026-11-24 · DH-20261124-PRICING-PANAMA-PERSISTED-SAVE

- PATCH: conserva el RateDetailId del tramo terrestre CFZ → GAM de USD 2.140 al editar; evita aliases duplicados, mantiene venta negociada del excedente y concilia antes de serializar. La edición manual no dispara Auto Pricing automáticamente; se conserva el cálculo explícito. Pruebas de regresión agregadas. Sin cambio REST, realtime ni base de datos. CI/staging pendientes.

## [1.124.7] - 2026-11-24 · DH-20261124-PRICING-PANAMA-EXCESS-EDIT

- PATCH: conserva los cuatro cargos del excedente Panamá en FCL al editar, separa el flete del excedente de Merchant/Naviera y recupera detalles históricos por ID sin duplicarlos ni ignorar eliminaciones explícitas. No recalcula por la hidratación del indicador de sobrepeso.
- Regresión incluida en prebuild. Sin cambios de API, base de datos o realtime. CI y staging pendientes.

## [1.124.6] - 2026-11-24 · DH-20261124-PRICING-LCL-EDIT-NAV

- PATCH: permite P6 → P7 en cotizaciones LCL persistidas y editables (incluidas duplicadas), sin exigir naviera ni selección de tarifa nueva; valida agente, moneda e importes y ejecuta conciliación DH-387 antes de avanzar. Conserva detalles y precisión decimal. Los errores de conciliación se notifican; las nuevas cotizaciones mantienen las validaciones existentes.
- DholeWeb/DholeSystem 1.124.5 → 1.124.6; sin cambio REST, realtime ni base de datos. Regresión agregada al gate existente. CI y staging pendientes.

## [1.124.4] - 2026-11-24 · DH-20261124-OPENINGS-IDTRA-GUARD

## [1.124.5] - 2026-11-24

- DH-20261124-SELLER-EXPIRED-RENEWAL: conectar dashboard móvil/escritorio y detalle de ventas con la autorización existente de jefatura; permitir continuar con actualización sin cambiar carga tras aprobación; refrescar decisiones por notificaciones realtime.
- Candidato pendiente de CI y staging.

- PATCH: distingue la omisión de un correo de Aperturas por IDTRA asignado de una notificación realmente encolada. Reutiliza DhModal, DhSelect, DhButton y el toast existente. Conserva el reenvío comercial. CI y staging pendientes.

## [1.124.3] - 2026-11-24 · DH-20261124-PRICING-SENT-CRM-FIX

- PATCH de sincronización de versión Web/System para el hotfix de transición Sent de Pricing. Sin cambios de interfaz, lógica ni contratos REST/realtime.

## [1.124.2] - 2026-11-24

- Scope operational views by assignment, expose automatic opening review, and send manual openings directly to origin.

## [1.124.1] - 2026-11-24 · DH-20261124-SELLER-ACCEPTANCE-FIX

- PATCH coordinado: sincronización Web/System para la corrección de registro de aceptación de QUO en DholePricingService. Sin cambios visuales, componentes DH ni payload REST. CI y staging pendientes.

## [1.124.0] - 2026-11-24

- MINOR: resumen de QUO original, semáforo comparativo, historial y solicitud de recotización, contactos CRM del expediente y drawer. Se elimina el formulario de servicios adicionales y la prioridad/complejidad visibles (se conservan métricas del pool). Reutiliza componentes DH. Sin alteración de la QUO original.

## [1.123.3] - 2026-11-24

- Mostrar ambos validadores del pool y nombres autorizados de responsables y clientes sin exigir acceso al módulo CRM ni ampliar scopes. Reutiliza tablas y tarjetas DH.

## [1.123.2] - 2026-11-24

- Mostrar número de QUO, opción aceptada, datos de snapshot y rubros originales; resolver Incoterm/moneda mediante catálogos y eliminar identificadores técnicos de las vistas operativas. Sin sustituir datos de revisiones históricas por datos actuales.

- Alineación del release de orden numérico descendente de Trámites; sin cambios visuales ni contratos.

## [1.123.1] - 2026-11-24

- Alineación de metadatos del frontend con el release coordinado de corrección del importador histórico IDTRA; sin cambios de interfaz ni contratos.

## [1.123.0] - 2026-11-24 · DH-20261124-OPS-HISTORICAL-IDTRA

- MINOR candidato: configuración interna de próximo IDTRA para superusuarios, con motivo, previsualización y control de concurrencia; reutiliza DhDrawer/DhInput/DhTextarea/DhButton. No modifica cotizaciones ni consecutivos existentes.
- Release coordinado con Pricing y Operations para migración histórica. CI y staging pendientes.

## [1.122.5] - 2026-11-24 · DH-20261124-OPS-IDTRA-STATUS

- PATCH: Pricing P9 consulta Operations mediante QUO padre y opción aceptada, con permiso de lectura, reintentos acotados y refresco SignalR. Muestra IDTRA real y acceso directo; distingue ausencia de expediente, falta de permiso y error de consulta. Conserva referencias históricas y no crea ni duplica IDTRA desde Web.
- CI y staging pendientes. No altera contratos REST ni producción.

## [1.122.4] - 2026-11-24 · DH-20261124-OPS-WORKSPACE-UI

- PATCH: compacta resumen del IDTRA, prioriza validaciones y pendientes, muestra ruta y cliente sin truncar, cambia rubros y dashboard a DhDataTable y corrige transparencia de DhDrawer mediante token de tema. No altera snapshots ni permisos.
- Candidato visual para develop; CI, pruebas de temas y staging pendientes; producción no autorizada.

## [1.122.3] - 2026-11-24 · DH-20261124-OPS-QUOTE-ACCEPTANCE-440

- PATCH crítico de aceptación comercial → Aperturas: la QUO se aceptaba correctamente, pero Operations no creaba IDTRA por falta de configuración explícita de su worker, ausencia de lector CRM y cliente no vinculado en tarifas históricas. Se añade resolución CRM estricta y reutilización de Inbox pendiente, con validación de escenario en staging.
- La pantalla Pricing P9 realmente montada elimina Asignar IDTRA manual y deja estado veraz Sincronización con Operations por verificar; Trámites sigue disponible. Componentes DH reutilizados y sin cambio de estilo.
- Web/System 1.122.2 → 1.122.3, Operations 0.19.0 → 0.19.1, CRM 1.44.0 → 1.44.1, Pricing sin cambio de versión. Se prueban compilación, políticas, contratos de UI y seguridad Auth. Prueba efectiva con QUO aceptada pendiente.
- Solo candidato para develop/staging. No modificar master ni desplegar producción.

## [1.122.2] - 2026-11-23 · DH-20261124-PRICING-ACTIVE-WIZARD-IDTRA-439

- PATCH: corrige el wizard realmente utilizado por /pricing/rates/:rateId/wizard (PricingOverviewView → PricingAlternativeWizardCrystal). El parche 1.122.1 había cambiado solo el wizard alternativo no montado.
- Pantalla 9 ya no solicita ni envía manualmente IDTRA al aceptar la QUO; mantiene selección de alternativa A/B y referencias externas opcionales. Operations genera el IDTRA desde la aceptación definitiva usando Outbox/Inbox.
- Pantalla 8 solo exhibe IDTRA históricos sin edición. Pantalla 9 informa que el IDTRA se genera en Operations y enlaza al listado de Trámites para el usuario autorizado.
- Regresión automatizada verifica ruta Vue real, componente montado, payload de aceptación y ausencia de campo IDTRA manual. Reutiliza exclusivamente componentes DH.
- Web/System 1.122.1 → 1.122.2, Pricing 1.28.0, Operations 0.19.0, CRM 1.44.0 sin cambios. Configuración real CRM/Redis y creación IDTRA en staging deben verificarse; master y producción no autorizados.

## [1.122.1] - 2026-11-23 · DH-20261123-PRICING-AUTO-IDTRA-438

- PATCH: elimina la solicitud de IDTRA manual en pantalla 9 (aceptación comercial) y del resumen previo. Operations es el responsable único de generar el consecutivo del trámite al consumir el evento de aceptación definitiva de Pricing.
- La acción comercial envía únicamente estado AcceptedByClient y otras referencias opcionales; no envía ni inventa idtraNumber. Los IDTRA históricos ya asociados se visualizan sin edición en el resumen.
- Reutiliza DhTextarea/DhButton del diseño DH; agrega prueba de regresión de UI y contrato. Versiones DholeWeb/DholeSystem 1.122.0 → 1.122.1; Pricing, Operations y 13 componentes restantes sin cambios.
- Integración real Redis/CRM/Operations y despliegue en staging sujetos a verificación; sin cambios en master ni producción.

## [1.122.0] - 2026-11-23 · DH-20261123-OPS-AUTOSAVE-434

- MINOR candidato: Aperturas manuales autoguarda borradores incompletos en PostgreSQL por usuario/empresa, con recuperación remota, copia local y control de conflictos.
- Expediente Operations distingue servicios QUOTED y OPERATIONS_ADDED, muestra alertas amarillas y permite solicitar revisión comercial; Pricing muestra bandeja paginada y modal DH para resolución controlada.
- Reutiliza exclusivamente componentes compartidos DH. Regresiones de autosave, alertas y bandeja Pricing integradas en prebuild; CI Web completado correctamente.
- DholeWeb/DholeSystem 1.120.11 → 1.122.0, Operations 0.18.0 → 0.19.0, Pricing 1.27.1 → 1.28.0 y CRM 1.43.1 → 1.44.0; 12 componentes sin cambios.
- PR borrador hacia develop, sin merge; CI Pricing de snapshot EF fallido y UAT/staging pendiente; sin cambios en master/producción.

## [1.120.11] - 2026-11-23 · DH-20261123-PRICING-LCL-INCH-PERSISTENCE-432

- PATCH: corrige la persistencia de dimensiones LCL/LTL en Pricing. Las líneas conservan su unidad interna durante el guardado aunque POL/catálogos se rehidraten; únicamente una transición explícita de origen transforma la representación interna.
- El payload REST continúa enviando largo/ancho/alto en centímetros y el formulario sigue mostrando la unidad elegida (pulgadas, centímetros, metros o milímetros), preservando peso y reglas de CFT/CBM.
- Regresión automatizada reproduce las cinco tarimas del caso Miami (50 × 44 × 29 in y otras cuatro líneas), con 68.248 CFT antes/después de cambios de contexto; incluida en prebuild.
- Versión global DHOLE/DholeWeb 1.120.10 → 1.120.11; PricingService y demás servicios sin cambios de contrato ni versión. CI, staging y promoción pendientes; producción no autorizada.

## [1.120.10] - 2026-11-23 · DH-20261123-CRM-LEAD-AUDIT-431

- PATCH: Prospectos incorpora Historial de cambios independiente del Historial de rutas, con la misma línea de tiempo de Cuentas, usuario, fecha, cambios antes/después, actualización y paginación DhPagination. Reutiliza los tokens y componentes DH existentes en ambos temas.
- Consume GET /api/crm/leads/{id}/change-history del servicio CRM autorizado; maneja errores y navegación entre prospectos sin mezclar resultados. Versiones coordinadas CRM 1.43.1 y Web/ecosistema 1.120.10; otros componentes sin cambios.
- CI y staging pendientes; promoción a master solo después de validación. Despliegue de producción no autorizado.

## [1.120.9] - 2026-11-23 · DH-20261123-PRICING-MODIFICATION-422

- PATCH: la comparación de modificaciones de Ventas muestra la modalidad y el tipo de embarque cuando el valor original puede verificarse.
- Al modificar una QUO guardada, Pantalla 7 conserva las líneas persistidas, CostIds y RateDetailIds aunque cambien condiciones o catálogo; identifica cargos excluidos y alinea los IDs con el orden financiero del payload. Protege la eliminación explícita de cargos y la edición aduanal, terrestre y LCL propio.
- Reconciliado sobre la base 1.120.8 de IVA POL/POE para no revertir ese release; pruebas DH-422 en CI. DholeSystem y DholeWeb 1.120.8→1.120.9, otros 15 componentes sin cambios.
- CI y staging pendientes; deploy de producción sólo tras validaciones.

## [1.120.8] - 2026-11-23

- PATCH DH-20261123-PRICING-VAT-RELEASE-430: IVA de los rubros por jurisdicción del POL para origen/recolecta y del POE para destino/entrega; flete según importación/exportación y alternativa multi-POE. Se aplica la tasa configurada por país sin usar el POD global.
- Corrección del estado del checkbox IVA al cambiar puertos y ajuste de las validaciones del wizard para evitar regresiones en creación y edición.
- Reutilización de componentes DH y contrato REST de Pricing sin cambios; pruebas de integración, versión y staging obligatorias antes de producción.

## [1.120.7] - 2026-11-23 · DH-20261123-PRICING-LTL-EDIT-NAV-422

- PATCH: en edición de QUO LTL terrestre existente, Pantalla 6 permite avanzar a Pantalla 7 sin depender de la validación de tarifa nueva `canNext`. Se usa el snapshot persistido para revisar cargos sin reimportar ni recalcular los fletes al navegar.
- La ruta sigue exigiendo una tarifa persistida hidratada, no habilita la navegación comercial ni las cotizaciones nuevas; conserva las validaciones al guardar y el procesamiento de cambios por Outbox/Inbox existentes.
- Regresión DH-422 ejecuta el manejador `next()` generado con `canNext=false`, comprueba no mutación de detalles y casos negativos; incluida en prebuild y tests Pricing.
- DholeWeb y DholeSystem: 1.120.6 → 1.120.7; otros servicios sin cambios. CI y pruebas de staging pendientes; producción no autorizada para este nuevo release.

## [1.120.6] - 2026-11-23 · DH-20261123-PRICING-EDIT-STEP6-421

- PATCH: al editar una cotización ya guardada, Pantalla 6 (flete terrestre LTL/FTL) permite avanzar a Pantalla 7 sin los controles de completitud exclusivos de creación; conserva las líneas persistidas, su agente, moneda y montos.
- La validación de cotizaciones nuevas y la validación al guardar siguen activas. Incluye regresión Vite DH-421 en CI. Sin cambios REST, BD, realtime ni componentes visuales DH.
- Preserva la corrección independiente de IVA por POL/POE de DholeWeb 1.120.5 y reserva 1.120.6 para DholeWeb/DholeSystem; otros 15 componentes sin cambios.
- CI/staging pendientes; producción no autorizada.

## [1.120.5] - 2026-11-23

- PATCH DH-20261123-PRICING-POL-POE-VAT-420: sincroniza el número de versión del release de IVA POL/POE entre DholeWeb y DholeSystem tras la integración simultánea de otro release 1.120.4 en System. Se conserva sin modificar la funcionalidad de IVA ya integrada.

## [1.120.4] - 2026-11-23

- PATCH DH-20261123-PRICING-POL-POE-VAT-420: IVA en Pantalla 7 por jurisdicción física (POL en origen y recolecta, POE en destino y entrega); flete internacional con sentido comercial importación/exportación, sin tasa automática para tránsito indeterminado.
- Las alternativas multi-POE calculan el IVA desde su propio POE y todos los rubros conservan su selección de IVA, su moneda y los contratos REST existentes.
- Pruebas de tasas configuradas, tasa cero, rutas desconocidas y verificación de runtime Vite; sin componentes visuales nuevos.

## [1.120.3] - 2026-11-23 · DH-20261123-CORS-PREFLIGHT-419

- PATCH: enrutar llamadas API de dominios oficiales production/staging bajo el mismo origen Web usando el proxy nginx existente hacia DholeApiGateway; conserva orígenes personalizados, REST, JWT y rutas SignalR existentes.
- Reutilizar catálogos por sesión e impersonación, con deduplicación de GET simultáneos, TTL de 60 segundos, invalidación por modificaciones locales de catálogos y cambios de sesión.
- Actualizar clientes de JSON, descargas y Storage, manteniendo el tratamiento especializado del endpoint Hacienda y límites de carga controlados.
- DholeWeb/ecosistema 1.120.2 → 1.120.3; DholeApiGateway 1.11.0 → 1.11.1 en release coordinado; demás microservicios sin cambios. Sin nuevas librerías ni componentes DH.
- Validación requerida: nginx -t, type-check, compilación, tests de regresión, CI y pruebas staging; no despliegue de producción sin autorización.

## [1.120.2] - 2026-11-23 · DH-20261123-PRICING-LTL-NUMERIC-418

- PATCH: corregir el error silencioso al guardar consolidados LTL cuando Vue convierte campos number a valores numéricos y la validación intenta ejecutar .trim() sobre ellos antes del POST.
- Normalizar costo, venta, mínimo y cargos variables (string/number) de manera segura, informar errores de validación por campo y capturar fallos inesperados antes de crear la ruta.
- Agregar prueba ejecutable de regresión al prebuild que cubre entradas numéricas nativas, cargos variables y flujo de creación.
- DholeWeb y DholeSystem 1.120.1 → 1.120.2; otros 15 componentes sin cambio. Reutiliza componentes DH; sin cambio de contratos REST/SignalR/Redis ni migraciones.
- Integración primero a develop y staging; promoción posterior del parche validado a master con autorización expresa. CI/staging pendientes.

## [1.120.1] - 2026-11-23 · DH-20261123-PRICING-LTL-ROUTES-417

- PATCH: permitir crear un consolidado LTL independiente al modificar el origen o destino de una tarifa existente; la ruta original no se sobrescribe.
- Acción explícita «Crear otra ruta con estos valores» que conserva importes, cargos y condiciones, exige seleccionar una combinación diferente y evita duplicados locales por origen/destino/perfil comercial.
- Reutiliza DhButton y estilos/tokens DH existentes; sin nuevos endpoints ni cambios de contratos REST, SignalR, Redis, base de datos o migraciones.
- DholeWeb y DholeSystem 1.120.0 → 1.120.1; los otros 15 componentes del ecosistema permanecen en la misma versión.
- Release candidato en ramas intermedias. CI, pruebas de integración y validación staging pendientes; master y producción no autorizados.

## [1.120.0] - 2026-11-23 · DH-20261123-OPS-APERTURES-P1-416

- MINOR coordinado con Operations: WHS obligatorio para FCA en cualquier modalidad de Aperturas; uso de los componentes DH existentes, sin nuevo sistema visual.
- Sincronización universal DholeWeb/DholeSystem 1.119.1 → 1.120.0; DholeOperationsService 0.17.0 → 0.18.0. Los otros 14 servicios se mantienen sin cambios.
- Entrega de primera parte de prioridad 1, sin aceptación automática Pricing ni autoguardado inicial servidor. Pruebas/CI y staging pendientes; master y producción no autorizados.

## [1.119.1] - 2026-11-23 · DH-20261123-PRICING-RETURN-MODAL-415

- PATCH: en Dashboard → Solicitudes a Pricing, sustituir el motivo y el historial de devoluciones incrustados en cada fila por el botón «Ver devolución», que abre el DhModal compartido.
- El modal muestra cliente, ruta, motivo actual, fecha, operador e historial completo; conserva «Corregir y reenviar» y «Duplicar», y es compatible con responsive y los temas existentes.
- DholeWeb y DholeSystem 1.119.0 → 1.119.1; los otros 15 componentes no cambian. Sin modificaciones REST, SignalR, Redis, permisos ni migraciones.
- Release candidato solo en ramas intermedias; CI, pruebas, validación visual en staging y autorización expresa antes de master/producción.

## [1.119.0] - 2026-11-22 · DH-20261122-OPS-CASE-OVERVIEW-414

- MINOR: listado de Trámites muestra nombre CRM con resolución por cuenta, equipo, operativo y estado específico departamental, sin exponer UUID ni destacar DRAFT como estado operativo.
- Cliente por lote desde CRM 1.43.0 bajo permisos de cuenta, sin N+1 en ruta principal.
- Drawer de resumen con componentes DH, dos validadores de Aperturas, ejecutivo comercial real de CRM, ruta, mercancía, equipos, servicios, pendientes, historial y responsable.
- Expediente completo reorganizado por identificación, ruta, carga, servicios, estados de etapa y responsables; superusuario puede consultar todos los tabs según permisos calculados por backend.
- Pruebas de regresión agregadas al gate de build; mantiene realtime, contratos REST existentes y sin duplicar componentes visuales.

## [1.118.0] - 2026-11-22 · DH-20261122-UI-MOTION-LAB-413

- MINOR: laboratorio visual aislado en /lab/animaciones para usuarios autenticados, con tarjetas spotlight, alternativas de cotización animadas, timeline de trámites y feedback de notificaciones; únicamente datos de demostración.
- Vue 3 y CSS nativos, sin dependencias de React, llamadas a APIs, escrituras, migraciones ni modificaciones de REST/SignalR/Redis. Respetar prefers-reduced-motion y permitir desactivar efectos manualmente.
- Versionamiento coordinado DholeWeb y DholeSystem 1.117.2 → 1.118.0; los otros 15 componentes permanecen sin cambios. Solo develop para evaluación y staging; master pendiente de aprobación expresa.

## [1.117.2] - 2026-11-22 · DH-20261122-DHOLE-ERP-412

- PATCH: mostrar de forma permanente y legible el significado corporativo completo «Digital Hub for Operations, Logistics & Ecosystem» debajo de DHOLE ERP en la pantalla de acceso y en el encabezado del menú lateral expandido; también en tooltip del logo compacto.
- Añadir pruebas que requieren texto renderizado y visible, evitando una traducción que exista solamente como tooltip o metadato. Mantener el nombre DHOLE ERP, sin pronunciación obligatoria, y preservar REST, SignalR, persistencia y rutas técnicas.
- Versionamiento universal coordinado DholeWeb y DholeSystem 1.117.1 → 1.117.2; los otros 15 componentes permanecen sin cambios. Integración develop, validación staging y posterior promoción a master.

## [1.117.1] - 2026-11-22 · DH-20261122-DHOLE-ERP-411

- PATCH: DHOLE ERP conserva el nombre corporativo y significado, pero retira por completo las sugerencias de pronunciación del acceso, barra lateral y traducciones en español/inglés.
- Se corrige la prueba de identidad para compilar en Docker sin depender de .env (excluido del contexto de construcción). Se verifica que no existan claves o interfaces de pronunciación y se mantienen REST/SignalR y claves técnicas.
- DholeWeb y DholeSystem 1.117.0 → 1.117.1; manifiesto global actualizado. Promoción a master posterior a las validaciones de staging.

## [1.117.0] - 2026-11-22 · DH-20261122-DHOLE-ERP-410

- MINOR: identidad oficial de la plataforma web como DHOLE ERP (Sistema de Gestión Interna / Internal Management System) en acceso, menú lateral, título de navegador, favicon, mensajes, traducciones y configuración de build.
- Guía visible de pronunciación «dóul» y significado «Digital Hub for Operations, Logistics & Ecosystem» con accesibilidad bilingüe. DHOLE CLOUD, DHOLE X4 y GIO quedan fuera del alcance; no se modifican rutas, API, claves técnicas ni identidad de integraciones.
- DholeWeb 1.116.1 → 1.117.0 y DholeSystem 1.116.1 → 1.117.0. Requiere validación CI/staging previa a master. La rama master tiene despliegue automático: producción no autorizada.

## [1.116.1] - 2026-11-22 · DH-20261122-PRICING-RETURN-EMAIL-409

- PATCH: la ventana «Devolver tarifa» identifica la solicitud mediante cliente y ruta sin mostrar el UUID. El identificador permanece exclusivamente en URLs internas y metadatos de integración.
- DholePricingService entrega correo HTML formateado para Outlook, sin UUID visible, con motivo y llamada a la acción para corregir y reenviar la misma solicitud. El backend pasa 1.26.25 → 1.26.26; DholeWeb y DholeSystem 1.116.0 → 1.116.1.
- Mantiene validación de motivo, bitácora y flujo Return/Open, SignalR, Redis Outbox/Inbox y contratos REST existentes. Gates CI y staging obligatorios antes de producción.

## [1.116.0] - 2026-11-22 · DH-20261122-OPERATIONS-ASSIGNMENT-SUMMARY-408

- MINOR: selección explícita de equipo de Aperturas antes de crear un IDTRA manual, usando el catálogo propio de Operations; valida mínimo de dos usuarios disponibles, conserva el equipo en autoguardado y permite reintentos idempotentes sin duplicar expedientes.
- Estibable solo para LCL/LTL, oculto y no aplicable para FCL/FTL/AIR.
- El peso ya no se captura en Aperturas, ni para la carga ni por equipo FCL/FTL; Coordinación Origen confirma el peso posteriormente. Los valores históricos de expedientes existentes se preservan al editarlos.
- Rediseño de la pantalla de revisión y drawer de Trámites con cliente/ejecutivo, ruta detallada, mercancía, equipos, condiciones, documentos, estado y asignaciones. Mantiene IDTRA, QUO, catálogos Pricing, CABYS, CRM, Storage y SignalR.
- Incluye pruebas de regresión de formulario, selección, estados e interfaz, y contratos compatibles con el endpoint de Operations.
- Versiones: DholeWeb y DholeSystem 1.115.1 → 1.116.0; DholeOperationsService 0.15.1 → 0.16.0; restantes 14 componentes permanecen sin cambio.

## [1.115.1] - 2026-11-22 · DH-20261122-PRICING-RETURN-407

- PATCH: denominar «Devolver tarifa» la acción de Pricing; mostrar «Devuelta por Pricing» a Ventas, identificador visible y motivo obligatorio; diálogo opaco y accesible en modo oscuro.
- Ventas puede consultar el historial íntegro de devoluciones con operador, fecha/hora y motivo y corregir y reenviar la misma solicitud (sin otra QUO ni ID). El backend conserva estados Returned/Open y el outbox SignalR/Email existente.
- Release coordinado: DholeWeb/DholeSystem 1.115.0 → 1.115.1, DholePricingService 1.26.24 → 1.26.25; no se altera el contrato REST. CI + staging requeridos antes de promover master.

## [1.115.0] - 2026-11-22 · DH-20261122-OPERATIONS-OPENING-POLISH-406 (DholeWeb / DholeSystem)

- MINOR: autoguardado local del formulario de apertura manual con recuperación durante 7 días por usuario/empresa, sin generar IDTRA hasta confirmar. En apertura se reemplaza «Guardar borrador» por «Crear y asignar a equipo» usando asignación de validadores de Operations; si falla la asignación se retiene el ID de la apertura creada y se reintenta sin duplicar.
- Reutilización del selector de equipos de Pricing en tarjetas FCL/FTL (tamaño, tipo, cantidad y peso por equipo), exclusión de tipos ya elegidos, control de cantidad y resumen agrupado.
- Selector de naturaleza de carga y tipo de bulto, con valores históricos preservados; iconos de transporte consistentes con Pricing y espaciado corregido de Incoterm.
- Contactos operativos CRM seleccionados automáticamente por defecto, con posibilidad de desmarcarlos; la decisión se preserva en borradores.
- Revisión compacta, sin leyenda ni datos de Coordinación Origen; botón final orientado a creación y asignación. Mantiene selección CABYS, Storage, autogeneración IDTRA, tres pantallas y contratos REST/SignalR sin cambios.
- Ecosistema: DholeWeb y DholeSystem 1.114.0 → 1.115.0; otros quince componentes conservan sus versiones. Release coordinado develop → staging → master según autorización del usuario.

## [1.114.0] - 2026-11-22 · DH-20261122-OPERATIONS-OPENING-UX-405 (DholeWeb)

- MINOR: rediseñar la apertura manual con tarjetas de modalidad y tipo de embarque, excluir Multimodal de nuevas aperturas y conservar la lectura de expedientes históricos multimodales.
- Corregir la visualización de ejecutivo comercial recuperándolo de la cuenta CRM y, cuando sea necesario, del contrato de etiquetas de responsables existente, sin usar al creador del expediente como ejecutivo.
- Seleccionar destinatarios operativos activos de CRM por referencias reales, con soporte de múltiples contactos y preservación de borradores históricos. El envío de correos sigue fuera de esta captura.
- Mejorar la accesibilidad y el estilo de los botones IMO, Estibable, Sobrepeso, Redestino y Anticipado; mantener los dos últimos excluyentes. Actualizar la revisión con datos completables en Origen según especificación v1.2.
- Conservar contratos REST, documentos Storage, IDTRA, prioridad y complejidad administradas por Operations, SignalR, versiones de expedientes y el flujo de tres pasos. Sin despliegue de producción autorizado en este release.
- Ecosistema Dhole 1.113.1 → 1.114.0; componentes modificados Web/System, otros 15 sin cambio.

## [1.113.1] - 2026-11-22 · DH-20261122-OPERATIONS-NO-SERVICES-404 (DholeWeb / DholeSystem · apertura manual)

- PATCH: se retira por completo la antigua pantalla de Servicios en la apertura manual, incluido el multiselector de servicios, recolecta, entrega, agente, naviera, merchant y las instrucciones operativas de esa pantalla.
- Paso 1 se titula Cliente y ruta; se conservan Carga y documentos y Revisión sin modificar el flujo de borrador, generación IDTRA, CABYS ni Storage.
- El WHS requerido por FCA LCL/LTL aparece ahora en la ruta para cumplir el contrato vigente del backend sin restaurar la pantalla de servicios.
- Compatibilidad: la apertura mantiene su contrato REST y propiedades históricas opcionales en edición; prioridad y complejidad permanecen como valores internos requeridos por Operations, no como controles del usuario.
- DholeWeb y DholeSystem 1.113.0 → 1.113.1; restantes 15 componentes sin cambio. Validar compilación, pruebas y staging antes de promover master. Despliegue de producción no autorizado.

## [1.113.0] - 2026-11-22 · DH-20261122-OPERATIONS-UX-403 (DholeWeb / DholeSystem · aperturas manuales)

- MINOR: apertura manual de Trámites pasa de 6 a 3 etapas (cliente/ruta/servicios, carga/documentación y revisión) sin perder modalidad ni embarque requeridos por Operations.
- Reutiliza PricingCrmClientSelect para clientes y ejecutivo CRM, CABYS de Hacienda, botones IMO/estibable/sobrepeso/muellaje Anticipado/Redestino y carga de respaldos en Storage.
- Países de origen y destino derivan de los metadatos de ruta; se oculta el aviso técnico IDTRA. Se retiran controles de prioridad, complejidad y revisión comercial todavía no integrada del formulario visible.
- Mantiene IDTRA en el backend, guardado de borradores, compatibilidad REST y SignalR existentes. DholeOperationsService 0.15.1 no cambia su contrato.
- CI, verificación funcional y staging son obligatorios antes de integrar a master; no se autoriza despliegue a producción.

## [1.112.1] - 2026-11-22 · DH-20261122-PRICING-OPERATIONS-STEPPER-402 (Pricing · UI de creación con componente de Operations)

- PATCH: Crear/editar tarifa usa el encabezado operativo con icono, estado y avance, y reutiliza PricingWizardStepper con las 8 etapas existentes (9 en solo lectura), sin modificar el flujo de costos, servicios ni QUO.
- Conserva los borradores múltiples, autoguardado, recuperación y descarte de la cotización activa; mantiene el bloqueo de navegación hasta registrar el motivo al editar y el diseño responsive.
- Versionado global DholeWeb 1.112.0 → 1.112.1. APIs REST/SignalR, DholeOperationsService 0.15.1 y demás microservicios no cambian. CI y staging obligatorios antes de promover a master. No autoriza despliegue a producción.

## [1.112.0] - 2026-11-22 · DH-20261122-OPERATIONS-PARITY-401 (Operations / Pricing: apertura manual)

- MINOR: apertura manual en 6 etapas consistentes con Pricing (modalidad, embarque, cliente/ruta, carga, servicios y revisión); tarjetas de selección reutilizan el patrón visual del wizard comercial.
- Reutiliza PricingWizardStepper, PricingContainerSelector, PricingLocationSearchSelect y PricingCrystalMultiSelect; conserva borradores, modal FCL/FTL/LCL/LTL y catálogos Config.
- Corrige compatibilidad de Incoterms al cambiar transporte, captura de naturaleza de carga y POE como puerto de entrada; guarda catálogo y cantidad de cada equipo sin colapsar contenedores múltiples.
- Backend Operations valida equipo FTL y multimodal FCL/FTL; sin cambios comerciales sobre QUOs ni costos, sin migraciones destructivas. CI y staging obligatorios antes de master.
- DholeWeb/DholeSystem 1.111.1 → 1.112.0; DholeOperationsService 0.15.0 → 0.15.1; componentes restantes sin cambios.

## [1.111.1] - 2026-11-21 · DH-20261121-OPERATIONS-STEPPER-400 (UI Pricing/Operations · ancho del stepper)

- PATCH: PricingWizardStepper distribuye dinámicamente las columnas de navegación según los pasos reales (4 en edición de tarifas, 5 en Aperturas) y mantiene el desplazamiento horizontal adaptable en móvil.
- Prueba de regresión para evitar que el paso quinto de Aperturas se desplace a una segunda fila en escritorio.
- DholeWeb/DholeSystem 1.111.0 → 1.111.1; backend Operations 0.15.0 y demás servicios sin cambios. Sin cambios REST, SignalR, ni migraciones.
- Requiere CI/staging y promoción coordinada a master.

## [1.111.0] - 2026-11-21 · DH-20261121-OPERATIONS-PRICING-UI-399 (Operations · wizard compartido con Pricing)

- MINOR: Apertura manual usa 5 pasos (Cliente, Ruta, Carga, Servicios, Revisión) con resumen de completitud, barra de avance y guardado de borrador sin perder información.
- Se extrajo PricingWizardStepper del editor de tarifas y ahora lo usan Pricing y Operations: un único componente de navegación, semántica accesible y diseño adaptable para móvil.
- Operations reutiliza PricingLocationSearchSelect para POL, POE, POD y WHS, PricingCrystalMultiSelect para servicios, DhCheckbox/DhSelect/DhInput/DhTextarea/DhButton y catálogos reales de Config usados por Crear tarifas (ubicaciones, contenedores, equipos terrestres, agentes y navieras).
- La edición reconcilia nombres históricos de lugares con el catálogo sin borrar valores no encontrados; conserva el contador global IDTRA del backend Operations 0.15.0 y las APIs REST/SignalR existentes.
- DholeWeb/DholeSystem 1.110.6 → 1.111.0; Operations 0.15.0 sin cambio de backend; servicios restantes conservan versiones; correcciones Pricing DH-398 intactas.
- La aceptación de QUO automática hacia Operations y UAT funcional autenticado son trabajos pendientes, no parte de este ajuste visual. CI y staging por validar.

## [1.110.6] - 2026-11-21 · DH-20261121-PRICING-TERRESTRIAL-FREIGHT-398 (candidate develop)

- PATCH DholeWeb: Pantalla 7 FCL multimodal vuelve a mostrar el flete internacional terrestre que Pricing entrega en data.applicable, independientemente del flete marítimo y del Bunker.
- La reconciliación se ejecuta después de la respuesta asíncrona y respeta el CostId del maestro, su costo/venta, la ruta POE/POD y las modificaciones persistidas; protege contra cargos de otra ruta y contra duplicados.
- La selección contextual del backend tiene prioridad sobre shipmentMode=Any y los campos legacy poeId/podId cuando existen relaciones múltiples; no se alteran APIs REST ni datos históricos.
- Versiones: DholeWeb 1.110.5 → 1.110.6; el servicio Pricing permanece en 1.26.24 (sin modificaciones en este cambio). Integrar por CI y staging antes de master.

## [1.110.5] - 2026-11-21 · DH-20261121-PRICING-VGM-FCL-FINAL-397 (candidate develop)

- PATCH: La validación de Incoterm ya no desmarca el VGM del consolidado propio Miami elegido comercialmente ni el flete internacional terrestre de un FCL multimodal con transporte contratado.
- Se realiza la reconciliación definitiva después de la validación de Incoterm y antes de serializar los detalles; evita omitir VGM y flete terrestre incluso después de reconstrucciones.
- Continuación de DH-396 ya integrado en develop: helper idempotente, precios VGM por plan Miami y Freight terrestre independiente del marítimo/Bunker. Pruebas del build transformado actualizadas.
- Global System/Web 1.110.5, Pricing 1.26.24; no repricing de detalles persistidos ni cambios de contrato REST.

## [1.110.4] - 2026-11-21 · DH-20261121-PRICING-MISSING-LINES-396 (candidate develop)

- PATCH: LCL propio Miami recupera el VGM desde el plan comercial A/B/C/D/NVOCC/LITTLE en la reconstrucción de pantalla 7 y en pre-guardado. Un VGM 0/excluido del consolidado no oculta la venta comercial; se respetan valores positivos, manuales y RateDetails persistidos.
- PATCH: FCL multimodal Panamá → GAM mantiene el flete internacional terrestre independiente del marítimo y del Bunker, incluso si la reconstrucción de pantalla 7 sustituye la lista o existe un cargo terrestre automático en cero. Se recupera antes de serializar detalles.
- Se conserva la regla interna USD 2.140/cont. cuando no existe maestro aplicable, sin inventar CostId; importes negociados y datos históricos permanecen intactos.
- Regresiones dinámicas de los planes Miami, conservación de importes y coexistencia de fletes. Release coordinado System/Web 1.110.4, Pricing 1.26.23; CI y staging antes de master.

## [1.110.3] - 2026-11-21 · DH-20261121-PRICING-FINAL-POLISH-395 (candidate develop)

- PATCH: LCL propio Miami conserva y factura VGM correspondiente al plan comercial A/B/C/D/NVOCC (si tiene valor); la reconstrucción del consolidado ya no descarta los suplementos p7-394-miami.
- PATCH: FCL multimodal Panamá → GAM muestra el flete internacional terrestre independiente del marítimo; Bunker Flete Internacional Terrestre no se confunde con Freight. Priorizar maestros aplicables de Pricing, y si no hay maestro válido aplicar la regla interna USD 2.140 por contenedor sin CostId ficticio.
- PATCH: LTL propio/coloader muestra Días de tránsito editables en pantallas 4 y 7, guarda transitDays/transitTime al crear o modificar la cotización.
- Pruebas de regresión para las tres correcciones. Versionado universal: PricingService 1.26.22, DholeSystem 1.110.3. CI/staging pendientes.

## [1.110.2] - 2026-11-21 · DH-20261121-PRICING-LAST-THREE-FIXES-394 (candidate develop)

- PATCH: El flete internacional terrestre Panamá → Costa Rica se conserva como segunda línea Freight independiente del flete marítimo en FCL multimodal; no se descarta cuando Pantalla 7 reconstruye líneas.
- PATCH: LTL conecta POL comercial Colón Free Zone con el POE físico del maestro sin exigir el mismo ID entre catálogos; se incluyen Flete, Bunker, Gastos y Custodia + Marchamo según WeightKg y servicio.
- PATCH: LCL Miami repone conceptos comerciales SED/Manejos/VGM/TICA/Marchamo/Documentación/Forwarding y seguro aplicable, sin duplicar filas presentes del consolidado y sin modificar precios históricos.
- PricingService 1.26.21, DholeSystem 1.110.2. Pruebas de regresión añadidas; CI y staging por verificar.

## [1.110.1] - 2026-11-21 · DH-20261121-PRICING-TRANCHE-MIAMI-PANAMA-393 (candidato develop)

- PATCH: Pantalla 7 de FCL Multimodal encuentra el tramo internacional terrestre aunque el maestro esté clasificado InlandTransport/FTL; conserva el flete marítimo y usa la regla oficial USD 2140 para Panamá → GAM únicamente si falta el maestro aplicable.
- PATCH: LTL Panamá → Costa Rica concilia independientemente Flete terrestre, Bunker, Gastos y Custodia + Marchamo por tramos WeightKg, incluso cuando falta temporalmente un cargo; no repricia líneas históricas ni elimina importes editados.
- PATCH: LCL Miami plan D ajustado a cotizador_miami.html; desglose de flete P8 emplea CFT cobrable aunque el backend persista un importe Flat para conservar el mínimo monetario exacto.
- Pruebas DH-393 agregadas. CI, staging y promoción a master pendientes; sin despliegue productivo autorizado. DholePricingService 1.26.20; global 1.110.1.

## [1.110.0] - 2026-11-21 · DH-20261121-OPERATIONS-OPENING-IDTRA-392 (candidato develop)

- MINOR: creación manual de expedientes desde Trámites usa una pantalla completa (ya no modal), con edición posterior por ruta propia; captura datos de cliente CRM, ruta POL/POE/POD, Incoterm, transporte, mercancía, peso, volumen, carga IMO, recolecta, WHS, proveedores, equipo múltiple, servicios y observaciones.
- El IDTRA deja de pedir serie manual. El backend genera consecutivo global IDTRA00001, IDTRA12345, IDTRA100000, etc., a partir de contador transaccional PostgreSQL, sin techo de seis cifras.
- La ficha extendida del expediente presenta datos operativos capturados y distingue borradores incompletos de validaciones. Modificaciones usan control de versión, ACL de la etapa Aperturas y Outbox/SignalR.
- Web/System 1.109.3 → 1.110.0 y Operations 0.14.0 → 0.15.0. Se preserva el release DH-391 de Pricing y sus costos, sin modificar tarifas existentes.
- Apertura automática desde aceptación definitiva de Pricing permanece pendiente; igual que los selects integrados con todos los catálogos de CRM/SRM. No se declaran como implementados.
- CI/staging pendientes. Sin despliegue productivo autorizado.

## [1.109.3] - 2026-11-21 · DH-20261121-P7-COSTS-391 (candidato develop)

- PATCH: en LTL Panamá → Costa Rica, muestra las cuatro líneas del catálogo por POE/POD múltiples y tramos reales WeightKg, incluida Gastos 0/0 cuando el tramo lo determina; respeta FCA y los CostIds.
- PATCH: LCL propio consulta independientemente el servicio de agencia de aduanas CRC seleccionado y calcula por tramo sin eliminar la matriz ni costos/ventas negociados.
- PATCH: multimodal FCL mantiene dos fletes separados (marítimo + terrestre) y nombra el flete según modalidad, también en guardado.
- PATCH: modificación de cotizaciones considera Sobrepeso y peso de la carga como deltas explícitos; conserva identidades de RateDetails y evita recotizar sin autorización.
- Añade pruebas de regresión DH-391 y validación de compilación. Backend PricingService sigue en 1.26.19; REST/SignalR compatibles.
- CI y pruebas funcionales de staging pendientes. Producción no autorizada para este release.

## [1.109.2] - 2026-11-21 · DH-20261121-WIZARD-COSTS-390 (candidato develop)

- PATCH: el excedente de FCL multimodal Panamá → Costa Rica sobre 19.000 kg por contenedor se calcula con los cuatro costos LTL maestros presentes en data.catalog del mismo wizard-bundle, no con data.applicable filtrado a FCL.
- PATCH: la edición de muellaje registra Anticipado/Redestino como delta explícito; elimina únicamente el detalle persistido de la alternativa reemplazada y permite restaurarlo al revertir, conservando flete, costo, venta e identidad de los demás RateDetails.
- Integración con PricingService 1.26.19 para exponer Recolecta/Entrega editables y gastos Panamá con tramos cero correctamente evaluados. No se importan rubros ajenos del catálogo ni se recrean cotizaciones.
- Pruebas de regresión agregadas. CI, staging y promoción a master pendientes; producción sin despliegue autorizado.

## [1.109.1] - 2026-11-21 · DH-20261121-PRICING-EDIT-BUNDLE-389

- PATCH: modifica el flujo de cotizaciones persistidas para consultar GET /api/pricing/costs/wizard-bundle en Pantalla 6 (Merchant/Carrier) y Pantalla 7 (delta explícito), aun cuando la cotización ya tenga RateDetails guardados.
- PATCH: la consulta del catálogo es de solo lectura para líneas históricas y nunca reconstruye ni actualiza costos/ventas negociadas. Solo data.applicable puede originar costos de nuevas líneas correspondientes a cambios expresos.
- PATCH: el Flete Internacional Terrestre con CostId propio se puede añadir al cambiar transporte, sin borrar el Flete FCL marítimo; opciones Inland Merchant/Carrier nuevas solo si fueron seleccionadas y están aplicables al contexto.
- PATCH: cargar opciones no cambia automáticamente el Inland elegido en una cotización existente. Pruebas DH-389 de llamada a endpoint, selección y no duplicación; validación CI/staging pendiente.
- Release coordinado DholeSystem 1.109.1; PricingService mantiene su contrato/versión 1.26.18; REST y realtime conservados. Promoción mediante PRs intermedios a develop y master.

## [1.109.0] - 2026-11-21 · DH-20261121-BLOBATAR-ACCESSORIES-388

- MINOR: personalización avanzada de Blobatar: selector visual por categorías, tarjetas de accesorios, vista previa ampliada, etiquetas activas y selección múltiple accesible en Apariencia.
- MINOR: nuevos accesorios SVG (gorrito de bufón, accesorios navideños, Halloween, símbolos del mes patrio de Costa Rica y divertidos), renderizados también en la mascota flotante. Se combinan por ranuras; un accesorio en el mismo lugar reemplaza al anterior sin afectar los demás.
- Compatibilidad: la configuración de accesorio única existente se migra automáticamente al formato múltiple; persistencia local por usuario, foto opcional, expresiones y preferencias de movimiento conservadas. Traducciones ES/EN y pruebas de regresión actualizadas.
- Release global DholeSystem 1.109.0; otros componentes mantienen sus versiones registradas. Requiere CI, pruebas en staging y autorización de producción antes del despliegue.

## [1.108.20] - 2026-11-21 · DH-20261121-QUO-EDIT-DELTA-387

- PATCH: al modificar QUO, se conserva el snapshot original y sus precios/DetailId; no se vuelven a añadir todos los costos aplicables al cargar, avanzar ni guardar.
- PATCH: comparación de servicios, modalidad, tipo de embarque, ruta, naviera, agente, Incoterm, inland y condiciones. Servicio de Aduanas y Seguro de Carga solo crean sus líneas solicitadas; costos por tramos calculados por la regla correspondiente de wizard-bundle.
- PATCH: eliminar/deshacer servicios conserva o restaura precios originales, evita duplicados y no recupera cargos no solicitados. CI/staging y pruebas manuales pendientes.
- Release coordinado DholeSystem 1.108.20, DholePricingService conserva 1.26.18. Producción no aprobada sin validaciones.

## [1.108.19] - 2026-11-21 · DH-20261121-WIZARD-BUNDLE-ONLY-386

- PATCH: el asistente de creación/modificación consulta costos exclusivamente mediante GET /api/pricing/costs/wizard-bundle; data.applicable es la única fuente de líneas nuevas y data.catalog solo sirve para referencia histórica.
- PATCH: conserva el Flete Internacional Terrestre CostId independiente del flete marítimo FCL durante la conciliación por contenedor y lo presenta en Flete Internacional; elimina la consulta previa a /costs/select.
- PATCH: preserva RateDetails de cotizaciones existentes sin reinsertar cargos no contratados; refresco solo con acción explícita. Pruebas DH-386 añadidas, CI/staging pendientes. Release coordinado DholeSystem 1.108.19 / PricingService 1.26.18.

## [1.108.18] - 2026-11-21 · DH-20261121-PRICING-EDIT-TIERS-LAND-385

- PATCH: el cost loader final de Vite envía contenedor, kg, bultos y días a Pricing; mantiene la clave de contexto alineada para evitar precios obsoletos.
- PATCH: modificar una QUO no regenera cargos del maestro; refresco explícito solo actualiza CostId previamente contratado, conservando exclusiones, IDs y precios históricos.
- PATCH: reconoce flete internacional terrestre distinto del marítimo en multimodal y descarta solamente el flete genérico en cero.
- Pruebas de regresión de 40HC, 28000 kg, paquetes/días y líneas eliminadas; CI y staging pendientes. Release coordinado DholeSystem 1.108.18 y PricingService 1.26.17.

## [1.108.17] - 2026-11-21 · DH-20261121-PRICING-P7-RESTORE-384

- PATCH: Pantalla 7 registra eliminaciones de RateDetail por ID y las envía como RemovedExtraDetailIds, sin confiar en el nombre, CostId ni ocultaciones.
- PATCH: refresco explícito de costos en una cotización guardada vuelve a consultar Pricing y no remezcla opcionales del catálogo global.
- PATCH: recuperación explícita de líneas de la revisión original compatible, con previsualización y guardado como nueva revisión; no cambia la base automáticamente.
- PATCH: seguro nunca se agrega o repricia al entrar en la pantalla de edición.

## [1.108.16] - 2026-11-21 · DH-20261121-PRICING-P7-EDIT-SAFETY-383
- Persisted P7 RateDetails are authoritative: no automatic catalog rehydration, zero cost regeneration, Release dedup, or customs placeholders when editing.
- New quotations generate charges exclusively from contextual wizard-bundle applicable entries.
- All existing line identifiers, cost and sale remain unchanged until explicit user action.

## [1.108.15] - 2026-11-21 · DH-20261121-PRICING-P7-SNAPSHOT-TIERS-382

- PATCH: los costos aplicables se obtienen del conjunto contextual de Pricing sin mezclar los 274 rubros del maestro, evitando resucitar cargos opcionales no seleccionados.
- PATCH: al editar se consultan costos después de recuperar peso, bultos, contenedor y días guardados; el backend devuelve importes efectivos por tramo, no 0 en la cabecera.
- PATCH: selección de equipo prioriza el ID FCL persistido, incluso durante la hidratación del catálogo.
- PATCH: las cotizaciones guardadas no se repreciarán automáticamente según cambios del maestro; RateDetail, costo, venta e identificadores de revisión permanecen autoritativos.
- Pruebas sobre aislamiento de opcionales, snapshots y consulta de contexto completo.
- Coordinación semver DholeWeb/DholeSystem 1.108.14→1.108.15 y PricingService 1.26.13→1.26.14.

## [1.108.14] - 2026-11-21 (DH-20261121-PRICING-TIERS-381 · cálculo de tramos en cotizaciones)

- PATCH: las tarjetas de costos/ventas de agente en P6 calculan cada importe desde pricingRulesJson para el tipo de contenedor, peso o bultos seleccionado; no presentan los ceros de la cabecera del catálogo.
- PATCH: la actualización explícita de costos en una cotización existente compara y aplica el tramo resuelto, nunca los ceros base. Continúa respetando las ediciones del snapshot y los CostIds persistidos.
- PATCH: al cambiar equipo, cantidad, peso, bultos, pallets o días de almacenaje, P7 vuelve a calcular los costos con tramos sin sobrescribir otras líneas ya editadas.
- Regresión automatizada con bandas 20DV (670/705) y 40HC (740/780). Sin modificación de datos maestros, contratos REST, base de datos o SignalR.
- Versión global Dhole 1.108.14 y DholeWeb 1.108.14; DholePricingService permanece 1.26.13. Integración solo a develop tras CI y validación de staging; master/producción pendientes de autorización.

## [1.108.13] - 2026-11-21 (DH-20261121-PRICING-P7-EDIT-380 · seguro, edición y resumen de líneas)

- PATCH: respeta Seguro de carga solicitado mediante valor declarado o servicio, desde la creación y no solamente tras modificar.
- PATCH: elimina fallbacks monetarios de recolecta/origen con costo y venta en cero que no proceden del catálogo ni de una selección manual.
- PATCH: no revaloriza RateDetails ya guardados al abrir o guardar una modificación; conserva valores y IDs originales.
- PATCH: presenta y persiste las líneas completas en el mismo orden de grupos de la pantalla 7.
- Coordinado con DholePricingService 1.26.13 y manifiesto de release 1.108.13; pendiente de pruebas CI/staging.

## [1.108.12] - 2026-11-21 (DH-20261121-FOB-EXPORT-FREIGHT-379 · cargos por Incoterm del cliente)

- PATCH: corrige FOB + Exportación en P7. La reconciliación FCL marcaba manual=true e included=true a fletes por contenedor creados por el sistema; por eso escapaban la protección y aparecían por USD 5.500 sin acuerdo explícito.
- Fletes de naviera elegidos en P5/P6 permanecen como inventario con monto, divisa, cantidad y comentarios originales, pero no se incluyen en P7, totales ni POST cuando corresponden a la otra parte según Incoterm/Import-Export. Incorporación mediante «Agregar servicio fuera del Incoterm» y «Cotizar por acuerdo», por contexto comercial actual.
- Las excepciones no se arrastran al cambiar de ruta, cliente, servicios, operación o Incoterm. Cargos realmente ingresados por el usuario y RateDetails persistidos conservan sus importes. FOB Import y CIF Export mantienen el flete del lado del cliente.
- Regresión pricingIncotermFclBilling379.test.ts y guard histórico #377 actualizados. DholeWeb/DholeSystem 1.108.11 → 1.108.12; DholePricingService permanece 1.26.12. Sin cambios REST, SignalR ni base de datos.
- Release coordinado solo a develop/staging sujeto a CI y validación autenticada de FOB Export/Import en P7; master y producción no autorizados.

## [1.108.11] - 2026-11-21 (DH-20261121-INCOTERM-RUNTIME-SCOPE-378 · recuperar el wizard y proteger Incoterms)

- PATCH: limita los dos transformadores Vite de shouldIncludeOptionalCost al cuerpo de esa única función y evita que borren los helpers de cotización por Incoterm situados antes de selectableOptionalLines.
- Aserción obligatoria de todas las funciones Incoterm en el código transformado antes de compilar Vue, regresión con funciones anidadas y nueva comprobación del bundle minificado para applyIncotermAutomaticChargeGuard.
- Conserva CostId, importes, Inland, líneas históricas, ediciones, contratos REST y SignalR. Versión DholeWeb/DholeSystem 1.108.10 → 1.108.11; servicios backend sin cambios.
- Candidato develop/staging sujeto a CI y smoke funcional autenticado. Master y producción sin autorización.

## [1.108.10] - 2026-11-21 (DH-20261121-INCOTERM-AUTO-COST-377 · no precotizar cargos fuera del Incoterm)

- PATCH: la pantalla 7 ya no incluye automáticamente en una cotización nueva líneas de categorías atribuidas normalmente a la otra parte según Incoterm + Import/Export. El coste sigue en catálogo (Pricing /wizard-bundle) pero queda fuera de Totales, PDF y POST salvo contratación explícita.
- Cuando una categoría esté en rojo, «Agregar servicio fuera del Incoterm» permite examinar candidatos y pulsar «Cotizar por acuerdo» por cargo, conservando importes originales sin inventar descuentos. La selección explícita queda limitada al contexto exacto de ruta/cliente/Incoterm y no arrastra aprobaciones entre alternativas.
- Rubros manuales o RateDetail persistidos NO se ocultan ni se eliminan: se respeta la integridad P0 de modificaciones. Opcionales seleccionados expresamente también se permiten. Categorías mixtas permanecen disponibles y requieren revisión por tramo.
- El guard de inclusión se aplica tras las transformaciones Vite, en el estado reactivo real: el color rojo ya no es meramente visual. No altera costos maestros, contratos REST, SignalR ni base de datos; el backend Pricing incluye el guard de flete importado solicitado explícitamente.
- DholeWeb y DholeSystem 1.108.9 → 1.108.10, DholePricingService 1.26.11 → 1.26.12 (CreateRate no agrega flete importado si P7 no lo incluye). Desarrollo/staging tras CI; sin autorización de master/producción.

## [1.108.9] - 2026-11-21 (DH-20261121-INCOTERM-RUNTIME-376 · recuperación del wizard Pricing)

- PATCH urgente: resuelve ReferenceError `maritimeOnlyIncoterms is not defined` introducido en 1.108.7: una computed de incompatibilidad Incoterm podía evaluarse sin la variable, que Vite transforma fuera o evalúa después. Ahora ambos usos llaman a una función pura importada y declarada en `pricingIncotermPerspective.ts`, sin dependencia de orden ni variable local.
- Endurece comprobación de bundle en `npm run build-only`: al finalizar Vite ejecuta `diagnose-pricing-bundle.mjs` que falla si la salida de producción contiene nombres de bindings Pricing rotos, incluido `maritimeOnlyIncoterms`. Añade regresión específica 11 Incoterms y montaje seguro.
- Preserva filtros por modalidad, categorías rojas y cargos históricos. Sin cambios backend, costos, edición, contratos REST ni SignalR. DholeWeb/DholeSystem 1.108.8 → 1.108.9, PricingService sigue 1.26.11. Solo develop/staging.

## [1.108.8] - 2026-11-21 (DH-20261121-INCOTERM-CATEGORY-VISIBILITY-375 · categorías de responsabilidad por Incoterm)

- PATCH: pantalla 7 resalta en rojo las categorías cuyo responsable contractual habitual no es el cliente según operación manual/automática e Incoterm (p. ej. EXPORT + FOB → Flete Internacional en rojo).
- Para categorías mixtas (FCA, cargos destino/aduanas y tramos CPT/CIP/DAP/DPU) muestra aviso contextual sin marcarlas incorrectamente como excluidas. Los cargos de agente sin tramo conocido no se califican por un Incoterm genérico.
- Ambos wizards preservan visibles y editables los cargos ya cotizados o seleccionados, sin alterar CostId, flete, inland, seguro, precios, IVA, totals, guardado o API. Un cargo rojo puede seguir contratado expresamente; la responsabilidad del Incoterm no es el servicio facturable.
- Solo DholeWeb y DholeSystem cambian 1.108.7 → 1.108.8; PricingService queda 1.26.11. Staging/develop, sin autorización master/producción.

## [1.108.7] - 2026-11-21 (DH-20261121-INCOTERMS-EDIT-P0-374 · Incoterms y primera protección P0 de modificación)

- PATCH: selección de Incoterms de Dhole: marítimo/multimodal muestran los 11; aéreo/terrestre muestran los 7 de cualquier modalidad; al reabrir una QUO antigua nunca se elimina el valor histórico sin confirmación.
- Pantalla 3 presenta Importación/Exportación con un indicador compacto y control «Cambiar operación» bajo demanda; conserva prioridad del override manual y regreso a automático.
- Muestra documentación específica de EXW/FCA/FAS/FOB/CFR/CIF/CPT/CIP/DAP/DPU/DDP y recuerda que responsabilidades no equivalen a filtrado destructivo de costos.
- P0 modificaciones: ambos wizards rechazan guardados si faltan RateDetail.Id previamente persistidos (visibilidad/carga incompleta). La pantalla de edición no infiere eliminaciones y el wizard legado envía ExpectedRevisionNumber.
- DholeWeb/DholeSystem 1.108.6 → 1.108.7; DholePricingService 1.26.10 → 1.26.11. Ramas intermedias → develop y staging; master no autorizado. Fases restantes de modificación pendientes.

## [1.108.6] - 2026-11-21 (DH-20261121-P6-P7-SNAPSHOT-373 · desbloqueo P6→P7 con costos visibles)

- PATCH exclusivo de develop: la transición P6→P7 reconoce el catálogo activo y las líneas aplicables ya verificadas y mostradas en P6, incluso cuando una petición adicional falla o es anulada por un watcher. No inventa cargos ni exige nuevas solicitudes si ya están validados para el mismo contexto.
- La reutilización verifica POE, carrier, agente, moneda, cliente CRM, relaciones y CostId en un borrador específico de ruta; nunca mezcla alternativas ni clientes, y respeta el bloqueo comercial cuando falla la verificación de tarifas preferenciales.
- Conserva Inland Carrier/Merchant, flete, costos/ventas y criterios de selección. No cambia endpoints REST, backend Pricing, SignalR ni base de datos.
- DholeWeb y DholeSystem 1.108.5 → 1.108.6; DholePricingService mantiene 1.26.10. CI y smoke autenticado de staging obligatorios; master y producción no autorizados.

## [1.108.5] - 2026-11-21 (DH-20261121-P7-COST-BUNDLE-372 · carga conjunta de costos y avance P6–P7)

- PATCH coordinado DholeWeb 1.108.4 → 1.108.5 y DholePricingService 1.26.9 → 1.26.10, versión global de ecosistema 1.108.5. Destino exclusivo develop/staging, sin master ni producción.
- Pantalla 7 usa un único GET /api/pricing/costs/wizard-bundle para el catálogo activo y sus cargos aplicables con CostId, relaciones de ruta/naviera/agente, Incoterm y servicios; preserva los importes del flete, Inland Carrier/Merchant y preferencias del cliente.
- Se adaptaron el cargador original y transformadores Vite FTL/FCL, LTL propio de Panamá y LCL coloader. El flujo P6→P7 advierte sobre validaciones o consultas fallidas y evita un watcher prematuro desde P6.
- Permanece el contrato /select, la compatibilidad REST y SignalR/outbox/inbox. Pruebas de CI y smoke autenticado de staging necesarios antes de dar el release por validado.

## [1.108.4] - 2026-11-21 (DH-20261121-P7-INLAND-HYDRATE-371 · hidratación P7 e Inland en memoria)

- PATCH sincronizado DholeWeb/DholeSystem 1.108.3 → 1.108.4, únicamente develop/staging. No cambia DholePricingService, master ni producción.
- Primera carga de Pantalla 7 valida el catálogo completo activo de Pricing en paralelo con el endpoint contextual de POE/naviera/agente; no confía en listados de inicio incompletos, evita respuestas obsoletas y descarta cachés a las que les falten CostIds aplicables.
- No se avanza del último proveedor P6 a P7 hasta finalizar ambas consultas y la reconstrucción de líneas, de forma que el usuario no deba recargar el navegador para ver todos los cargos disponibles.
- Inland guarda memoria en sesión del componente por ruta/POE/POD/naviera/agente, servicios y cliente, conservando Carrier/Merchant, CostId, costo, venta, divisa, IVA y cliente a facturar. Reconstruir P7 o cambiar de alternativa restaura estas selecciones sin copiar valores a otras rutas.
- Recarga manual invalida el catálogo validado y vuelve a solicitar ambos conjuntos, pero no sobreescribe ediciones de Inland.
- Test: `tests/pricingP7CatalogInlandMemory371.test.ts`, incluido en la suite obligatoria de Pricing. Validación autenticada en staging pendiente para P6/P7→P8→PDF.

## [1.108.3] - 2026-11-20 (DH-20261120-P7-FREIGHT-DRAFT-370 · preservar flete P6/P7 y etiquetas)

- PATCH coordinado Web/System 1.108.2 → 1.108.3, únicamente develop y staging, PricingService no se modifica.
- En el wizard multi-POE/naviera, el flete manual o seleccionado de P6 se reconstruye desde sus importes vigentes ANTES de entrar por primera vez a P7. Un borrador antiguo no sobreescribe los costos/ventas nuevos al regresar P6→P7.
- La recarga P7 invalida cachés que carecen de la línea de flete esperada y conserva los precios editados de los otros CostIds y rubros manuales en la misma alternativa. Al restaurar POE/naviera se recupera el contexto y catálogo completo con su CostId.
- Títulos de bloques antes del mensaje vacío; se oculta el formulario de facturación de grupos sin líneas. Etiquetas explícitas costo/venta/divisa; encabezado P7 deja de tapar las filas al hacer scroll.
- Prueba `tests/pricingScreenSevenFirstEntry370.test.mjs` agregada al CI de Pricing. Requiere smoke autenticado del P6→P7, regreso 7→6→7, P8 totales y P9 PDF.

## [1.108.2] - 2026-11-20 (DH-20261120-P7-VISIBLE-369 · hotfix de pantalla 7 sin ReferenceError)

- PATCH DholeWeb/DholeSystem 1.108.1 → 1.108.2. Develop y staging únicamente. Backend PricingService sin cambios.
- Reparación en `pricingWizardScreen4CostSelectors`: la transformación Vite eliminaba `const visible` del método de merge y dejaba un `visible.has(section)` sin resolver, generando `ReferenceError: visible is not defined` tras cargar 41 cargos aplicables.
- Normaliza ambas versiones de la condición del Catálogo/CostId antes de quitar la variable; si apareciese otra referencia, conserva su declaración o bloquea la compilación. El filtrado comercial estricto permanece en `applicableConfiguredCosts()`.
- Agrega `tests/pricingGeneratedVisibleGuard369.test.ts` al CI de Pricing para verificar el propio código del transformador y su resultado, evitando repetir el error en una futura compilación.
- Validación manual autenticada P6-P7 con MAERSK/WWL y 40HC, totales P8 y PDF P9 aún requiere smoke en staging.

## [1.108.1] - 2026-11-20 (DH-20261120-P7-CHARGES-368 · recuperar cargos P7 en develop)

- PATCH coordinado Web/System 1.108.0 → 1.108.1; PricingService permanece sin cambios. Solo develop, sin master ni producción.
- Corrige la pérdida de cargos fijos de MAERSK/WWL en Pantalla 7 tras filtrar por naviera y agente simultáneamente. Reconcilia por CostId el resultado contextual con el catálogo activo, manteniendo los filtros locales estrictos de POL, POE, POD, servicios, Incoterm y proveedor.
- Acepta cargos universales con shipmentMode Any. Reconsulta automáticamente y permite reconstruir manualmente Pantalla 7 si un cambio de alternativa borra las líneas de la misma ruta; la caché de costos deja de considerarse válida cuando las líneas están vacías.
- Conserva los importes de flete cargados en Pantalla 6 y no incorpora líneas de rutas/navieras ajenas a la opción vigente. Incluye tests/pricingScreenSevenCostRecovery368.test.ts. Verificación funcional autenticada en staging pendiente.

## [1.108.0] - 2026-11-20 (DH-20261120-INCOTERMS-WIZARD-367 · primera fase de flujo Incoterms P1–P9 en develop)

- MINOR coordinado DholeWeb/DholeSystem 1.107.5 → 1.108.0; DholePricingService permanece en 1.26.9. Trabajo sobre feature branch con destino develop; sin autorización de producción.
- P7 conserva abiertos los seis bloques de Recolecta, Origen, Flete, Destino, Entrega y Seguro; Incoterms® 2020 orientan responsabilidades pero no bloquean servicios válidos contratados.
- P6→P7 no avanza ante una consulta fallida u obsoleta de costos. Los importes y selecciones previamente editados se reconcilian solo si coincide el contexto comercial (POE, POD, naviera, agente, Incoterm, servicios y cliente).
- Cambiar de Incoterm no descarta silenciosamente las ubicaciones EXW/FCA capturadas. CIF y CIP advierten que el seguro del vendedor se documenta sin duplicar primas.
- Previene la creación de flete ficticio cuando no está cotizado, y evita generar rubros variables de recolección/origen por el único hecho de mostrar el bloque. Los cargos catalogados siguen sujetos a las condiciones de Pricing.
- Incluye prueba `tests/pricingIncotermsWizardStage367.test.mjs`. Pendiente de CI, validación autenticada de staging y evolución de contratos backend para lugar convenido, evidencia de seguro y estado de responsabilidad por línea.

## [1.107.5] - 2026-11-20 (DH-20261120-PRICING-WIZARD-RUNTIME-366 · corregir bloqueo de creación de tarifas en producción)

- PATCH urgente coordinado DholeWeb/DholeSystem 1.107.4 → 1.107.5. Elimina la dependencia del símbolo `automaticOperationType`, que desaparecía durante los transforms de Vite y producía `ReferenceError` al abrir o reabrir Pricing.
- Computa directamente la perspectiva comercial con el país CRM, origen y POD sin variables computadas intermedias susceptibles a transformaciones; conserva selección manual Import/Export/Tránsito, países ISO universales, borradores, IVA por POD e inland.
- Añade pruebas de regresión del wizard Vue, rechazo durante compilación si reaparece el binding inseguro y análisis del paquete final minificado en CI.
- DholePricingService 1.26.9 sin cambios. Sin cambios en REST, SignalR, datos ni permisos. Validación de compilación, smoke en Chrome y staging antes de producción.

## [1.107.4] - 2026-11-20 (DH-20261120-PRICING-UNIVERSAL-COUNTRY-365 · resolución universal de países en Pricing)

- PATCH coordinado DholeWeb/DholeSystem 1.107.3 → 1.107.4: reemplaza excepciones por país con un resolvedor ISO 3166-1 de los 249 países/territorios, ISO alpha-2/alpha-3, UN/LOCODE y nombres localizados (ES/EN/PT/FR).
- Calcula el país físico de POL, POE y POD con precedencia Config countryId → metadatos ISO explícitos → país del nombre → UN/LOCODE; el CRM comparte el mismo resolvedor, sin asumir países por ciudades ni identificadores opacos.
- Mantiene el selector manual Importación/Exportación/Tránsito cuando un país falta o es ambiguo; sin modificar el país real del cliente, cargos, IVA por POD, Incoterms ni contratos REST/SignalR.
- Pruebas automatizadas: 249 ISO y múltiples rutas Asia/América/Europa/África/Oceanía, catálogos vacíos, ISO3, idiomas, conflictos y persistencia de la operación. DholePricingService sigue 1.26.9.
- Despliegue de producción no autorizado. CI completo y prueba autenticada staging requeridos antes de master.

## [1.107.3] - 2026-11-20 (DH-20261120-PRICING-PERSPECTIVE-364 · corregir perspectiva comercial de Pricing)

- PATCH: resuelve SV desde etiquetas explícitas «El Salvador» en POL/POE/POD aunque Config no incluya ISO, y lee metadatos ISO-2 alternativos para clientes CRM.
- Permite seleccionar manualmente Importación, Exportación o Tránsito sin bloquear una cotización por datos de países incompletos; conserva la elección en borradores y cotizaciones existentes.
- Elimina la advertencia genérica de perspectiva no determinada y utiliza una instrucción accionable. Se mantiene el cálculo de IVA por POD y la responsabilidad Incoterm según la operación seleccionada.
- DholeWeb/DholeSystem 1.107.2 → 1.107.3; DholePricingService 1.26.9 sin cambios. Sin migraciones, nuevos endpoints ni cambios en SignalR. Validación CI/staging requerida antes de master.

## [1.107.1] - 2026-11-20 (DH-20261120-VERSION-NOTICE-500-362 · corrección 500 de ajustes de avisos)

- PATCH coordinado con DholeAuthService 1.17.1: backend envuelve preferencia + outbox en Npgsql execution strategy, para permitir guardar global y por usuario.
- Metadatos Web/Sistema 1.107.1 alineados; sin cambios adicionales de UI ni APIs.

## [1.107.0] - 2026-11-20 (DH-20261120-VERSION-NOTICES-361 · preferencias de avisos de actualización)

- MINOR: Ajustes permite apagar el aviso de nuevas versiones para el usuario actual, por usuario específico (SuperUsuario), o globalmente (SuperUsuario); la desactivación global tiene prioridad.
- La ventana de actualización Web consulta preferencias autenticadas persistidas en Auth; recibe invalidaciones individuales de SignalR (sin toast) y recupera estado tras desconexión con REST cada 60 segundos. No altera CRM, Pricing ni correo.
- DholeWeb 1.106.17 → 1.107.0; DholeAuthService 1.16.2 → 1.17.0; DholeSystem 1.106.17 → 1.107.0. Requiere migración de Auth; CI, compilación, SignalR E2E y staging pendientes. Producción no autorizada.

## [1.106.17] - 2026-11-20 (DH-20261120-PRICING-INLAND-REGRESSION-360 · estabilización urgente del inland)

- PATCH de contención: revierte únicamente la sincronización temprana introducida en DholeWeb 1.106.15/1.106.16 que puede excluir líneas inland durante la carga asíncrona y guardar borradores incompletos.
- Restablece el comportamiento frontend previo para el traspaso de Pantalla 6 a 7. **No se declara resuelto el problema original de autoload**: requiere reproducción autenticada con ruta/POE/naviera real antes de otra corrección.
- Preserva el desbloqueo temporal de Incoterms en master y contratos REST/SignalR. Sin modificaciones de PricingService ni base de datos.

## [1.106.16] - 2026-11-20 (DH-20261120-PRICING-INLAND-QA-358 · pruebas del inland 6→7)

- PATCH: ajusta la prueba automatizada de paridad Merchant/Carrier para que simule el guardado del borrador ahora obligatorio al elegir inland en Pantalla 6. Sin cambio adicional al contrato REST/SignalR ni a los precios aplicados.
- Release de control de calidad posterior a DholeWeb 1.106.15; DholeSystem 1.106.16, DholePricingService permanece en 1.26.8.
- Se exige CI verde y prueba de navegación en staging antes de cualquier promoción a master. Producción no autorizada.

## [1.106.15] - 2026-11-20 (DH-20261120-PRICING-INLAND-STEP67-357 · cargos e inland pantallas 6 → 7)

- PATCH: los cargos Optional verificados en Pantalla 6 se trasladan por CostId al catálogo de Pantalla 7 antes de reconstruir RateLines, sin recargar el navegador ni traer los de otra POE/naviera.
- El inland Merchant/Carrier seleccionado manualmente o automáticamente se conserva en el borrador por alternativa y al volver a la pantalla; un cargo InlandTransport configurado como Fixed/Variable también puede incorporarse si corresponde.
- Las respuestas Optional retrasadas se descartan si cambia la ruta, agente o naviera; se conserva el contexto de costos vigente y los importes editados.
- Pruebas de regresión de navegación 6→7, selección, restauración del catálogo y solicitudes asíncronas; CI/staging pendientes, sin despliegue a producción.

## [1.106.11] - 2026-11-20 (DH-20261120-EXPIRED-ROLE-354 · autorización de vencidas solo para vendedores)

- PATCH: en listado de tarifas, “Solicitar autorización” se muestra solo a vendedores; Pricing y Superadmin editan cotizaciones vencidas directamente sin modal de jefatura.
- La API Pricing usa el mismo permiso y conserva la solicitud a Roy/José Pablo para vendedores, histórico y notificaciones realtime. Web/System 1.106.10 → 1.106.11; Pricing 1.26.5 → 1.26.6.
- Regresión de roles en listado y API; sin migración ni cambio de contratos REST/SignalR. CI y staging pendientes; producción no autorizada.

## [1.106.10] - 2026-11-20 (DH-20261120-PRICING-VAT-TOTAL-353 · IVA correcto en resumen de oferta)

- PATCH: en tarifas guardadas y en vista de solo lectura, si una respuesta histórica de Pricing devuelve IVA total cero aunque las líneas comerciales tengan IVA, la pantalla recupera cada importe comercial guardado y lo agrega en USD y CRC.
- El total de la oferta suma subtotal sin impuesto + IVA; costo, utilidad y margen permanecen calculados sobre valores sin IVA. Evita duplicar impuestos y respeta cargos sin IVA, divisas y tipo de cambio de la tarifa.
- Tests de proyección comercial del wizard, con Pricing 1.26.4 → 1.26.5 y DholeWeb/DholeSystem 1.106.9 → 1.106.10. REST y SignalR compatibles, CI y staging pendientes, producción no autorizada.

## [1.106.9] - 2026-11-20 (DH-20261120-LCL-CRC-AGENCY-352 · Agencia de Aduanas CRC en LCL propio)

- PATCH: La pantalla 7 carga la Agencia de Aduanas CRC solicitada por Ventas incluso si la fuente es un consolidado LCL propio.
- Resuelve Costos Pricing por servicio, ruta, Incoterm y tramo de peso; reconoce el suplemento como CustomsCharge.
- Preserva el suplemento al recalcular, guardar y reabrir sin duplicar la matriz del consolidado ni Manejos.
- Si no hay precio aplicable, mantiene un renglón editable sin inventar costos; cubierto por pruebas de regresión.

## [1.106.8] - 2026-11-20 (DH-20261120-INCOTERM-SAVE-351 · Guardado de importaciones FOB y flete contratado)

- PATCH: El transformador de Vite deja de utilizar la referencia eliminada `freightNotRequiredByIncoterm`, que producía un ReferenceError y bloqueaba el guardado de tarifas antes de enviar el PUT a Pricing.
- El servicio Transporte Internacional seleccionado, y no el Incoterm por sí solo, controla la inclusión del flete en ediciones de importación y exportación; se conservan los cargos contratados de FOB China → Costa Rica y se quita flete histórico solo cuando no se selecciona ese servicio.
- Pruebas de regresión de conciliación de RateDetails y protección contra referencias obsoletas. Versión global Web/System 1.106.7 → 1.106.8; Pricing 1.26.4 permanece sin modificaciones. Sin cambios REST/SignalR.

## [1.106.7] - 2026-11-20 (DH-20261120-INCOTERM-IMPORT-350 · Incoterms de importación según cliente y país real)

- PATCH: Importación China → Costa Rica se calcula con país del cliente CRM y país real de POL/POD, incluyendo puertos China con código Config opaco o UN/LOCODE, sin convertir al importador en exportador.
- Normalización de los 11 Incoterms ICC desde código o etiqueta de Config; la importación aplica responsabilidades del comprador y la exportación las del vendedor. El flete internacional expresamente contratado sigue siendo cotizable aunque CIF/DDP lo asigne originalmente a otra parte.
- Alineación de asistentes de creación/edición, pruebas de regresión de importación y exportación; versiones Web/System 1.106.6 → 1.106.7 y Pricing 1.26.3 → 1.26.4. Sin migración ni cambio REST/SignalR; CI/staging pendientes y producción no autorizada.

## [1.106.6] - 2026-11-20 (DH-20261120-MERCHANT-OPTIONS-348 · Merchant en Pantalla 6 sin filtro duplicado)

- PATCH: Pantalla 6 mantiene los CostIds Optional validados por la misma consulta y reglas de ruta que Pantalla 7, sin repetirles el filtro `applicableConfiguredCosts()` de precios por tramo. Corrige el Inland de Balboa a Colon Free Zone (Merchant) visible en Pantalla 7 pero excluido de la comparación.
- El caché opcional se vincula a POE/POD/naviera/agente/servicios/Incoterm/cliente y se descarta ante cambios de ruta; se impiden respuestas obsoletas. Un fallo aislado de la consulta contextual no impide mostrar los opcionales válidos de Pricing.
- Se conservan CostId, base por contenedor, exclusividad Merchant/Naviera, recargos comunes e importes sin duplicados. Pruebas de regresión reproducen el filtro que descartaba Merchant, fallo contextual y cambio de contexto.
- Release coordinado DholeWeb/DholeSystem 1.106.5 → 1.106.6; 15 componentes sin cambios de binario, sin modificaciones REST/SignalR. CI y staging obligatorios antes de producción.

## [1.106.5] - 2026-11-20 (DH-20261120-MERCHANT-OPTIONAL-SCREEN6-347 · Merchant Balboa–Colón visible en Pantalla 6)

- PATCH: Pantalla 6 carga el mismo catálogo opcional filtrado que Pantalla 7 antes de resolver las alternativas Merchant/Carrier. Se corrige el caso Inland de Balboa a Colon Free Zone (Merchant) disponible en Pantalla 7 pero ausente en la comparación previa.
- Se valida la identidad de la ruta y el serial de petición antes de fusionar CostIds; cambios rápidos de POE, POD, naviera o agente no inyectan cargos de otra alternativa. La consulta de Pricing contextual y los filtros estrictos de Pantalla 7 se mantienen.
- Se evita afirmar que no existen cargos cuando aún no termina la consulta; los errores de carga se notifican. No se modifican montos de costos, bases por contenedor ni tarifas preferenciales, y Merchant/Carrier sigue siendo excluyente.
- Prueba regresiva de sincronización entre Pantallas 6 y 7, solicitud obsoleta y contexto cambiado. DholeWeb/DholeSystem 1.106.4 → 1.106.5; 15 servicios restantes sin cambio de binario. REST/SignalR sin modificación. CI requerido antes de merges, staging antes de master.

## [1.106.4] - 2026-11-20 (DH-20261120-PRICING-MERCHANT-HAULAGE-346 · recuperar Merchant Haulage configurado para rutas FCL)

- PATCH: Pantalla 6 reconoce transporte en destino Merchant/Carrier también cuando el Inland de Costos y recargos es Fixed o Variable, no solamente Optional. Se respeta la coincidencia de POE Balboa, POD seleccionado, modalidad, Incoterm, naviera/agente y servicios resuelta por Pricing.
- Inland sin naviera explícita se presenta como Merchant, y el vinculado a naviera como Carrier. Cargos fijos comunes (p. ej. Cargos en destino Línea Naviera) no se reclasifican ni desaparecen de las dos alternativas.
- Al elegir Merchant o Carrier se incluye exclusivamente el transporte seleccionado en Pantalla 7. Los costos fijos de transporte no se vuelven a sumar como costo compartido; cada línea mantiene su CostId, base por contenedor y monto configurado.
- Pruebas de regresión: Merchant fijo Balboa→San José, Carrier fijo, costos comunes, restricciones de ruta, condiciones explícitas y cambio de alternativa. Web/System 1.106.3 → 1.106.4; 15 componentes restantes sin cambios binarios.
- Compatible con APIs REST y la infraestructura SignalR existente. CI y staging pendientes; no hay autorización de producción.

## [1.106.3] - 2026-11-20 (DH-20261120-PRICING-IMPORT-COSTS-345 · costos de importación según contexto real)

- PATCH: los costos devueltos por `/api/pricing/costs/select` para el contexto FCL (POL, POE, POD, naviera, agente, servicios e Incoterm) son autoritativos; se evita una segunda exclusión en Web basada en IDs legados de puertos únicos.
- La consulta complementaria del catálogo general mantiene validación estricta de ruta, Incoterm, modalidad, servicios y proveedores: no mezcla costos de otros clientes o rutas.
- La Pantalla 7 permite visualizar todos los cargos aplicables de origen, destino y documentación aun si su etapa no figura en las obligaciones predeterminadas del comprador. El flete internacional solo aparece si se contrata Transporte Internacional; se conservan cargas sin flete.
- Los asistentes nuevo y legado permiten seleccionar cualquier etapa al agregar un rubro manual; se respetan los rubros activos, reglas por tramos y permisos.
- Pruebas regresivas CIF importación con manejo de origen, aduana, documentación, servicio de transporte opcional y costo de otra ruta excluido.
- DholeWeb/DholeSystem 1.106.2 → 1.106.3; DholePricingService 1.26.3 sin cambios binarios y otros 14 componentes sin nuevas versiones. REST/SignalR conservados. CI y staging obligatorios antes de master/producción.

## [1.106.2] - 2026-11-20 (DH-20261120-INCOTERM-QUOTED-FREIGHT-344 · todos los Incoterms respetan el transporte contratado)

- PATCH: la selección de Transporte Internacional, en lugar de una exclusión fija del Incoterm, determina si se presentan y guardan fletes de cotizaciones marítimas, aéreas, FTL y LTL.
- CPT, CIF, CFR, CIP, DAP, DPU y DDP pueden incluir flete explícito y gastos asociados cuando el cliente contrata ese servicio, sin alterar las obligaciones comerciales del Incoterm.
- Las cotizaciones sin el servicio de transporte internacional siguen ocultando flete; conservar manejos, documentos, destino y días de tránsito terrestre. Nuevo mensaje explica que falta seleccionar el servicio.
- Regresión LTL CPT Colón–Managua, CIF/DDP por operación y filtros de cargos seleccionados. Web/System 1.106.1 → 1.106.2; Pricing 1.26.2 → 1.26.3; 14 servicios restantes sin nuevos binarios.
- Sin migraciones ni cambios REST/SignalR; CI y staging pendientes. Sin autorización para producción.

## [1.106.1] - 2026-11-20 (DH-20261120-CRM-PRICING-PREFERRED-ALIAS-343 · aplicación de tarifas preferenciales por identidad de cliente y ruta)

- PATCH: la caché de costos de Pantalla 7 incorpora la cuenta CRM para impedir reutilizar precios de otro cliente en alternativas con idéntica ruta.
- CRM y Pricing pueden expresar códigos diferentes para el mismo POL/POE/POD/naviera: se concilian únicamente mediante el ID exacto de catálogo seleccionado; si el catálogo es ambiguo, conserva el criterio original y nunca aplica el acuerdo de otra ruta.
- Los precios preferenciales fijos, por tramos y conceptos manuales vuelven a evaluarse con el contexto conciliado. Se preservan costos proveedor, cantidades, bases, impuestos y snapshots de QUO existentes.
- Una respuesta incompleta de CRM deja de tomarse por una lista de cero acuerdos y bloqueará el recálculo silencioso con ventas estándar; prueba de regresión reproduce los seis cargos FCL CIF 40HC para ONE/Caldera/San José.
- Coordinación de release Web/System 1.106.0 → 1.106.1; sin cambios de binario en servicios backend. CI y staging requeridos antes de integración a master; producción no autorizada.

## [1.106.0] - 2026-11-20 (DH-20261120-OPERATIONS-TRAMITES-UX-332 · Trámites unificado y expediente en pantalla completa)

- MINOR: Trámites reemplaza la bandeja redundante: botón Nuevo trámite manual con cuenta CRM, búsqueda y filtros paginados, resumen del IDTRA en DhDrawer y vista de detalle independiente.
- El expediente muestra los ocho tabs formales y la matriz de acceso calculada por Operations (EDITABLE, READ_ONLY, LOCKED, NOT_APPLICABLE), sin ediciones ficticias de departamentos todavía no implementados.
- Resumen permite modificar metadata autorizada de Aperturas con versión optimista, audit trail, y doble validación en el propio expediente; QUO muestra snapshot y costos autorizados; Origen permite consultar estado y guardar notas privadas según ACL.
- Enlace directo desde Dashboard a detalle IDTRA. Canal SignalR de caso con reconexión, invalidaciones y nueva lectura REST. Formularios con cambios locales no se sobrescriben ante eventos concurrentes.
- Web y System 1.105.2 → 1.106.0; Operations 0.13.0 → 0.14.0. Pricing → apertura automática continúa pendiente, al igual que formularios avanzados para otras áreas.
- CI, staging, autorización y despliegue a producción por verificar.

## [1.105.2] - 2026-11-20 (DH-20261120-CRM-PREFERRED-BLOCKS-342 · corrección de bloques comerciales CRM y conciliación Pricing)

- PATCH: los acuerdos de igual modalidad, ruta, equipo, naviera, Incoterm, servicios y vigencia se muestran como un bloque coherente en CRM; pueden reabrirse en el editor por ruta sin borrar ni duplicar los seis ítems persistidos. Vista avanzada identifica los ítems manuales y elimina el mensaje falso de desconexión con Pricing.
- El matching de Pricing utiliza los servicios seleccionados en la cotización y reconcilia un CostId antiguo solo si no existe en el catálogo y hay un único costo actual con igual rubro y nombre. Un cargo manual Other también se puede relacionar con un concepto único de mismo nombre sin alterar costo proveedor.
- Las ventas de CRM por EMBARQUE/CONTENEDOR/DOCUMENTO se normalizan respecto de la cantidad de la línea existente para preservar costo y base original; nunca se convierte una unidad desconocida. Los acuerdos en pantalla 7 muestran razones individuales de ruta cuando no coinciden.
- Prueba regresiva que representa seis ítems del caso CIF 40HC, POL Ho Chi Minh, POE Caldera, POD San José y naviera ONE, además de unidad, divisa, ruta y CostId ambiguo. Misma API REST y SignalR existentes, sin migración; CI y staging antes de master.
- DholeWeb/DholeSystem 1.105.1 → 1.105.2; otros 15 componentes sin cambio.

## [1.105.1] - 2026-11-20 (DH-20261120-PRICING-CRM-PREFERRED-RUNTIME-331 · consulta real de tarifas preferenciales CRM en Pricing)

- PATCH: soluciona la causa raíz: el transformador de Vite que sustituía loadApplicableCosts() omitía la carga de acuerdos comerciales de CRM y dejaba todas las ventas con el importe general del catálogo aunque el cliente tuviera beneficios compatibles.
- El cargador FCL/FTL generado consulta los acuerdos del cliente antes de calcular los importes, conserva costos del proveedor y el guard de error. Un guard posterior a todas las transformaciones falla la compilación si se elimina nuevamente esa consulta.
- En Pantalla 7 se muestra cuántos cargos preferenciales fueron realmente aplicados y se advierte cuando ningún acuerdo coincide con la ruta, naviera, equipo, servicio, Incoterm, moneda o unidad. Se mantienen los snapshots ya emitidos.
- Prueba de regresión de transformaciones en prebuild; versión global Web/System 1.105.0 → 1.105.1, CRM 1.42.8 y Operations 0.13.0 sin cambios. Compilación, CI y staging requeridos antes de master.

## [1.105.0] - 2026-11-20 (DH-20261120-OPERATIONS-APERTURES-330 · Aperturas y expedientes)

- MINOR: Dashboard Operations distingue aperturas manuales y originadas en Pricing. Bandeja Aperturas y Trámites filtran por origen, estado e IDTRA desde backend paginado y enlazan a la QUO vinculada.
- Apertura manual: selector de cuenta CRM (en vez de UUID escrito), empresa resuelta en servidor y ejecutivo obtenido de CRM sin identidad de prueba.
- Expediente en Trámites presenta navegación de ocho pestañas en una vista: Resumen con datos y etapas existentes, QUO relacionada y estados de departamentos. La operación avanzada de cada tab depende de fases posteriores y permisos del backend.
- La creación automática real desde QUO aceptada todavía necesita contrato de aceptación duradero, snapshot comercial y consumidor idempotente en Operations; no se declara terminada.
- Web 1.104.5 → 1.105.0 y Operations 0.12.0 → 0.13.0; release global candidato 1.105.0. No integrar a master ni desplegar sin CI y staging.

## [1.104.5] - 2026-11-20 (DH-20261120-PRICING-CRM-PREFERRED-324 · aplicar tarifas preferenciales CRM en Pricing)

- PATCH: al generar una nueva cotización para una cuenta CRM, Pantalla 7 obtiene los acuerdos comerciales vigentes de esa cuenta y sustituye exclusivamente el importe de venta en los cargos cuyas condiciones coinciden: modalidad, CostId/rubro, equipo, POL, POE, POD, naviera, Incoterm y servicios.
- Respeta la opción más específica por ruta/servicio, rangos de venta, cargos manuales y descuentos; conserva costos proveedores, IVA y snapshots de cotizaciones ya persistidas. Ante fallo CRM impide guardar una cotización estándar silenciosa y permite reintentar.
- Coordinado con CRM 1.42.8 y DholeSystem 1.104.5. REST de CRM y realtime existentes sin incompatibilidad; CI/staging previos a master.

## [1.104.4] - 2026-11-20 (DH-20261120-EXPIRED-APPROVAL-SELLER-ACCESS-312 · aprobación desde el dashboard vendedor)

- PATCH: Roy y José Pablo, este último vendedor sin rol Pricing o SuperUsuario, ven la bandeja de autorizaciones para tarifas vencidas desde Inicio y pueden aprobar o rechazar de manera segura.
- Contador actualizado por SignalR y acceso directo desde la notificación en /home?expiredApprovals=1. Se reutiliza la validación de identidad de Auth ya implementada en la API.
- DholeSystem/Web 1.104.3 → 1.104.4; Pricing 1.26.1 → 1.26.2.

## [1.104.3] - 2026-11-20 (DH-20261120-CRM-INVITEE-VISIBILITY-323 · participantes internos visibles)

- PATCH: en la ficha de actividad se muestran los nombres reales de las invitadas internas recuperados de Auth y se distingue visualmente su condición de invitadas frente a contactos externos.
- La agenda comercial también carga actividades compartidas para usuarios internos con permisos de seguimiento/tareas; lista de asistentes y eventos se sincroniza mediante SignalR y REST al reconectar.
- Global 1.104.2 → 1.104.3, Web 1.104.1 → 1.104.3 y CRM 1.42.6 → 1.42.7, resto de componentes sin cambios. CI y staging pendientes; producción no autorizada.

## [1.104.2] - 2026-11-20 (DH-20261120-PRICING-COUNTRY-OPTIONS-310 · reparación del wizard en blanco)

- PATCH: el selector de países obtiene opciones del catálogo Config reactivo, sin acceso a computed pricingQuoteCountryOptions inexistente tras transformaciones de Vite. Evita el TypeError al abrir Crear tarifa.
- Regresión de ambas pantallas y bundle minificado. Web/System 1.104.1→1.104.2; otros 15 componentes sin cambios. Backend, REST y SignalR sin cambios.

## [1.104.1] - 2026-11-20 (DH-20261120-EXPIRED-RATE-OUTBOX-HOTFIX · versión coordinada de notificaciones de autorización)

- PATCH: mantiene versión Web/System sincronizada con Pricing 1.26.1 después de corregir la longitud de la clave Outbox de solicitudes de actualización de tarifas vencidas. Sin cambio de experiencia de usuario, APIs ni componentes frontend.
- DholeWeb/DholeSystem 1.104.0 → 1.104.1, Pricing 1.26.0 → 1.26.1. Requiere CI y staging.

## [1.104.0] - 2026-11-20 (DH-20261120-EXPIRED-RATE-APPROVAL-301 · autorización de actualización de tarifas vencidas)

- MINOR: permite solicitar la revisión de una tarifa vencida indicando el motivo obligatorio (mínimo 15 caracteres). La edición permanece bloqueada hasta la aprobación de Roy o José Pablo y muestra el historial de decisiones.
- Bandeja de autorizaciones de jefatura, aviso por sistema/SignalR y correo a través de Notifications Outbox, y refresco de interfaz en tiempo real. Validación también en Pricing API para impedir ediciones directas.
- DholeWeb/DholeSystem 1.103.21 → 1.104.0; Pricing 1.25.4 → 1.26.0. Mantiene compatibilidad REST y los demás componentes. Requiere CI y staging antes de master.

## [1.103.21] - 2026-11-20 (DH-20261120-PRICING-CLIENT-COUNTRY-298 · desbloqueo de perspectiva comercial de tarifas)

- PATCH: el país ausente de cuentas/prospectos CRM puede seleccionarse en Pantalla 3 para esta cotización, sin cambiar la ficha original, evitando el bloqueo que impedía avanzar hasta Pantalla 5.
- Resuelve POL Ho Chi Minh, Vietnam como VN cuando la metadata de Config está incompleta y mantiene el país del POD Costa Rica para IVA; acepta códigos ISO explícitos de CRM, sin inferir el país a partir de la ruta.
- Pruebas de regresión para FCL Vietnam→Costa Rica, país CRM y bloqueo antes de guardar. Web/System 1.103.20→1.103.21, 15 servicios sin cambios; CI y staging antes de master. Sin autorización para despliegue productivo.

## [1.103.20] - 2026-11-20 (DH-20261120-CRM-MANUAL-AMOUNT-297 · corregir guardado de ítem manual sin solicitud HTTP)

- PATCH: Vue convierte v-model de input type=number a número; el formulario ejecutaba manual.amount.trim() antes del try/catch y fallaba sin enviar POST.
- Normaliza valores numéricos/textuales, valida rango sin lanzar TypeError y utiliza novalidate para que todos los errores se muestren en el formulario, evitando cancelaciones silenciosas.
- Pruebas de regresión ejecutables para números Vue, importes vacíos/no válidos y flujo del formulario manual. No cambia CRM, contratos REST, datos ni SignalR.
- DholeWeb/DholeSystem 1.103.19 → 1.103.20; sincronización del manifiesto y CHANGELOG antes del merge.

## [1.103.19] - 2026-11-20 (DH-20261120-CRM-INVITEE-PERSISTENCE-296 · persistencia de invitados)

- PATCH: mantiene invitados persistidos del seguimiento aunque estén fuera de la primera página del directorio Auth y verifica GET después de guardar cambios.
- Backend CRM 1.42.5 propaga invitados nuevos de la actividad a compromisos previamente creados, idempotente y con outbox/SignalR compatible.
- Web/System 1.103.18 → 1.103.19. Validar CI, staging y autorización de producción antes de master.

## [1.103.18] - 2026-11-19 (DH-20261119-SELLER-DASHBOARD-PARITY-295 · paridad comercial entre vendedor y supervisión)

- PATCH: la supervisión con vendedor seleccionado solicita al backend la misma cartera de su cuenta (/seller-rates/dashboard?sellerUserId), incluyendo tarifas manuales/directas que carecen de solicitudes, recibos y alternativas de QUO.
- Elimina el recorte local por RateRequest; al cambiar de vendedor recarga tasas y listados sin mezclar respuestas anteriores, y atribuye fechas de solicitud al vendedor elegido. Mantiene las acciones propias del usuario conectado, sin suplantación.
- El desempeño sigue siendo (aceptadas − vencidas) / (cotizadas − abiertas) × 100, pero ahora utiliza las mismas cotizaciones y revisiones publicadas en ambos roles. Pruebas de regresión y compilación CI.
- Web/System 1.103.17 → 1.103.18, Pricing 1.25.3 → 1.25.4; los 14 componentes restantes conservan sus versiones. Staging antes de master.

## [1.103.17] - 2026-11-19 (DH-20261119-CRM-TIERED-CHECK-293 · TIERED_SALE y reintentos seguros)

- PATCH: CRM 1.42.3 aplica migración PostgreSQL para admitir TIERED_SALE; el cliente conserva los ítems pendientes y evita duplicar costos de Pricing ya guardados.
- DholeWeb/System 1.103.16→1.103.17; conserva cambios del dashboard, Pricing, REST y SignalR. Validación de CI y staging antes de master.

## [1.103.16] - 2026-11-19 (DH-20261119-CRM-AGREEMENT-INVITEES-294 · invitados persistidos en seguimientos CRM)

- PATCH: el detalle de seguimientos consulta y muestra la cantidad de invitados realmente almacenados en CRM. Cuando falla la carga, la agenda bloquea cambios que podrían borrar invitados sin conocimiento del usuario.
- El selector confirma una actualización solo después de recuperar la lista guardada y verificar que coincida con los usuarios seleccionados.
- Coordinación DholeCRMService 1.42.3 y DholeSystem 1.103.16; nueva regresión en test:crm.
- Staging y CI antes de master; despliegue productivo sujeto a autorización expresa.

## [1.103.15] - 2026-11-19 (DH-20261119-DASHBOARD-TABLE-293 · filtros de tarjetas y clientes en seguimiento)

- PATCH: las tarjetas del Dashboard de Ventas filtran localmente la tabla «Tarifas del equipo y seguimiento de ventas» y desplazan hacia la tabla; nunca navegan a Pricing al pulsar indicadores.
- Un nuevo selector muestra solamente clientes de las tarifas autorizadas que ya cumplen filtros globales, estado y búsqueda. Deduplica nombres; el filtro funciona en todas las páginas y reinicia la paginación.
- Pruebas de regresión de opciones de clientes, coincidencia de nombres y navegación. DholeWeb/DholeSystem 1.103.14 → 1.103.15; 15 componentes sin cambios. APIs REST y SignalR compatibles. Validación CI/staging antes de master; producción no autorizada.

## [1.103.14] - 2026-11-19 (DH-20261119-DASHBOARD-PERFORMANCE-292 · corrección de desempeño comercial)

- PATCH: desempeño comercial = (aceptadas − vencidas) / (total cotizadas − abiertas) × 100; las rechazadas siguen incluidas en el total cotizado y las abiertas, que no se entregan al vendedor, se excluyen de la base.
- Vencidas penalizan el numerador; permite porcentajes negativos y evita división por cero sin tarifas entregadas. Se conservan filtros generales y las cinco categorías de resultados de ventas.
- DholeWeb/DholeSystem 1.103.13 → 1.103.14, otros 15 componentes sin cambios. Contratos REST, SignalR y seguridad preservados. CI/staging previos a master.

## [1.103.13] - 2026-11-19 (DH-20261119-DASHBOARD-GLOBAL-FILTER-291 · reportes comerciales con filtro general)

- PATCH: filtros compartidos fechas/vendedor/modalidad en Dashboard de Ventas, aplicados a las métricas, la tabla de tarifas, solicitudes y la reportería; la vista de Pricing conserva sus filtros de auditoría.
- Desempeño comercial = (aceptadas + abiertas − vencidas) / cotizadas no canceladas × 100. Puede mostrar valores negativos y marca los vencimientos como penalización.
- Ventas por moneda: aceptadas, abiertas, en espera del cliente (enviadas + vencidas), rechazadas y total cotizado como suma de estos grupos, sin canceladas.
- Versiones Web/System 1.103.12 → 1.103.13. No modifica APIs, SignalR, permisos ni los otros 15 componentes. CI/staging obligatorios antes de master.

## [1.103.12] - 2026-11-19 (DH-20261119-PRICING-EXPIRY-1D-SYSTEM-291 · recordatorio interno 1 día antes del vencimiento)

- PATCH de versión coordinada DholeWeb/DholeSystem 1.103.11→1.103.12 y Pricing 1.25.2→1.25.3. Sin cambios visuales ni de rutas; el centro de notificaciones existente recibe eventos System desde Pricing a través de Redis Streams y SignalR.
- Recordatorio al vendedor asignado a las 09:00 (Costa Rica) del día anterior a ValidTo; correo preexistente conservado, mensaje interno idempotente. Migración compatible para marcador 1d-system.
- CI, staging y pruebas obligatorias antes de master. Producción no autorizada.

## [1.103.11] - 2026-11-19 (DH-20261119-CRM-INVITATIONS-SAVE-290 · sincronización global CRM invitados)

- PATCH: sincroniza la versión Web con DholeSystem 1.103.11 y CRM 1.42.2; el payload participantUserIds y los contratos REST/SignalR existentes permanecen intactos.
- La creación de actividades comerciales valida invitados activos contra el directorio Auth en el backend, conserva recordatorios individuales y evita errores internos por consultas individuales de permisos.
- CI y staging pendientes; ninguna autorización de despliegue a producción en este release.

## [1.103.8] - 2026-11-19 (DH-20261119-PRICING-LTL-DDP-FREIGHT-284 · sincronización release DDP/LTL terrestre)

- PATCH coordinado con DholePricingService 1.25.2 y DholeSystem 1.103.8. Cotizaciones LTL con DDP y flete internacional por CBM ya no se rechazan por distribución FCL en backend; se conserva el payload del wizard (shipmentMode=Ltl, contenedores vacíos, cantidad facturable por CBM).
- El cambio del frontend es solo metadatos/versionado, sin alterar lógica de tarifas ni introducir regresiones en el wizard. CIF/FCL mantiene validaciones previas. CI/staging pendientes; producción no autorizada.

## [1.103.7] - 2026-11-19 (DH-20261119-PRICING-LTL-MANUAL-ENDTOEND-278 · recuperación real de LTL propio manual)

- PATCH: el wizard reconoce LTL manual propio (FinalClient) y LTL manual coloader (Nvocc) como fuentes válidas en pantallas 5 y 6. Corrige el falso bloqueo persistente aunque haya costo y venta.
- Al continuar solicitudes de Ventas desde pantalla 5 se reconcilia país y vendedor desde CRM, ya que la selección de cliente de pantalla 3 no se monta para Pricing. Si el CRM no tiene país válido, se solicita expresamente en pantalla 5 sin modificar el CRM ni inventar operación.
- El país explícito de esta cotización y el perfil comercial LTL manual se restauran del borrador; guardar informa cuál país falta, sin redirigir silenciosamente a pantalla 5. La línea de flete conserva los importes del formulario.
- Regressions en la suite Pricing; DholeWeb/DholeSystem 1.103.6→1.103.7, otros 15 servicios conservados. API REST/SignalR sin cambios. CI/staging antes de master.

## [1.103.6] - 2026-11-19 (DH-20261119-PRICING-LTL-STEP6-277 · validación LTL manual paso 6)

- PATCH: el paso 6 de LTL/FTL terrestre no requiere un carrierId marítimo oculto. Solo el LTL coloader manual exige agente; moneda, costo y venta deben ser valores numéricos válidos no negativos.
- Se sincronizan los mensajes de campos obligatorios con la validación del botón Continuar. Las reglas marítimas existentes se conservan.
- Web/System 1.103.5 → 1.103.6; pruebas de regresión, compilación y staging antes de master; backend, REST y SignalR sin cambios.

## [1.103.5] - 2026-11-19 (DH-20261119-PRICING-COUNTRY-LTL-276 · países CRM y LTL manual propio)

- PATCH posterior a CRM seguimientos 281: preserva la edición de recordatorios y seguimientos incluida en 1.103.4.
- Pricing carga los países canónicos de Config para resolver el UUID del cliente CRM y conserva IVA de country-vat-rates por destino.
- Pantalla 5 LTL permite ingresar un flete propio manual aunque no exista tarifario activo, separadamente de la opción coloader manual.
- DholeWeb/DholeSystem 1.103.4 → 1.103.5. Sin cambios en REST, SignalR ni servicios backend. CI y staging antes de master; producción no autorizada por esta solicitud.

## [1.103.4] - 2026-11-19 (DH-20261119-CRM-FOLLOWUP-EDIT-281 · edición de seguimientos y recordatorios)

- PATCH: habilita editar seguimientos y recordatorios desde el detalle de Agenda y seguimientos, como las bitácoras. Permite cambiar asunto, tipo, responsable, fechas, invitados y avisos sin duplicar el registro.
- Borradores recuperables, control de intervalo y carga obligatoria de los invitados antes de guardar; backend CRM guarda con auditoría y versionado optimista.
- DholeSystem/DholeWeb 1.103.3 → 1.103.4; DholeCRMService 1.42.0 → 1.42.1. CI y staging previos a master; sin autorización productiva.

## [1.103.3] - 2026-11-19 (DH-20261119-CRM-MANUAL-BENEFITS-275 · persistencia verificable de cargos manuales)

- PATCH: el formulario de tarifas preferenciales comprueba con GET que CRM persistió el cargo manual con nombre, venta, moneda y unidad antes de limpiar los datos.
- Los ítems manuales guardados para la combinación seleccionada aparecen junto al formulario; errores y confirmaciones se presentan a la par del botón, y se evitan envíos simultáneos.
- Prueba de regresión para la verificación posterior a POST/PUT. DholeWeb/DholeSystem 1.103.2 → 1.103.3; backend, REST y SignalR sin cambios.
- Validación CI y staging previa a integrar master. No se declara despliegue productivo completado.

## [1.103.2] - 2026-11-19 (DH-20261119-WIZARD-ROUTE-RUNTIME-274 · sin referencias runtime en Crear tarifa)

- PATCH: corrige `resolveClientRouteOperation is not defined` y evita el anterior `routeOperation is not defined`: calcula la perspectiva desde país CRM + POL/POD directamente en los computados existentes del wizard, sin helper adicional.
- Mantiene importación/exportación/tránsito, Incoterms y bloqueo de guardado cuando faltan países; CI valida que el bundle minificado no contenga las referencias inválidas.
- Coordinado con DholeSystem 1.103.2. Compilación y staging obligatorios antes de producción; backend y realtime sin cambios.

## [1.103.1] - 2026-11-19 (DH-20261119-WIZARD-ROUTE-REF-273 · wizard de tarifas sin referencia inválida)

- PATCH: evita `Can't find variable: routeOperation` al abrir Crear tarifa, sustituyendo la referencia por un resolvedor elevado a función que permanece disponible para Vue/Vite.
- Preserva perspectiva Import/Export/TransitDomestic según país CRM y POL/POD, validación del país de cliente e Incoterms; añade prueba de regresión de bindings.
- Release coordinado DholeWeb/DholeSystem 1.103.1; sin cambios en datos, REST ni SignalR. Validar CI y staging antes de integrar master; despliegue productivo no autorizado.

## [1.103.0] - 2026-11-19 (DH-20261119-PRICING-RETURN-PROMOTION-272 · promoción de devolución Pricing)

- MINOR coordinado: los cambios del flujo de devolver solicitudes a Ventas ya están validados en develop 1.101.0; este release actualiza la versión global de Web/System 1.102.0→1.103.0 para promover el mismo código al entorno productivo con Pricing 1.25.1.
- Mantiene panel Pricing, motivo obligatorio, notificación realtime y correo, corrección/reenvío desde Ventas. Sin cambios funcionales adicionales en develop. CI/staging obligatorios antes de promover a master.

## [1.102.0] - 2026-11-19 (DH-20261119-PRICING-CLIENT-COUNTRY-PROD-271 · Promoción país de cliente / Incoterms)

- MINOR: global Web/System 1.101.0 → 1.102.0 con CRM 1.42.0 ya integrado. Al distribuir cargos por Incoterm, la operación se decide desde el país cliente CRM frente al POL y POD final.
- El nuevo master backport no arrastra cambios de develop; conservar corrección PRICING-RETURN-REQUEST-271. IVA/CRC sigue al destino físico, error visible si falta país; pruebas automatizadas incluidas.
- Producción autorizada expresamente; requiere CI y staging antes de master.

## [1.101.0] - 2026-11-19 (DH-20261119-PRICING-RETURN-REQUEST-271 · devolver solicitudes de tarifa)

- MINOR: agrega «Devolver solicitud» a la par de «Continuar tarifa» en la bandeja de Pricing. Modal Dh con motivo obligatorio; reserva exclusiva, validación API y actualización de la cola.
- El vendedor ve el estado «Devuelta para corregir» con motivo literal, puede corregir y reenviar el mismo formulario; la notificación por sistema abre la edición y el correo sale del outbox de Pricing.
- Conserva supervisor de solo lectura, escenarios de edición normal y polling/reconciliación realtime. DholeWeb 1.100.1→1.101.0; DholeSystem 1.100.1→1.101.0. CI/staging antes de master.

## [1.100.1] - 2026-11-19 (DH-20261119-CRM-PREFERENTIAL-ROUTE-271 · Corrección del filtrado por POL/POE/POD)

- PATCH: la opción «Mostrar todos los ítems de Pricing» ya no omite las restricciones de POL, POE, POD, naviera, Incoterm ni servicios.
- El catálogo puede incluir otras modalidades únicamente cuando son compatibles con los puertos seleccionados; los cargos generales permanecen disponibles.
- Se excluyen costos con POE/POD diferentes de los elegidos y cargos asociados a otro puerto mediante portRole=Any o legado sin rol.
- Agrega pruebas de regresión con POE Caldera y POD San José para costos de Panamá, junto con controles sobre servicios y naviera.
- Web/System 1.100.0 → 1.100.1; CRM 1.41.0 sin modificaciones. Validar CI, manifiesto y staging antes de promover.

## [1.100.0] - 2026-11-19 (DH-20261119-CRM-PREFERENTIAL-MATCH-270 · cargos manuales, servicios y fallback preferencial)

- MINOR: los acuerdos de CRM admiten servicios opcionales del catálogo pricing-services, todas las modalidades (incluido aéreo), puertos/equipo opcionales y un selector para ver todos los ítems de Pricing.
- Formulario de alta manual de ítems preferenciales sin tocar costos originales de Pricing; vista completa de acuerdos guardados.
- Vista previa con selección de la coincidencia más específica y tarifa general de respaldo; al crear una específica no se sobrescribe la general.
- DholeWeb/DholeSystem 1.99.0 → 1.100.0; CRM 1.40.0 → 1.41.0; validar CI, migración y staging antes de promoción a master.

## [1.99.0] - 2026-11-19 (DH-20261119-PRICING-CLIENT-COUNTRY-269 · País CRM determina perspectiva Incoterm)

- MINOR: para rutas internacionales, el país de la cuenta/prospecto CRM frente al POL y POD final determina si la tarifa se solicita como importación, exportación o tránsito/doméstico, sin referencia fija a Costa Rica.
- El asistente aplica la perspectiva del cliente al Incoterm y al flete internacional. Si faltan países de CRM/Config, detiene el avance/guardado con explicación visible; los datos aduaneros, IVA y CRC siguen ligados al destino físico.
- API CRM incorpora countryId para cuentas y prospectos en el selector existente sin alterar permisos; pruebas de regresión Honduras/Costa Rica/tercer país.
- DholeWeb/DholeSystem 1.98.1 → 1.99.0; CRM 1.39.0 → 1.40.0; el resto sin cambios. Candidato CI y staging antes de producción.

## [1.98.1] - 2026-11-19 (DH-20261119-GCF-CIF-268 · cobertura GCF y CIF sin flete)

- PATCH: Al guardar Grupo Castro Fallas, la metadata materializa los 249 países y territorios ISO 3166-1 en countries/countryCodes sin eliminar datos anteriores; allCountries sigue cubriendo futuras incorporaciones.
- Pricing FCL incluye agentes globales como GCF para cualquier POL y prioriza agentes específicos válidos del origen.
- La duplicación CIF/CFR de importación no exige flete marítimo nuevo cuando no lo paga el cliente; FOB y demás operaciones con flete siguen validadas.
- DholeWeb y DholeSystem develop 1.98.0 → 1.98.1, sin modificar versiones de servicios no afectados. CI/staging obligatorios antes de master y sin despliegue de producción.

## [1.98.0] - 2026-11-19 (DH-20261119-CRM-PREFERENTIAL-SCOPE-267 · Tarifas preferenciales por naviera e Incoterm)

- MINOR: selección de naviera e Incoterm en CRM > Cuentas > Tarifas preferenciales, para personalización de venta por ruta y edición de acuerdos anteriores.
- Los criterios forman parte del ámbito guardado y filtrado de costos de Pricing; las selecciones generales mantienen compatibilidad con beneficios antiguos.
- Tarifas originales de Pricing no se modifican ni se aplican automáticamente a cotizaciones. Pruebas unitarias añadidas; CI/staging antes de master.
- DholeWeb y DholeSystem 1.97.7 → 1.98.0; DholeCRMService 1.38.0 → 1.39.0.

## [1.97.7] - 2026-11-19 (DH-20261119-DHOLE-REBRAND-266 · Identidad Dhole System)

- PATCH: Identidad Dhole System, icono SVG transparente de globo, paquete y ruta para favicon, acceso y navegación en ambos entornos.
- Traducciones ES/EN y número de versión sincronizados; no cambian identificadores técnicos, permisos, datos ni APIs.
- Web/System 1.97.6 → 1.97.7. Validar CI y staging antes de master.

## [1.97.6] - 2026-11-19 (DH-20261119-PRICING-CIF-NAV-265 · Avance CIF sin alternativas FCL)

- PATCH: cuando CIF/CFR de importación cubre el flete internacional, el wizard FCL no activa el recorrido MultiQUO de alternativas marítimas con 0 navieras seleccionadas.
- Pantalla 6 avanza directamente a Pantalla 7 con el botón Continuar, cargando cargos de destino, transporte local y aduanas sin requerir flete.
- Las cotizaciones FOB/EXW importación y CIF exportación conservan la selección MultiQUO cuando corresponde; pruebas de regresión para cola de 0 alternativas.
- Release Web/System 1.97.5 → 1.97.6, manteniendo marca exclusiva de staging y las mejoras GCF del release anterior; CI/staging obligatorios antes de master.

## [1.97.5] - 2026-11-19 (DH-20261119-GCF-ALL-COUNTRIES-264 · Cobertura mundial GCF)

- PATCH: Grupo Castro Fallas opera con todos los países como agente global; formulario de catálogos muestra «Todos los países» y guarda metadata.allCountries en cada edición, conservando campos históricos.
- En Pricing, GCF está disponible como alternativa para cualquier origen (incluidos países nuevos), sin desplazar agentes específicos de ese país.
- Pruebas de reconocimiento de GCF y sincronización no destructiva de países/códigos. DholeWeb/DholeSystem 1.97.4 → 1.97.5; demás servicios sin cambios.
- Se conservan en develop la corrección CIF 1.97.3 y la identidad visual 1.97.4. CI y staging pendientes; producción no autorizada.

## [1.97.4] - 2026-11-19 (DH-20261119-DHOLE-ORVELUM-ICON-STAGING-263 · Dhole System con símbolo Orvelum solo en staging)

- PATCH: en staging se muestra Dhole System en login, sidebar, avisos de actualización y título de pestaña con versión.
- Se conserva el ícono orbital transparente de Orvelum en login, menú y favicon, sin cambios en su geometría, colores o comportamiento.
- Exclusivo de develop/staging. No modifica master, servicios, APIs, permisos, realtime ni producción.
- DholeWeb y DholeSystem 1.97.3 → 1.97.4; otros componentes mantienen sus versiones.

## [1.97.3] - 2026-11-19 (DH-20261119-PRICING-CIF-NO-FREIGHT-262 · Importación CIF sin flete marítimo adicional)

- PATCH: Pantalla 6 del wizard FCL oculta ambas tarjetas de creación de flete manual cuando el Incoterm ya cubre el tramo internacional (CIF/CFR en importación).
- Impide crear una fuente manual de flete por llamada directa en operaciones sin ese cargo; conserva cargos de destino y aduanas.
- Al omitir Pantalla 5, agente, naviera y moneda se eligen en Pantalla 6 sin bloquear la selección de naviera.
- Regresiones CIF importación, FOB importación, CIF exportación y DDP exportación. Web/System 1.97.2 → 1.97.3; CI y staging pendientes antes de master.
- Preserva Dhole en develop/staging; sin despliegue productivo.

## [1.97.2] - 2026-11-19 (DH-20261119-RESTORE-DHOLE-DEVELOP-260 · Dhole en develop)

- PATCH: desarrolla/staging vuelve a nombre visible Dhole y textos ES/EN originales, inicial D en login, logo GCF en menú y favicon ICO heredado.
- En production/master se mantiene el nombre Orvelum System. Título de pestaña de develop: Dhole System · v1.97.2.
- Sin alteraciones de contratos, servicios, rutas, scopes ni lógica de negocio.

## [1.97.1] - 2026-11-19 (DH-20261119-OPS-DASHBOARD-UX-257 · Rediseño del Dashboard operativo)

- PATCH: sustituye dos encabezados grandes por una sola cabecera de Operaciones que integra el selector de rol y el filtro de equipo con componentes DhSelect.
- KPI compactos, barra de acciones adaptable a pantallas estrechas y estado vacío breve con acceso a Trámites; al cargar/cambiar equipo no se presentan ceros ni datos anteriores como resultados actuales.
- Se mantienen scopes, permisos de equipos, endpoints REST, SignalR, las vistas Pricing/Vendedor y el acceso a /operations/apertures; i18n español/inglés y pruebas de regresión.
- DholeWeb y DholeSystem 1.97.0 → 1.97.1; otros componentes sin cambios. CI y staging pendientes; producción no autorizada.

## [1.97.0] - 2026-11-19 (DH-20261119-ORVELUM-BRAND-256 · Orvelum System)

- MINOR: identidad comercial Orvelum System en español/inglés, ingreso, sidebar y avisos de actualización.
- Icono orbital original en interfaz y favicon SVG; título del navegador con versión real del build: Orvelum System · v1.97.0.
- Versionado Web/System sincronizado, sin cambiar nombres técnicos de repositorios, contratos API, scopes ni eventos.

## [1.96.1] - 2026-11-19 (DH-20261119-OPS-SIDEBAR-255 · Navegación de Operaciones simplificada)

- PATCH: elimina únicamente la entrada de «Aperturas» del sidebar de Operaciones; permanecen «Trámites» y «Equipos» según scopes.
- La ruta protegida /operations/apertures, la validación dual, los datos y el acceso desde Dashboard se conservan intactos.
- Web/System 1.96.0 → 1.96.1; Operations y demás servicios conservan sus versiones. Staging y CI pendientes.

## [1.96.0] - 2026-11-19 (DH-20261119-OPS-ROLE-TEAM-DASHBOARD-254 · Dashboard operativo por rol y equipo)

- MINOR: selector de Dashboard por permisos (Pricing, Vendedor y Operaciones) y vista de Aperturas con totales reales por equipo y validaciones visibles al usuario.
- El directorio de Equipos muestra selección directa, asignaciones compactas y bitácora accesible pero contraída; conserva DhMultiSelect, auditoría y roles de Auth.
- Diseño más sobrio de la bandeja de Pricing: prioridad indicada por el borde y la etiqueta sin tintar toda la fila de rojo.
- Web 1.95.1 → 1.96.0; Operations 0.11.0 → 0.12.0; System 1.95.1 → 1.96.0. Preparado en ramas intermedias, sin autorización de producción.

## [1.95.1] - 2026-11-19 (DH-20261119-DH-MULTISELECT-OVERLAY-253 · DhMultiSelect sólido)

- PATCH: el menú desplegable DhMultiSelect se teletransporta a la capa superior para evitar que AuditLogs y otras tarjetas de cristal tapen o atraviesen sus opciones.
- Superficie totalmente opaca mediante `--dh-card-solid`, compatible con modo claro y oscuro; posición adaptativa al desplazamiento y borde de ventana.
- Mantiene búsqueda, selección múltiple y cierre mediante Escape o clic fuera; prueba de regresión incorporada.
- Web/System 1.95.0 → 1.95.1 coordinados. Se conserva Blobatar 1.95.0; no se alteran servicios, scopes ni APIs.

## [1.95.0] - 2026-11-19 (DH-20261119-BLOBATAR-TRANSPARENT-252 · Mascota transparente, permanente y accesorios)

- MINOR: Blobatar permanece como mascota autenticada aunque el usuario no tenga foto; la fotografía sigue siendo opcional para el perfil, sin alterar el avatar de otros usuarios.
- Accesorios SVG para la mascota: gorra, corona, gafas, audífonos, lazo y sombrero; elección persistente por usuario en el navegador y vista previa en Apariencia.
- Se elimina el círculo blanco, las burbujas y el tooltip nativo; nombre y emoción traducida se muestran exclusivamente al pasar el cursor o enfocar con teclado. Se preservan 58 expresiones, movimiento, arrastre y acceso sin mouse.
- Release DholeWeb y DholeSystem 1.95.0; manifiesto global y pruebas actualizadas.

## [1.94.0] - 2026-11-19 (DH-20261119-OPS-TEAM-BULK-251 · Selección múltiple de equipos)

- MINOR: DhMultiSelect para seleccionar varios colaboradores y asignarlos en una sola acción; edición individual conservada.
- Carga paginada de usuarios elegibles desde Auth y traducciones ES/EN; tests de regresión.
- DholeWeb 1.93.0 → 1.94.0; ecosistema 1.94.0. Release coordinado con Auth, Operations, Web y System. CI y staging pendientes.

## [1.93.0] - 2026-11-19 (DH-20261119-BLOBATAR-MASCOT-250 · mascotas y 58 emociones Blobatar)

- MINOR: cinco poses nativas nuevas (Cringe, Burlón, Pícaro, Paranoico y Disociado) agregadas al catálogo de 53: ahora 58 emociones, con traducciones ES/EN y pruebas SSR.
- Perfil: imagen local optimizada para el avatar; cuando hay foto, Blobatar se presenta como mascota flotante, con nombre propio, arrastre manual, movimiento automático o fijo, visibilidad y preferencias por usuario en navegador. Respeta movimiento reducido y no aparece en rutas públicas/embebidas.
- Versionamiento DholeWeb y DholeSystem 1.93.0; otros componentes conservan la versión del manifiesto. CI/staging necesarios; producción sin autorización.

## [1.92.1] - 2026-11-19 (DH-20261119-OPS-ROLE-NAME-249 · rol elegible real)

- PATCH: el selector de equipos muestra «Operativo Logístico» y «Supervisor Operativo», los nombres existentes en Auth.
- Sin creación de roles nuevos; se mantiene el rediseño DH-247 y las 36 emociones de Blobatar v1.92.0. Web y System alineados en 1.92.1.

## [1.92.0] - 2026-11-19 (DH-20261119-BLOBATAR-EMOTIONS-248 · 36 nuevas emociones Blobatar)

- MINOR: 36 expresiones nativas SVG con poses individuales; total 53, con etiquetas ES/EN y restauración de preferencias por usuario.
- Selector DhSelect en Apariencia para elegir una expresión fija; rotación automática, sincronización entre pestañas y movimiento reducido preservados.
- Versión global Web/System 1.91.0 → 1.92.0; resto de componentes sin cambios. CI y staging obligatorios antes de producción.

## [1.91.0] - 2026-11-19 (DH-20261119-OPS-AUDIT-ROLE-247 · Operaciones, auditoría y roles)

- MINOR: rediseño de Equipos con DhSelect en lugar del listado de tarjetas; solamente aparecen usuarios elegibles por rol en el selector. Timeline unificada de Equipos/Aperturas con acciones ES/EN, fecha, responsable, comparativa antes/después y detalles técnicos plegados. Consulta independiente de nombres de autores de auditoría.
- Release coordinado DholeWeb/DholeSystem 1.89.0→1.91.0; Auth 1.15.0→1.16.0; Operations 0.9.0→0.10.0. Ecosistema 1.91.0. CI/staging y comprobación de producción obligatorias.

## [1.89.0] - 2026-11-18 (Versión unificada con System y aviso de actualización)

### Added
- MINOR DH-20261118-WEB-VERSION-SYNC-236: Web y System comparten la versión 1.89.0 de forma obligatoria en el manifiesto y el CI de releases.
- Diálogo emergente responsive «Se requiere actualizar» al detectar otra versión o commit de /version.json (intervalo de 60 s, recuperar foco y reconexión).
- Botones «Actualizar ahora» y «Más tarde» sin recarga forzada ni pérdida automática de formularios; textos en español e inglés.
- /version.json con validación de origen y sin fallback SPA; verificación contra System en CI de develop/master.
- Versiones: DholeWeb 1.84.0 → 1.89.0; DholeSystem 1.88.0 → 1.89.0. CI y staging pendientes; despliegue de producción no autorizado.


## [1.85.0] - 2026-11-18 (DH-20261118-OPERATIONS-TEAM-UX-241 · i18n y gestión operativa)

- MINOR: sidebar de Operaciones traducible (ES/EN) con Trámites, Aperturas y Equipos; directorio general paginado de IDTRA con resumen y departamentos, sin duplicar el expediente.
- MINOR: rediseño de equipos con catálogo estándar, búsqueda y asignación manual de usuarios internos de Auth, edición de roles, disponibilidad y capacidad; no se crean usuarios ni scopes automáticamente.
- Traducciones de bandeja de Aperturas y revisión doble sin alterar su autorización; se mantiene la auditoría Outbox/Redis/SignalR.
- DholeWeb 1.84.0 → 1.85.0; Operations 0.7.0 → 0.8.0; versión objetivo de ecosistema 1.89.0. Integración sujeta a CI y staging; producción no autorizada.

## [1.84.0] - 2026-11-18

### Added
- Prospect onboarding with hierarchical province/canton/district, initial notes and Config acquisition sources.
- Multiple contacts on prospect creation and a dedicated contact-management detail tab.
- Prospect-to-account conversion transfers existing contact identities and location data.
- Preserve existing CRM permissions, real-time events and REST APIs.

## [1.83.1] - 2026-11-18 (Ventas: retirar cancelación de cotizaciones)

- PATCH DH-20261118-SELLER-CANCEL-HIDE-234: elimina «Cancelar cotización» del dashboard comercial de vendedores (móvil y escritorio), detalle y modal de decisión. Permanecen Ver tarifa, aceptación, rechazo, PDF y modificaciones permitidas.
- La cancelación de cotizaciones aceptadas permanece exclusivamente en el módulo Pricing con scopes y auditoría existentes; sin cambios en REST, microservicios ni SignalR.
- DholeWeb 1.83.0 → 1.83.1; DholeSystem/ecosistema 1.87.3 → 1.87.4. CI y staging pendientes; producción no autorizada.

## [1.83.0] - 2026-11-18 (CRM: agenda compartida e invitados internos)

- MINOR DH-20261118-CRM-SHARED-AGENDA-229: selección múltiple de empleados de Auth como invitados a llamadas, citas, reuniones y seguimientos. Misma actividad visible en sus calendarios y recordatorios individuales Email/System mediante Outbox.
- Cambios de invitados en detalle, roles y scopes conservados, REST compatible; controles idempotentes. DholeWeb 1.82.1 → 1.83.0; DholeCRMService 1.36.0 → 1.37.0, DholeSystem/ecosistema 1.86.1 → 1.87.0.
- CI/staging pendientes; producción no autorizada.

## [1.82.1] - 2026-11-18 (LCL/LTL: peso por unidad de carga)

- PATCH DH-20261118-CARGO-WEIGHT-PER-UNIT-229: el peso introducido en cada línea ahora es unitario y se multiplica por cantidad; el peso consolidado, el equivalente por peso y el resumen de Ventas se calculan desde todas las unidades, igual que los CBM/CFT.
- El contrato REST conserva weightKg como total por línea y totalWeightKg como total de la carga. La edición divide el peso persistido por el número de unidades para evitar multiplicarlo dos veces. En solicitudes antiguas con líneas se refleja el cálculo por unidad y se requiere confirmar pesos históricos con Ventas; las solicitudes sin desglose conservan el total original.
- Web 1.82.0 → 1.82.1; Pricing 1.24.6 → 1.24.7 (release coordinado sin modificación de API); DholeSystem/ecosistema 1.86.0 → 1.86.1. CI y staging pendientes. Producción no autorizada.

## [1.82.0] - 2026-11-18 (Blobatar: estresado, cansado y resignado)

- MINOR DH-20261118-BLOBATAR-MOODS-228: tres nuevas expresiones propias para Blobatar 2.7.0: Estresado (temblor y mirada inquieta), Cansado (ojos vencidos) y Resignado (mirada caída, asimétrica).
- Las 17 poses se comparten entre el encabezado y Configuración → Apariencia; se conservan el ciclo Auto de 30 segundos, Fijo, persistencia por usuario, animaciones, mirada y movimiento reducido. Traducciones ES/EN y regresión SSR.
- DholeWeb 1.81.x → 1.82.0; DholeSystem/ecosistema → 1.86.0. Otros 15 componentes sin cambios. Sin cambios REST, SignalR o scopes; CI y staging obligatorios antes de promover master.

## [1.81.2] - 2026-11-18 (EXW LCL propio: recolecta persistente en vista y edición)

- PATCH DH-20261118-EXW-LCL-PICKUP-ROUNDTRIP-227: corregir la causa real de recolectas no visibles aun tras el release previo. La rehidratación LCL propia descartaba rubros manuales o perdía su identidad al abrir la cotización y mezclaba suplementos con la matriz.
- La vista ahora conserva exactamente los RateDetails persistidos; la edición respeta cargos de recolecta y sus importes. La fuente LCL mantiene solamente sus líneas de matriz, sin absorber rubros ajenos.
- Se incorporan costos fijos de recolecta EXW cuando coinciden con la ruta, junto a los variables, sin copiar fijos de otras etapas; el detalle alerta si una cotización antigua no tiene recolecta guardada.
- Pruebas del runtime transformado del wizard, rehidratación de vista/edición y costos fijos. DholeWeb 1.81.1 → 1.81.2, DholePricingService 1.24.5 → 1.24.6, DholeSystem 1.85.1 → 1.85.2. CI, staging y validación autenticada pendientes.

## [1.81.1] - 2026-11-18 (Pricing: recolecta EXW en LCL propio)

- PATCH DH-20261118-PRICING-EXW-PICKUP-226: recolecta editable en cotizaciones EXW/LCL propio aunque falte en el catálogo, conservando sus costos/ventas manuales al actualizar la matriz y guardar.
- Los costos EXW de recolección del catálogo se incorporan por ruta, preservando cambios del operador sin introducir cargos de otros proveedores. Modo vista solo refleja detalles persistidos.
- Regresiones añadidas. DholeWeb 1.81.0 → 1.81.1; DholePricingService 1.24.4 → 1.24.5; DholeSystem 1.84.2 → 1.85.1; ecosistema 1.85.0 → 1.85.1; CI/staging pendientes, producción no autorizada.

## [1.81.0] - 2026-11-18 (SRM · clasificación logística y cobertura de rutas)

- MINOR DH-20261118-SRM-ROUTES-225: diez nuevas categorías específicas con selección múltiple y reclasificación de antiguas categorías de transporte sin pérdida de historial.
- DhDrawer con tabs de ficha/RUTAS, cobertura de proveedores marítimos, aéreos y terrestres mediante POL/POE/POD Config, altas, edición, eliminación.
- Config aporta API de cobertura para Pricing con scopes, bitácora y realtime Outbox. Web 1.80.3 → 1.81.0; Config 1.10.1 → 1.11.0; ecosistema 1.84.3 → 1.85.0. CI/staging pendientes; no producción.

## [1.80.3] - 2026-11-18 (Pricing: flete DDP exportación terrestre LTL/FTL)

- PATCH DH-20261118-DDP-EXPORT-FREIGHT-225: corregir el filtrado de flete internacional por Incoterm para distinguir exportador/importador. DDP en exportación y EXW en importación conservan flete cuando el servicio internacional está contratado.
- La pantalla de proveedor ya no oculta ni borra costo/venta o líneas de Freight para DDP exportación; mantiene la protección contra reinicios transitorios durante carga de catálogos. Importación DDP continúa sin cargar automáticamente el flete al importador; doméstico permite tramos contratados.
- Regresiones de tipos de operación y flujo de cotización; sin migraciones, nuevos scopes ni cambios de contrato REST o eventos SignalR.
- DholeWeb 1.80.2 → 1.80.3; DholePricingService 1.24.3 → 1.24.4; ecosistema 1.84.2 → 1.84.3. CI y staging requeridos antes de master.

## [1.80.2] - 2026-11-18 (MultiQUO: una QUO comercial con alternativas A/B)

- PATCH DH-20261118-MULTIQUO-SINGLE-221: lista, búsqueda y dashboard muestran una sola QUO con dos opciones internas; aceptar la opción ganadora no rechaza la otra. El vendedor elige la opción desde su cotización sin acceder a costos internos.
- Preserva rutas multipunto 1.80.0 y liberación de reservas 1.80.1. Web 1.80.1 → 1.80.2, Pricing 1.24.1 → 1.24.2, ecosistema 1.83.4 → 1.84.1. Validar CI y staging antes de master.

## [1.80.0] - 2026-11-18 (Pricing: múltiples puntos y perspectiva comercial)

- MINOR DH-20261118-INLAND-MULTIPOINT-219: recolección y entrega registran múltiples paradas con tipo de carga y responsable de costos por punto. Se conservan coordenadas opcionales y soporte a solicitudes históricas de un solo punto.
- Incoterms EXW y DDP mantienen significado ICC; importación/exportación cambian la perspectiva de quién contrata/paga y tránsito doméstico permite responsable híbrido por tramo.
- API REST retrocompatible, outbox/inbox/SignalR y scopes existentes sin cambios; CI/staging pendientes, sin despliegue a producción.
- DholeWeb 1.79.2 → 1.80.0; DholePricingService 1.23.6 → 1.24.0; ecosistema 1.83.2 → 1.84.0.

## [1.79.3] - 2026-11-18 (Pricing: liberación de reservas bloqueadas)

- PATCH DH-20261118-PRICING-LEASE-219: «Liberar mi reserva» utiliza un release directo del backend y nunca vuelve a hacer claim; usuarios autorizados pueden liberar explícitamente reservas ajenas solo tras 45 segundos sin heartbeat, con validación atómica del servidor.
- Las reservas activas no se pueden quitar; UI refresca el estado real tras cada intento. Se preserva la exclusividad, identidad/impersonación, estado Trabajando, componentes Dh, SignalR y permisos pricing.rate.update.
- Pruebas de no re-claim, de umbral de inactividad y de consistencia del dashboard en CI. Web 1.79.2 → 1.79.3; Pricing 1.23.6 → 1.23.7; ecosistema 1.83.2 → 1.83.3.

## [1.79.2] - 2026-11-18 (Pricing: no re-bloquear al soltar una solicitud)

- PATCH DH-20261118-PRICING-LEASE-218: elimina por completo el claim automático tras heartbeat fallido; recuperar solamente con botón explícito. Token de lease aislado por usuario, idempotency keys nuevas y acción Liberar mi reserva para solicitudes propias. Otras cuentas no pueden liberar reservas ajenas.
- El backend conserva una sola reserva activa por operador y limpia otras reservas del mismo usuario, preservando workStatus, scopes, REST y realtime. Tests de ciclo de vida y modificación comercial.
- Web 1.79.1 → 1.79.2; Pricing 1.23.5 → 1.23.6; DholeSystem 1.83.1 → 1.83.2.

## [1.79.1] - 2026-11-18 (MultiQUO: números comerciales 672-A y 672-B)

- PATCH DH-20261118-MULTIQUO-IDENTITY-217: en buscador global, listados y wizard, cada alternativa FCL usa su QuoNumber, nunca el consecutivo técnico interno. Las alternativas seleccionadas mantienen su sufijo.
- Se preservan las funcionalidades Blobatar/Apariencia de 1.79.0 y se integra PricingService 1.23.5 con migración de subcotizaciones anteriores, conservando historial, auditoría, Outbox/SignalR y permisos.
- DholeWeb 1.79.0 → 1.79.1; DholePricingService 1.23.4 → 1.23.5; DholeSystem/ecosistema 1.83.0 → 1.83.1. Validaciones CI y staging aprobadas en develop.

## [1.79.0] - 2026-11-18 (Avatar: vista grande y controles en Apariencia)

- MINOR DH-20261118-BLOBATAR-APPEARANCE-216: mueve Auto/Fijo del topbar a Configuración → Apariencia y agrega un avatar grande de 160 px con expresión y botón para cambiarla. Componentes Dhole compartidos y traducciones ES/EN.
- Nuevo estado centralizado Pinia sincroniza el avatar pequeño y grande, mantiene la misma expresión, previene temporizadores duplicados y conserva preferencias locales por usuario (también entre pestañas). Continúa el ciclo de 30 segundos con pausa al ocultar la pestaña y con prefers-reduced-motion.
- DholeWeb 1.78.1 → 1.79.0, DholeSystem/ecosistema 1.82.1 → 1.83.0. Preserva cambios de Pricing Lease 214 y los 15 componentes restantes; API, SignalR y esquema sin cambios. CI y staging obligatorios.

## [1.78.1] - 2026-11-18 (Pricing: liberar reservas al cerrar solicitudes)

- PATCH DH-20261118-PRICING-LEASE-214: detener la renovación, esperar peticiones de lease en curso y liberar la solicitud antes de salir de la vista; impedir un re-claim tardío después de cerrar. Conserva las expresiones y preferencias Blobatar 1.78.0.
- Tests de regresión de cierre de pestaña, carga asincrónica y heartbeat en CI. Backend Pricing refuerza los tokens liberados; sin cambios en REST, SignalR ni scopes.
- DholeWeb 1.78.0 → 1.78.1; PricingService 1.23.3 → 1.23.4; DholeSystem/ecosistema 1.82.0 → 1.82.1. CI y staging del cambio 214 en develop aprobados; validar el candidato de master antes del merge.

## [1.78.0] - 2026-11-18 (Blobatar: conservar expresiones y modo automático)

- MINOR DH-20261118-BLOBATAR-PREFERENCES-215: la última expresión de Blobatar y el modo Auto/Fijo del encabezado se guardan en localStorage por ID de usuario. Auto rota entre 14 caras cada 30 segundos y se pausa en pestañas ocultas o con movimiento reducido. Fijo preserva la expresión elegida entre recargas.
- Se mantienen animaciones, mirada, estado de conexión y diseño claro/oscuro. Sin cambio de endpoints REST, permisos ni SignalR. Se conserva íntegramente la corrección del vendedor en el release SELLER-ACCEPTED-213.
- DholeWeb 1.77.2 → 1.78.0; DholeSystem/ecosistema 1.81.2 (Web/Pricing 213) → 1.82.0. Los restantes servicios mantienen sus versiones.

## [1.77.2] - 2026-11-18 (Ventas: cotización aceptada, edición exclusiva de Pricing)

- PATCH DH-20261118-SELLER-ACCEPTED-213: el dashboard comercial de escritorio y móvil y el detalle no permiten solicitar una modificación en una cotización aceptada, ni mientras Pricing gestiona su revisión posterior.
- La API valida también el estado real y la aceptación histórica y devuelve 409 (Pricing.SellerModificationRequiresPricing), aun si se abre la URL directamente; Pricing mantiene su edición autorizada por pricing.rate.update. Se conservan las solicitudes de tarifas no aceptadas, PDF y cancelación de aceptadas.
- Regresiones de estados y de ambas vistas, sin cambios de esquema, auditoría ni SignalR. DholeWeb 1.77.1 → 1.77.2, Pricing 1.23.2 → 1.23.3, ecosistema 1.81.1 → 1.81.2. CI y staging obligatorios antes de master.

## [1.77.1] - 2026-11-18 (Corrección: contraste del perfil en modo claro)

- PATCH DH-20261118-LIGHT-MODE-AVATAR-212: Tailwind 4 sigue html.dark de Dhole en vez de la preferencia del SO. Perfil blanco con borde suave, nombre/correo oscuros y etiqueta de expresión clara para modo claro; preserva fondo negro y textos blancos en modo oscuro.
- Preserva 14 expresiones Blobatar y su animación, fotografía/iniciales, permisos y SignalR. Regresiones de tema, SSR, CI y build; staging obligatorio antes de promoción.
- DholeWeb 1.77.0 → 1.77.1; DholeSystem/ecosistema 1.81.0 → 1.81.1; otros 15 componentes sin incremento de versión.

## [1.77.0] - 2026-11-18 (Operations: rediseño uniforme del workspace Dh)

- MINOR DH-20261118-OPS-DH-UI-211: Aperturas y Equipos utilizan DhPageHeader, DhCard, DhDataTable, DhModal, DhInput, DhSelect, DhButton, DhBadge, DhEmptyState, búsqueda y paneles de indicadores, conservando REST, scopes y auditoría.
- Expedientes con filtros y paginación; validadores dobles y equipos con disponibilidad, capacidad y alta manual de integrantes. Compatible con móvil y temas Dhole.
- DholeWeb 1.76.0 → 1.77.0, ecosistema 1.80.0 → 1.81.0, otros 15 componentes sin cambios. CI y staging requeridos; producción no autorizada.

## [1.76.0] - 2026-11-18 (Blobatar: probador de expresiones al pulsar el avatar)

- MINOR DH-20261118-BLOBATAR-EXPRESSIONS-210: el avatar superior muestra Enojado (mad) al primer clic y recorre las catorce expresiones de Blobatar 2.7.0 en clics posteriores, manteniendo cada pose y su etiqueta para pruebas. Los demás DhAvatar conservan la animación temporal existente por compatibilidad.
- Conserva fondo negro en modo oscuro, rebote, seguimiento de ojos, identidad estable, teclado y reduced-motion. Sin cambios de APIs, datos ni SignalR.
- DholeWeb 1.75.0 → 1.76.0; DholeSystem/ecosistema 1.79.0 → 1.80.0; los otros 15 componentes conservan su versión. CI, SSR y staging obligatorios antes del master.

## [1.75.0] - 2026-11-18 (Blobatar: fondo negro y animación al tocar)

- MINOR DH-20261118-BLOBATAR-DARK-TAP-209: en modo oscuro el fondo de la tarjeta de usuario y avatar pasa a negro, manteniendo el modo claro. Clic, toque, Enter o Espacio activan sorpresa, guiño, sonrisa, rebote y halo repetibles; se conserva reduced-motion, fotografía, iniciales, identidad y presencia.
- DholeWeb 1.74.0 → 1.75.0, DholeSystem/ecosistema 1.78.0 → 1.79.0. Se preservan todas las funciones de Operations 208 y los restantes componentes. Sin cambios en REST, SignalR, Outbox/Inbox ni BD.
- CI y staging DholeWeb previamente aprobados; promoción a master expresamente solicitada el 18/11/2026. Verificar publicación automática y health check de producción; UAT visual con sesión autenticada aún pendiente.

## [1.74.0] - 2026-11-17 (DH-20261117-OPS-DUAL-VALIDATION-208 · Operations Aperturas y equipos)

- MINOR: navegación Operations con equipos, selección manual de usuarios Auth, capacidades y bitácora de equipo.
- Primer workspace de Aperturas: creación manual, cola, pool automático de dos validadores, decisiones independientes y audit log por expediente.
- Scopes estrictos para lectura, administración, asignación, revisión y auditoría. Usuarios y scopes se gestionan en Auth.
- DholeWeb 1.73.0 → 1.74.0, ecosistema 1.77.1 → 1.78.0. Sin autorización de producción.

## [1.73.0] - 2026-11-17 (Blobatar: animaciones expresivas y seguimiento de ojos)

- MINOR DH-20261117-BLOBATAR-MOTION-207: animación ambiental de respiración, flotación, parpadeo y miradas, expresión happy al hover, thinking en busy y sleepy en offline; poses configurables sin cambiar la semilla estable ni la prioridad de fotografías.
- Topbar usa animación continua y ojos que siguen el cursor únicamente en punteros finos, con protección de prefers-reduced-motion. Halo sutil azul/violeta y reacción de elevación; avatares de tablas sin animación por defecto para mantener rendimiento.
- DholeWeb 1.72.0 → 1.73.0; DholeSystem/ecosistema 1.76.0 → 1.77.0; demás servicios intactos. API REST, SignalR, sesiones y persistencia sin modificaciones; regresiones de componentes SSR y CI obligatorias.

## [1.72.0] - 2026-11-17 (Dhole UI: avatares Blobatar locales)

- MINOR DH-20261117-BLOBATAR-206: DhAvatar usa @blobatar/vue + blobatar 2.7.0 con avatares SVG determinísticos y misma identidad por ID de usuario. Fotos existentes prevalecen; fallback configurable a iniciales; estados online/busy/offline sin cambios.
- DhTopbar utiliza ID de Auth y animación al pasar el cursor; tablas conservan la generación estática. Render local, sin llamadas a servidores de terceros, sin cambios a REST ni SignalR.
- DholeWeb 1.71.0 → 1.72.0; DholeSystem/ecosistema 1.74.0 → 1.75.0. CI de instalación frozen-lockfile, regresión SSR, typecheck, build y smoke staging obligatorios antes de promoción a master.

## [1.71.0] - 2026-11-17 (CRM: encargados de operaciones por cliente)

- MINOR DH-20261117-CRM-OPS-CONTACTS-204: se permite identificar uno o varios encargados operativos por cuenta de CRM, independientes del único contacto principal. Formularios de creación y edición de contactos/cliente enlazados con la API CRM; integración de consulta desde Operations.
- Preserva los cambios de Seller Cancel Accepted y SRM del master vigente. Web 1.70.1 → 1.71.0; ecosistema 1.73.2 → 1.74.0. Validar staging y CI antes de promoción; producción solo si se autoriza.

## [1.70.1] - 2026-11-17 (Ventas: cancelar solo cotizaciones aceptadas)

- PATCH DH-20261117-SELLER-CANCEL-ACCEPTED-203: el botón de cancelación solo aparece con status AcceptedByClient en dashboard y detalle, nunca mientras está enviada, vencida, abierta o rechazada; la API y el dominio aplican la misma protección.
- Motivo obligatorio, auditoría, idempotencia y realtime existentes sin cambios. Web 1.70.0 → 1.70.1; ecosistema 1.73.0 → 1.73.2. Se conserva la interfaz SRM de la versión 1.70.0.

## [1.70.0] - 2026-11-17 (SRM · ficha sin drawer ni tabs)

- MINOR DH-20261117-SRM-ARCHIVE-UI-203: creación/edición y detalle del proveedor pasan de drawer lateral a diálogos centrados de ancho amplio; identidad, contactos, bancos, crédito, bitácora y tarifas usan bloques plegables claros, sin pestañas.
- El guardado de la ficha sigue siendo único; los errores abren su bloque correspondiente y conservan el pie fijo. Las secciones de seguimiento/documentos se mantienen vinculadas al ID correcto.
- Web 1.69.0 → 1.70.0, ecosistema 1.72.0 → 1.73.0. Validar CI y staging antes de master.

## [1.69.0] - 2026-11-17 (Ventas: cancelar cotizaciones)

- MINOR DH-20261117-SELLER-CANCEL-202: botón de cancelación en dashboard de ventas (móvil y escritorio) y detalle de QUO; motivo obligatorio (1-1000 caracteres), confirmación y refresco del estado.
- Cancelación autorizada de tarifas enviadas, vencidas o aceptadas, sin ofrecer la acción a tarifas terminales o revisiones no publicadas. Reutiliza el endpoint de Pricing y conserva aceptar/rechazar.
- Web 1.68.0 → 1.69.0; ecosistema 1.71.4 → 1.72.0. Integración y pruebas CI/staging pendientes.

## [1.68.0] - 2026-11-17 (SRM · bitácora, crédito y tarifas adjuntas)

- MINOR DH-20261117-SRM-RECORDS-201: seguimiento y bitácora por proveedor dentro de Identidad y Hacienda, con gestiones de llamada, correo, reunión, visita, nota y próximo contacto; historial permanente con autor y fecha de servidor.
- Crédito: documentos adjuntos de respaldo; nueva pestaña Tarifas: archivos e imágenes de acuerdos por proveedor, descripción y fechas de vigencia. Utiliza StorageService de CRM con segregación srm.supplier.credit / srm.supplier.tariff y previsualización/descarga.
- Reutiliza permisos SRM y Storage, no mezcla expedientes de distintos proveedores ni números bancarios en metadatos. Web 1.67.9 → 1.68.0, ecosistema 1.71.3 → 1.71.4.

## [1.67.9] - 2026-11-17 (Pricing LCL: no importar cargos de naviera)

- PATCH DH-20261117-PRICING-LCL-CARRIER-200: el wizard no incorpora cargos vinculados a MAERSK ni a ninguna otra naviera en LCL marítimo, aunque el API contextual devuelva el costo o arrastre una relación legacy. Validación obligatoria en aplicación, cálculo de montos y actualización explícita desde base de datos; sin filtrar por texto ni alterar manuales históricos.
- Preserva los cargos generales/coloader y el comportamiento FCL y aéreo; pruebas de regresión para carrierId, relaciones múltiples, carrierName y carrierCode. Web 1.67.8 → 1.67.9, ecosistema 1.71.2 → 1.71.3. CI y staging pendientes; master solo tras validaciones y autorización.

## [1.67.8] - 2026-11-17 (Hacienda: Nginx accepts large JWT headers)

- PATCH DH-20261117-HACIENDA-HEADER-BUFFERS-199: corregido el 400 HTML "Request Header Or Cookie Too Large" del Nginx de DholeWeb al recibir JWT de autorización de más de 8 KB. Aumenta los buffers de cabecera a 16 KB iniciales y hasta 4 × 32 KB por conexión cuando se requiera; aplica antes del enrutamiento a Hacienda CRM/SRM.
- Conserva Authorization, scopes, autenticación, ocultación de cookies al Gateway, POST JSON de Hacienda, seguridad, realtime y demás rutas. Regresión automática sobre configuración del servidor.
- Web 1.67.7 → 1.67.8, ecosistema 1.71.1 → 1.71.2. Validar compilación y smoke staging con JWT largo antes de promover master; producción solo con autorización.


## [1.67.7] - 2026-11-17 (Pricing: los rubros de edición coinciden con la QUO)

- PATCH DH-20261117-PRICING-EDIT-ITEMS-198: edición y vista leen los mismos cargos guardados. No se incorporan costos del catálogo al entrar a editar; refrescar precios sin cambiar el contexto solo actualiza las líneas existentes, con sus IDs, impuestos, HBL, Manejos, seguros y recolectas.
- Web master 1.67.6 → 1.67.7, ecosistema 1.71.0 → 1.71.1. Conserva el release anterior Hacienda POST 197. CI, despliegue/health staging y regresión de Pricing validados; revisión manual con autenticación no ejecutada.

## [1.67.6] - 2026-11-17 (CRM Hacienda: POST fiscal y proxy reforzado)

- PATCH DH-20261117-HACIENDA-POST-197: CRM envía identificación y país mediante POST JSON autenticado, sin identificaciones en la URL; conserva GET únicamente como compatibilidad durante despliegues coordinados. El proxy mismo-origen admite únicamente GET/POST y no reenvía cookies innecesarias.
- Un HTML 400 del proxy ya no se presenta como identificación inválida. Conserva autocompletado, aislamiento de sesión, scopes y guardado manual. Web 1.67.5 → 1.67.6, CRM 1.34.2 → 1.35.0, ecosistema 1.70.6 → 1.71.0.
- CI y smoke real en staging pendientes; producción no autorizada.


## [1.67.5] - 2026-11-17 (LCL propio: seguro de carga y Manejos)

- PATCH DH-20261117-OWN-LCL-INSURANCE-196: conservar seguro de carga y Manejos al abrir, editar, actualizar matriz y guardar cotizaciones LCL propias, sin perder identificadores, costos ni ventas, evitando duplicados.
- Web 1.67.4 → 1.67.5; Pricing 1.22.5; ecosistema 1.70.6; validaciones y staging pendientes; producción no autorizada.

## [1.67.4] - 2026-11-17 (MultiQUO comercial 672-A/B en lista, dashboard y wizard)

- PATCH DH-20261117-MULTIQUO-VISIBLE-GROUP-PDF-195: las alternativas se presentan individualmente en 4. Tarifas con `quoNumber` antes de `groupQuoteNumber` o el consecutivo técnico `rateCode`; el dashboard muestra 672-A y 672-B en lugar de 672 y 673, y la cabecera del wizard coincide.
- La descarga y el correo comercial utilizan el PDF de grupo generado por Pricing 1.22.4. Se evita adjuntar solamente la ruta activa antes de escoger la definitiva.
- Web 1.67.3 → 1.67.4; Pricing 1.22.3 → 1.22.4; ecosistema 1.70.4 → 1.70.5. Pruebas y smoke staging previos a master.

## [1.67.3] - 2026-11-17 (MultiQUO: números comerciales, aprobación y PDF)

- PATCH DH-20261117-MULTIQUO-APPROVAL-PDF-194: los títulos y nombres de PDF usan `quoNumber` (672-A/672-B), nunca el consecutivo técnico `rateCode` (673) de cada RateHeader.
- Pantalla 9: aprobación grupal de márgenes pendientes con un solo clic; se refrescan todas las alternativas guardadas. Se mantiene la elección definitiva exclusiva del cliente.
- Pricing 1.22.2 → 1.22.3; Web 1.67.2 → 1.67.3; ecosistema 1.70.3 → 1.70.4; validaciones CI/staging pendientes.

## [1.67.2] - 2026-11-17 (Hacienda CRM/SRM: same-origin Gateway)
- PATCH DH-20261117-HACIENDA-SAME-ORIGIN-193: reverse proxy Nginx sobre mismo origen para las dos rutas de Hacienda, enviando token autenticado al API Gateway interno. Evita CORS sobre 502 originados en Cloudflare para el subdominio API.
- GET restringido, consulta sin access_log fiscal, sin cambiar ACL, REST, realtime u otros módulos. CRM conversiones y SRM incluidas. Requiere smoke de red en staging.
- Web 1.67.1 → 1.67.2; DholeSystem/ecosistema 1.70.2 → 1.70.3. CI/staging antes de producción.

## [1.67.1] - 2026-11-17 (CRM: consulta Hacienda resistente a fallos de red)

- PATCH DH-20261117-CRM-HACIENDA-NETWORK-192: CRM reintenta una vez un fallo de transporte de Hacienda, nunca repite respuestas HTTP y descarta consultas obsoletas. Mensajes sin cédula, URLs ni trazas; validación estricta de respuesta. No altera scopes, REST, Outbox o SignalR.
- DholeWeb 1.67.0 → 1.67.1; CRM 1.33.1/1.34.1 → 1.34.2; DholeSystem/ecosistema 1.70.1 → 1.70.2. CI y staging pendientes; no autoriza despliegue de producción.

## [1.67.0] - 2026-11-17 (SRM: eliminar proveedores)

- MINOR DH-20261117-SRM-SUPPLIER-DELETE-190: habilita Eliminar en listado y ficha SRM, protegido por srm.supplier.archive; confirmación, mensajes de conflicto por referencias y eliminación lógica auditada.
- Incorpora DELETE /api/config/srm/suppliers/{id}, sincronización visual y regresión SRM. Sin cambios ajenos de develop.
- Web 1.66.1 → 1.67.0; ecosistema 1.69.2 → 1.70.0. Backport selectivo a master autorizado por el usuario; CI y validación post-despliegue obligatorias.

## [1.66.1] - 2026-11-17 (DH-186 · SRM selects de crédito e IBAN)

- PATCH: «Crédito incluye» y «Crédito NO incluye» expanden su propio espacio en CRM/SRM, sin superponerse entre sí ni sobre «Próxima revisión»; cierre al pulsar fuera o Escape, conservando las selecciones.
- El IBAN muestra causas precisas por país, longitud y dígitos de control MOD-97. Una cadena de 22 caracteres con checksum inválido continúa rechazándose; se mantiene la seguridad de la API financiera.
- Mensaje inline al completar el largo por país y pruebas de regresión. Web 1.66.0 → 1.66.1; ecosistema 1.69.0 → 1.69.1. CI/staging y autorización de producción pendientes.

## [1.66.0] - 2026-11-17 (DH-184 · Operations en estados de servicios)

- MINOR: Operations Service aparece en Estados/Monitoreo mediante `GET /api/health/operations`, con latencia, código HTTP, versión real o registrada y hora de revisión.
- Prueba de regresión del monitor y del registro; el Gateway consulta `/ready` del servicio para verificar PostgreSQL y Redis.
- DholeWeb 1.65.3 → 1.66.0 y ecosistema 1.67.0 → 1.68.0.

## [1.65.3] - 2026-11-16 (SRM: consulta Hacienda y pie de formulario estable)

- PATCH DH-20261116-SRM-HACIENDA-182: recupera una única falla de transporte al consultar Hacienda con GET (sin repetir 4xx, 429 ni respuestas 5xx), comprueba la respuesta antes de aplicarla y muestra un mensaje claro sin exponer identificaciones ni URLs del contribuyente.
- El proveedor sigue siendo editable si Hacienda no está disponible; conserva datos ingresados y la protección de respuestas obsoletas sin reintentos ilimitados.
- En SRM, el pie de acciones se representa fuera del área con scroll mediante una ranura opcional de DhDrawer, evitando que «Guardar proveedor» y «Cancelar» tapen Descripción y otros campos. El botón guarda el formulario real mediante su ID. Sin cambios en API/REST, scopes o realtime.
- Pruebas de red, permisos, límites y diseño; Web 1.65.2 → 1.65.3 y ecosistema 1.66.2 → 1.66.3. CI y staging antes de producción.

## [1.65.2] - 2026-11-16 (SRM: IBAN por país en cuentas bancarias)

- PATCH DH-20261116-SRM-IBAN-181: las cuentas bancarias del proveedor seleccionan el prefijo ISO 3166 del IBAN según el país y limitan caracteres al largo exacto del registro SWIFT ISO 13616 (por ejemplo CR 22, DE 22, ES 24, NI 28).
- En el formulario se ve el prefijo y contador, se normalizan espacios y se restablece la cuenta al cambiar de país; países que no usan IBAN conservan el campo de cuenta nacional sin prefijo inventado.
- El guardado SRM verifica país, longitud completa y checksum MOD-97 antes de enviar a Config, preservando permisos y almacenamiento financiero; se añaden pruebas de regresión. Web 1.65.1 → 1.65.2; ecosistema 1.66.1 → 1.66.2. CI y staging pendientes antes de producción.

## [1.65.1] - 2026-11-16 (FCL multimodal Panamá: sobrepeso mayor a 19.000 kg)

- PATCH DH-20261116-PRICING-PANAMA-OVERWEIGHT-180: FCL multimodal Panamá → Costa Rica activa automáticamente Sobrepeso al superar 19.000 kg por contenedor, conservando el umbral de 21.500 kg para otras rutas.
- Los kilos excedentes se valoran como LTL/LCL terrestre Panamá → Costa Rica con cuatro costos maestros: Flete Terrestre Internacional, Bunker, Gastos Panamá a Costa Rica y Custodia + Marchamo; se respetan los tramos, mínimos y moneda y se impide guardar tarifas faltantes.
- Desglose independiente y actualizado al cambiar los pesos por unidad; sin duplicación de fletes FCL ni cargos de sobrepeso genéricos. Pruebas de límites y catálogos incompletos; CI/staging pendientes. DholeWeb 1.65.0 → 1.65.1; ecosistema 1.66.0 → 1.66.1.

## [1.65.0] - 2026-11-16 (CRM/SRM: pestañas e integración automática Hacienda · backport master)

- MINOR DH-20261116-CRM-SRM-UNIFIED-TABS-HACIENDA-179: formularios de alta y edición de cuentas CRM con pestañas horizontales funcionales estilo SRM, responsive, con control de visibilidad por permisos.
- Hacienda en CRM: consulta automática de identificación válida de Costa Rica y aplicación directa del nombre/razón social/tipo; visualización de régimen y actividades, reconsulta manual y sincronización de respuestas antes de guardar cuentas y prospectos.
- Backport selectivo sobre master conservando modificaciones de CRM ajenas a este release. Pruebas específicas y versionado global 1.66.0; producción pendiente de autorización.

## [1.64.0] - 2026-11-16 (SRM: interfaz CRM y Hacienda automático · backport master)

- MINOR DH-20261116-SRM-CRM-HACIENDA-UI-178: formulario de proveedores por pestañas de Identidad/Hacienda, Contactos, Bancos y Crédito; mejor responsive y errores por sección.
- Verificación automática del RUC/NIT costarricense y aplicación directa de la razón social, tipo de identificación y actividad principal disponible, al igual que CRM, sin segundo botón; control de respuestas obsoletas y espera de consulta antes de guardar.
- Backport selectivo a master; Config y Auth existentes sin cambio. DholeSystem global 1.65.0. Master pendiente de CI/validación y autorización de producción.

## [1.63.1] - 2026-11-16 (CRM: estado de finalización sincronizado y ficha legible)

- PATCH DH-20261116-CRM-COMPLETION-STATE-SYNC-177: el detalle consulta el registro persistido al regresar a la pestaña o después de fallar una finalización. Solo confirma «Completada» al comprobarlo en CRM, limpia errores anteriores cuando el servidor ya la completó, muestra la hora real y ofrece «Verificar estado en CRM».
- Presenta COMMERCIAL_FOLLOWUP como Seguimiento comercial, muestra los resultados activos de Config y oculta la hora real cuando no existe. Sin cambios en permisos, backend, REST, SignalR ni recordatorios. DholeWeb 1.63.0 → 1.63.1, DholeSystem/ecosistema 1.64.0 → 1.64.1; requiere CI y staging multiusuario antes de master y producción.


## [1.63.0] - 2026-11-16 (SRM: ficha corporativa, Hacienda y banca cifrada · master backport)

- MINOR DH-20261116-SRM-SUPPLIER-FINANCE-176: teléfono, RUC/NIT, dirección, actividad económica, observaciones y contacto principal de Finanzas para proveedores.
- Hacienda Costa Rica por identificación fiscal; confirmación explícita de razón social y actividad principal.
- Cuentas bancarias múltiples con principal única y permisos financieros, cifrado en Config y confirmación del guardado. UPPER CASE en datos descriptivos.
- Backport a master del release que pasó CI en develop y staging; incluye regresiones SRM. Ecosistema 1.64.0.

## [1.62.8] - 2026-11-16 (Completar actividades comerciales sin error)

- PATCH DH-20261116-CRM-ACTIVITY-COMPLETE-175: para completar visitas, tareas y seguimientos comerciales, el detalle CRM presenta resultados activos de Config en lugar de un campo libre y envía occurredAt=null para utilizar la hora UTC del servidor; evita «Invalid occurrence timestamp or outcome» por relojes adelantados o código Completed inválido.
- Respeta scopes, resultados configurados, historial, acuerdos, REST y realtime. DholeWeb 1.62.7 → 1.62.8; CRM master 1.32.0 → 1.33.1, CRM develop 1.34.0 → 1.34.1; DholeSystem/ecosistema 1.63.9 → 1.63.10. CI, staging y validación multiusuario obligatorios antes de producción.

## [1.62.7] - 2026-11-16 (Registro de bitácoras usando reloj UTC del servidor)

- PATCH DH-20261116-CRM-BITACORA-SERVER-CLOCK-174: `CrmSalesCalendar` envía `occurredAt: null` al crear bitácoras sin cita o actividades históricas, y CRM utiliza `ResolveOccurredAt` con reloj UTC del servidor, sin depender de la hora de cada computadora.
- Se preservan fechas históricas programadas y los acuerdos futuros como recordatorios vinculados. Web 1.62.6 → 1.62.7, ecosistema 1.63.8 → 1.63.9. Pruebas CRM, typecheck/build, CI y staging necesarios antes de master/producción.

## [1.62.6] - 2026-11-16 (Restauración de cliente/prospecto al editar QUO)

- PATCH DH-20261116-PRICING-CRM-EDIT-HYDRATION-173: el selector CRM de Pricing conserva el nombre histórico del cliente al editar o recargar una QUO sin ClientAccountId/ClientLeadId; deja visible que requiere vinculación explícita para evitar asociar un tercero por similitud.
- Las QUO ya vinculadas siguen recuperando cuenta o prospecto por ID, revalidando visibilidad y ejecutivo comercial en CRM sin cambiar el cliente durante la carga. Pruebas de regresión para ambos escenarios; sin cambios REST, permisos, almacenamiento ni SignalR.
- DholeWeb 1.62.5 → 1.62.6; DholeSystem/ecosistema 1.63.7 → 1.63.8. Requiere CI, build, staging y autorización de producción antes de master.

## [1.62.5] - 2026-11-16 (CBM por cotización vinculada a consolidado propio)

- PATCH DH-20261116-OWN-LCL-QUO-CBM-172: cada QUO del listado de consolidados LCL propios muestra su CBM cobrable y volumen físico en CBM, con datos del detalle comercial de Pricing; los valores no registrados se identifican sin inventar capacidad.
- Vista responsive, acceso «Ver QUO» y controles de lectura actuales intactos. DholeWeb 1.62.4 → 1.62.5, Pricing 1.22.1 → 1.22.2, DholeSystem/ecosistema 1.63.6 → 1.63.7. CI y staging antes de master, producción no autorizada.

## [1.62.4] - 2026-11-16 (Crear seguimiento desde cuentas y prospectos)

- PATCH DH-20261116-CRM-FOLLOWUPS-CREATE-171: botón «Crear seguimiento» en el historial de la cuenta o prospecto, visible exclusivamente con permisos de creación CRM. Abre el formulario comercial existente con seguimiento programado, cliente/prospecto y responsable precargados; permisos solo de recordatorio mantienen su flujo autorizado.
- Conserva búsqueda, filtros, historial, sincronización realtime y contratos REST sin cambios. DholeWeb 1.62.3 → 1.62.4; DholeSystem/ecosistema 1.63.5 → 1.63.6. CI y staging antes de promoción a master; sin autorización de despliegue a producción.

## [1.62.3] - 2026-11-16 (Modales y borradores CRM legibles en móviles)

- PATCH DH-20261116-CRM-MOBILE-MODALS-170: formularios de nueva actividad y recuperación de borrador usan superficie sólida y contraste consistente; el modal prioritario oscurece los modales secundarios para evitar que se vea el calendario a través de la ventana activa.
- DhModal incorpora modalidad opcional de superficie sólida sin cambiar el modo glass predeterminado; mejora cabecera, cierre táctil, scroll interior y pie de acciones en pantallas pequeñas.
- Agenda CRM: selector Registro en bitácora / Crear recordatorio en dos columnas móviles con texto legible; botones de guardado adaptables. Recuperación conserva las opciones y la semántica de borradores.
- Regresiones de maquetación y compatibilidad con el release responsive anterior, sin cambios REST/SignalR/datos/permisos. DholeWeb 1.62.3, ecosistema 1.63.5; CI, staging y posterior promoción coordinada a master.

## [1.62.2] - 2026-11-16 (Responsive móvil en Configuración y CRM)

- PATCH DH-20261116-MOBILE-CRM-SETTINGS-169: tarjetas compactas de Configuración y navegación horizontal desplazable para pestañas de Cliente y Prospecto, conservando roles, autorización y acciones.
- Agenda comercial: pestañas legibles en pantallas estrechas, controles de fecha en cuadrícula, encabezado sin superposiciones y vista inicial de listado en móviles. El calendario mensual de siete columnas permite desplazamiento horizontal cuando se selecciona.
- Pruebas estáticas de regresión responsiva, sin cambios REST, realtime, permisos ni datos. DholeWeb 1.62.2; versión global 1.63.4 coordinada con DholeSystem. CI, compilación, validación real en móviles y staging pendientes antes de master/producción.

## [1.62.1] - 2026-11-16 (API Manager: cuentas, prospectos y Castro Fallas)

- PATCH DH-20261116-API-CRM-166: selector de valores predeterminados utiliza el directorio comercial consolidado de CRM para cuentas y prospectos, con filtros de visibilidad ya aplicados por CRM.
- Conserva la asignación institucional de Castro Fallas sin tratar al creador como ejecutivo. Para el vendedor institucional, la identidad técnica autorizada de Pricing sigue siendo responsable del registro operativo.
- Revalida el registro seleccionado por ID antes de guardar defaults, distingue Cliente/Prospecto y mantiene la separación de API Keys, operaciones y permisos.

## [1.62.0] - 2026-11-16 (API Manager: valores fijos por contrato)

- MINOR DH-20261116-API-MANAGER-165: permite configurar valores fijos del lado de Gateway para POST/PUT/PATCH y seleccionar un cliente de CRM para guardar su nombre y ejecutivo en la solicitud de tarifas.
- El consumidor externo solo envía los datos variables; el backend protege valores fijos y conserva la autorización técnica por operación y API Key.
- Incorpora prueba de regresión, compatibilidad con contratos anteriores y catálogo de rutas aprobadas como alternativa al inventario en vivo.

## [1.61.1] - 2026-11-16 (API Manager: edición y publicación de catálogos Config)

- PATCH DH-20261116-API-MANAGER-164: corrige DataCloneError al abrir Administrar y al actualizar una API publicada, generando DTO de edición independiente del proxy reactivo.
- Gateway emite identidad técnica limitada a lectura para catálogos Config, y mantiene control estricto para otras operaciones, con API Keys existentes preservadas.
- Añade test de regresión y gate de TypeScript/compilación.

## [1.61.0] - 2026-11-16 (Scopes Create/Update/View en LCL propios)

- MINOR DH-20261116-OWN-LCL-SCOPES-163: navegación y listado protegidos por view; creación protegida por create; edición, renombrado y guardados protegidos por update, sin bypass de rol en el cliente.
- La lista de QUOs relacionadas es de consulta; el acceso directo al wizard comercial requiere además pricing.rate.view.
- Web 1.60.0 → 1.61.0; Auth 1.11.0, Pricing 1.21.0, global 1.62.0. CI y staging requeridos antes de master.

## [1.60.0] - 2026-11-16 (QUOs vinculadas a consolidados LCL propios)

- MINOR DH-20261116-OWN-LCL-QUOS-162: al abrir el consolidado se muestran QUOs vinculadas (número, cliente, fecha y estado), con actualización y navegación directa al wizard de consulta.
- Maneja sin cotizaciones, permiso insuficiente y error REST; descarta respuestas tardías al cambiar de consolidado. Sin cambios de costos ni inventario.
- Web 1.59.0 → 1.60.0, Pricing 1.20.0, Dhole global 1.61.0. CI/staging antes de producción.

## [1.59.0] - 2026-11-15 (Centro de colas operativo)

- MINOR: nueva consola de operaciones de DataExtraction y AI con filtros, paginación server-side, estados por etapa, errores, leases, correlación, tiempos, Redis/Ollama, reintentos seguros y permisos AI.
- Global Dhole 1.60.0, release DH-20261115-QUEUE-CONTROL-145. Pendiente de CI y staging; sin nuevo permiso de producción.

## [1.58.0] - 2026-11-15 (API Manager: metadatos reales y filtros de Config)

- MINOR DH-20261115-API-METADATA-161: el asistente de APIs explica la selección de metadatos completos de Config, propiedades individuales y filtros opcionales de terminal CY/SD/APT, modalidad, país e IATA.
- El selector recibe el catálogo ampliado de Gateway y preserva campos ya guardados, API Keys y consola de pruebas GET/publicadas. No se agregan flags.
- Release conjunto Gateway 1.9.0, Web 1.58.0 y System 1.58.0; Config mantiene la metadata original y la clasificación por registro.

## [1.57.1] - 2026-11-15 (Diagnóstico de API Manager y carga parcial)

- PATCH DH-20261115-THIRD-PARTY-404-155: separa las cargas de APIs, catálogo, módulos y estado de Gateway con Promise.allSettled; un fallo HTTP 404/503 identifica la ruta exacta y conserva el contenido que sí cargó.
- Ya no presenta una lista vacía como «sin APIs creadas» cuando la consulta falló. Incluye reintento y avisos de almacenamiento no disponible.
- API Keys respetan la disponibilidad de PostgreSQL y muestran errores de carga específicos, sin alterar los permisos ni la administración de contratos.

## [1.57.0] - 2026-11-14 (API Keys independientes y previsualización segura)

- DH-20261114-API-KEYS-PREVIEW-154
- MINOR: API Manager reemplaza el drawer translúcido por un área de trabajo integrada y separa APIs y API Keys en pestañas independientes.
- Creación autónoma de claves por aplicación, vinculación múltiple de APIs, administración de permisos y revocación.
- Previsualización GET de borradores sin clave ni publicación mediante JWT de sesión; conserva pruebas de rutas públicas con API Key y confirmación explícita de mutaciones.
- Corrige el GUID enviado al crear borradores y conserva la administración de campos y rutas.

## [1.56.1] - 2026-11-14 (API Manager: rediseño y consola de pruebas)

- PATCH DH-20261114-API-MANAGER-UI-153: rediseño de Nueva API, pantalla completa y responsive, microservicios con búsqueda, rutas priorizadas, opciones avanzadas plegables y navegación clara.
- Explica la generación automática de API Keys y añade consola para probar el endpoint público mediante X-Api-Key, con parámetros GET o cuerpo JSON, estado HTTP, tiempo y respuesta real. Confirma explícitamente las operaciones mutantes y evita revocar claves ante guardados sin cambios.
- Conserva los contratos públicos, políticas de autorización e integraciones existentes; no se agregan flags.

## [1.56.0] - 2026-11-14 (Dhole API Manager universal route discovery)

- MINOR: explorador de todos los servicios registrados, métodos GET/POST/PUT/PATCH/DELETE, rutas descubiertas y mapeo configurable de request/response.
- Solo permite publicar mediante contratos y API Keys con identidad técnica por ruta, sin cambiar otras pantallas.

## [1.55.0] - 2026-11-14 (API Manager promotion)

- MINOR: incorpora API Manager, ocho catálogos Config de solo lectura y rutas externas versionadas manteniendo mejoras de CRM/Pricing de 1.54.0.
- Release coordinado Gateway 1.6.2 / Web y DholeSystem 1.55.0, pendiente de staging y validación.

## [1.54.0] - 2026-11-14

- MINOR DH-20261114-CRM-CALENDAR-SPANS-142: calendario mensual con barras continuas de varios días; agenda horaria con bloques proporcionales a las horas reales; seguimientos con inicio y fecha/hora de finalización.
- Los listados incluyen intervalos superpuestos y preservan la seguridad de los registros, REST, SignalR y avisos de vencimiento. Duplicados y seguimientos históricos sin fin permanecen compatibles.
- DholeWeb 1.53.0 → 1.54.0, DholeCRMService 1.31.0 → 1.32.0, DholeSystem/ecosistema 1.53.0 → 1.54.0. CI y staging previos a master.

## [1.53.0] - 2026-11-14

- MINOR DH-20261114-CRM-RECORD-FOLLOWUPS-142: pestaña «Seguimientos» independiente en las fichas de prospectos y clientes, con historial cronológico de actividades, bitácoras y recordatorios vinculados; búsqueda, filtros, responsables, estados, paginación y acceso al detalle. Reutiliza API CRM y permisos existentes; las cuentas agrupadas comparten el historial.
- DholeWeb 1.52.1 → 1.53.0; DholeSystem/ecosistema 1.52.1 → 1.53.0; CRM continúa en 1.31.0 sin cambio de contrato. Promoción desde develop, con CI y staging antes de producción.

## [1.52.1] - 2026-11-13

- PATCH DH-20261113-PRICING-OWN-LCL-141: backport coordinado de corrección CFS del LCL propio con cantidad cobrable (mínimo 1 CBM) y proyección comercial de cotizaciones históricas; Precio USD 8/CBM por 0,118 CBM físico corresponde a USD 8.
- Master Web 1.52.0 → 1.52.1, Pricing 1.18.2. Coloader y Miami CFT intactos. Compatibilidad REST/realtime preservada.

## [1.52.0] - 2026-11-13

- MINOR DH-20261113-CRM-BITACORA-DIRECT-TASKS-PARENT-141: los acuerdos con vencimiento futuro crean directamente recordatorios desde Bitácora sin seleccionar casillas ni quitar elementos de listas; fecha sin confirmar se mantiene como nota y la hora sugerida vencida de hoy se ajusta a la siguiente franja futura. Edición sincroniza borradores de tareas con acuerdos, sin botón intermedio.
- Detalles de seguimientos enlazan a «Bitácora padre», mostrando su contexto y conservando permisos y REST. Web 1.51.2 → 1.52.0, CRM 1.30.0 → 1.31.0, DholeSystem/ecosistema 1.51.2 → 1.52.0. CI y staging obligatorios antes de producción.

## [1.51.2] - 2026-11-13

- PATCH DH-20261113-PRICING-OWN-LCL-140: recuperar cotizaciones históricas LCL propias, incluida #56 (Shandong, China): restaurar CFS por CBM cobrable también en los detalles persistidos y eliminar los rubros ajenos a la matriz (Cargos en Origen, Recolecta genérica y Manejos de catálogo).
- El recálculo explícito de Pantalla 7 acepta POL comerciales chinos sin tarifa directa usando la recolecta Shanghai con validación del país; conserva importes y detalle de la recolecta original, así como el ID del CFS al migrar de base, y cobra Manejos solo según la matriz LCL propia.
- Al guardar se excluyen y marcan para eliminación los detalles históricos ajenos al consolidado, aun cuando la ruta no cambió. Incluida regresión para CFS, Manejos y recolecta 250/255; sin alterar tarifas coloader ni contratos REST/SignalR.
- Web 1.51.1 → 1.51.2; Pricing permanece en 1.18.1; ecosistema 1.51.1 → 1.51.2. CI, staging y promoción coordinada obligatorios.

## [1.51.1] - 2026-11-13

- PATCH DH-20261113-PRICING-OWN-LCL-139: CFS de LCL propio se factura por CBM cobrable en selección, edición, navegación, restauración y recálculo, no por CBM físico.
- Los cargos de LCL propio proceden de la matriz del consolidado; se conservan Manejos y precios editados al navegar sin agregar seguros o cargos automáticos del catálogo ajeno. Los cargos manuales explícitos se preservan. Coloader no se modifica.
- Web 1.51.0 → 1.51.1; Pricing 1.18.0 → 1.18.1; ecosistema 1.51.1. CI y staging obligatorios antes de master; producción no autorizada.

## [1.51.0] - 2026-11-13

- MINOR DH-20261113-CRM-BITACORA-AGREEMENT-TASKS-138: los acuerdos en Bitácora pueden convertirse selectivamente en tareas con vencimiento, avisos y responsable, sin programar la gestión original. El editor de registros no agendados muestra el formulario de bitácora, no el de recordatorios; se conserva texto, adjuntos y borradores.
- Web 1.50.0 → 1.51.0, CRM 1.29.0 → 1.30.0 y sistema/ecosistema 1.50.0 → 1.51.0. REST/SignalR compatibles, CI y staging requeridos; no se autoriza despliegue productivo.

## [1.50.0] - 2026-11-13

- MINOR DH-20261113-CRM-SELLER-ACTIVITY-REPORTS-137: Reportes de actividades comerciales en Agenda: consolidado general y por vendedor, filtro de fechas, tipo, estado y origen, indicadores de cumplimiento, comparativos y detalle de actividades, seguimientos y bitácora.
- Exportación Excel completa y generación PDF mediante impresión; endpoint CRM autorizado por vendedor. DholeWeb 1.49.0 → 1.50.0, CRM 1.28.4 → 1.29.0 y ecosistema 1.49.0 → 1.50.0. CI/staging pendientes; producción no autorizada.

## [1.49.0] - 2026-11-13

- MINOR DH-20261113-CRM-AGENDA-NOTES-FILTERS-136: agenda permite buscar por cliente/prospecto y vendedor antes de paginar; las actividades no programadas salen del listado y aparecen en Bitácora · Notas, una tercera vista con tarjetas de notas, contenido y enlaces a documentos.
- Bitácora conserva filtro por fecha, tipo, responsable y añade búsqueda de cliente/prospecto con selección autorizada y filtrado en servidor. Mantiene ACL, REST, SignalR, Outbox y creación de recordatorios opcionales.
- Versiones: DholeWeb 1.48.4 → 1.49.0; DholeCRMService 1.28.3 → 1.28.4 (sin cambios de contrato); DholeSystem / ecosistema 1.48.4 → 1.49.0. CI/staging y aprobación de producción pendientes.

## [1.48.4] - 2026-11-13

- PATCH DH-20261113-PRODUCTION-DEPLOY-SKIP-135: elimina filtros de mensajes [no-prod] del job de producción para que los pushes a master ejecuten el build, comprobación del bundle y despliegue de Web; mantiene validación de salud. Sin flags de activación.
- Auth 1.9.2 → 1.9.3, CRM 1.28.2 → 1.28.3, Web 1.48.3 → 1.48.4 y global 1.48.3 → 1.48.4. CI y staging antes de producción; publicación solicitada el 2026-11-13.

## [1.48.3] - 2026-11-13

- PATCH DH-20261113-CRM-COMMERCIAL-LOG-ACL-134: coordinación de la ACL por prospecto en Bitácora CRM, sin cambios adicionales del frontend. Preserva filtros, borradores, adjuntos y recordatorios separados.
- Auth 1.9.1 → 1.9.2; CRM 1.28.1 → 1.28.2; Web 1.48.2 → 1.48.3; ecosistema 1.48.2 → 1.48.3. CI y staging pendientes, producción no autorizada.

## [1.48.2] - 2026-11-13

- PATCH DH-20261113-CRM-COMMERCIAL-LOG-FILTER-133: corrige selector de tipos de Bitácora desde la primera apertura, sin abrir modal. Se mantienen borradores, notas, archivos, reglas ACL y nuevo registro de gestiones.
- Coordinado con Auth 1.9.1, CRM 1.28.1 y Web 1.48.2; versión global 1.48.2. Compatible REST/SignalR. Producción no autorizada.

## [1.48.1] - 2026-11-13

- PATCH DH-20261113-CRM-AGENDA-RETURN-132: «Volver al listado» desde detalles de actividades CRM regresa a Agenda y seguimientos (`/crm/followups`), no al listado obsoleto de Actividades y visitas.
- Preserva la Bitácora comercial de 1.48.0, los retornos con `fromAccount`, permisos, borradores, REST y SignalR. Incluye tres pruebas de regresión de navegación.
- DholeWeb 1.48.0 → 1.48.1; DholeSystem/ecosistema → 1.48.1. Compilación y CI pendientes; staging antes de master y sin autorización de producción.

## [1.48.0] - 2026-11-13

- MINOR DH-20261113-CRM-COMMERCIAL-LOG-131: pestaña Bitácora separada de Agenda y recordatorios para cuentas y prospectos, con filtros por período, tipo de gestión y responsable y consulta paginada; acceso a detalles y adjuntos existentes.
- El formulario compartido mantiene contactos, borradores y drag&drop; bitácora crea registros completados sin programación ni avisos. La agenda ya no mezcla las acciones completadas y mantiene realtime/REST.
- Web 1.47.4 → 1.48.0; CRM 1.27.4 → 1.28.0; Auth 1.8.1 → 1.9.0; ecosistema 1.48.0. Producción no autorizada.

## [1.47.4] - 2026-11-13

- PATCH DH-20261113-CRM-DRAFT-RECOVERY-130: el DhModal de recuperación de borradores CRM tiene prioridad visual sobre cualquier editor, incluidos Agenda y seguimientos; evita que la recuperación quede inaccesible detrás del formulario.
- Conserva el autoguardado local de cambios mientras se resuelve la recuperación. «Más tarde» mantiene el borrador anterior sin modificaciones, y Restaurar/Descartar respetan la elección del usuario. Sin cambios en REST, SignalR, Outbox ni base de datos.
- DholeWeb 1.47.3 → 1.47.4; DholeCRMService 1.27.3 → 1.27.4 (versión de release coordinado); ecosistema 1.47.3 → 1.47.4. CI, pruebas y staging pendientes; no autorizado para producción.

## [1.47.3] - 2026-11-12

- PATCH DH-20261112-CRM-ACTIVITY-PRODUCTION-129: publicación expresamente autorizada de la corrección `DH-20261112-CRM-ACTIVITY-DB-CONSTRAINT-128` validada en CI y staging. Sin cambios funcionales adicionales; se mantienen REST, SignalR, Outbox y registro histórico.
- Web 1.47.2 → 1.47.3; CRM 1.27.2 → 1.27.3; ecosistema 1.47.2 → 1.47.3. La integración sigue el orden develop → staging → master → producción.

## [1.47.2] - 2026-11-12

- PATCH DH-20261112-CRM-ACTIVITY-DB-CONSTRAINT-128: distingue el HTTP 409 de concurrencia real del conflicto SQL por tipo de actividad CRM; muestra la causa en vez del mensaje incorrecto «El registro cambió». Evita duplicar el mismo error en el formulario y conserva el borrador y los adjuntos en caso de fallo.
- Compatible con migración CRM 1.27.2 para «Seguimiento comercial», WhatsApp, Recomendación y Oferta. Sin cambios de contrato REST, SignalR ni Outbox.
- DholeWeb 1.47.1 → 1.47.2; DholeCRMService 1.27.1 → 1.27.2; ecosistema 1.47.1 → 1.47.2. CI y staging pendientes, producción no autorizada.

## [1.47.1] - 2026-11-12

- PATCH DH-20261112-CRM-BITACORA-PRODUCTION-127: publicación autorizada a producción de bitácora CRM y recordatorios opcionales, sin cambios funcionales frente al release 126 aprobado en staging. Web 1.47.0 → 1.47.1, CRM 1.27.0 → 1.27.1, ecosistema 1.47.0 → 1.47.1. Se mantienen REST, SignalR, Outbox y ACL.
- Staging y CI deberán validarse antes de promover el mismo release a master; producción autorizada expresamente.

## [1.47.0] - 2026-11-12

- MINOR DH-20261112-CRM-BITACORA-REMINDERS-126: actividades registradas en bitácora sin fecha ni avisos; «Crear recordatorio» habilita fecha, finalización, repetición y compromisos.
- Se conservan cliente/prospecto, tipo, responsable, notas, contactos y documentos, así como actividad programada, REST y SignalR/Outbox.
- Web 1.46.0 → 1.47.0, CRM 1.26.0 → 1.27.0, ecosistema 1.46.0 → 1.47.0. CI y staging pendientes; producción no autorizada.

## [1.46.0] - 2026-11-12

- MINOR DH-20261112-CRM-ACTIVITY-TYPES-125: agenda y editor CRM incluyen Seguimiento comercial, Llamada telefónica, WhatsApp, Recomendación y Oferta; CALL mantiene su código, y FOLLOWUP conserva recordatorios y seguimiento existentes.
- Validación por catálogo Config y API CRM. Tipos consistentes en formularios, creación, edición y etiquetas del calendario; se preservan mapa de visitas, REST, SignalR y Outbox.
- DholeWeb 1.45.0 → 1.46.0; DholeCRMService 1.25.3 → 1.26.0; DholeConfigService → 1.5.0; ecosistema 1.45.0 → 1.46.0. CI/staging pendientes; producción no autorizada.

## [1.45.0] - 2026-11-12

- MINOR DH-20261112-PRICING-ROUTE-124: Pricing puede modificar exclusivamente POL, POE y POD desde el paso 5 de «Completar solicitud», mediante selectores de catálogos y guardado protegido por reserva activa. El Incoterm, carga, equipo, cliente y servicios de Ventas no son editables en este control.
- Se conserva la ruta original de Ventas, se visualiza la nueva ruta operativa, se restaura al reabrir la solicitud y se limpian selecciones de navieras, costos y líneas de la ruta anterior para volver a cotizar. Prueba de regresión para aislamiento de campos y contrato PATCH.
- DholeWeb 1.44.2 → 1.45.0; PricingService 1.17.0 → 1.18.0; ecosistema 1.44.2 → 1.45.0. CI y staging pendientes; no se autoriza despliegue a producción.

## [1.44.2] - 2026-11-12

- PATCH DH-20261112-PRICING-TARIFF-MODAL-123: rediseño del DhModal «Aplicar tarifario a cliente»: superficie sólida sin transparencia sobre la pantalla de tarifas, ancho lg en las seis entradas de Pricing y disposición responsive con resumen del maestro, selector CRM a ancho completo, ejecutivo informativo y acciones despejadas.
- El listado CRM se integra dentro del flujo del diálogo para evitar recortes y superposiciones con el pie; los demás selectores mantienen su comportamiento flotante. No se modifica identidad, permisos, contratos REST, SignalR ni la vinculación de QUO al maestro.
- DholeWeb 1.44.1 → 1.44.2 y DholeSystem/ecosistema 1.44.1 → 1.44.2; PricingService 1.17.0 y CRMService 1.25.2 sin cambios. Se requieren CI, compilación y verificación de staging antes de producción.

## [1.44.1] - 2026-11-12

- PATCH DH-20261112-PRICING-TRANSIT-LABEL-122: la pantalla 6 del asistente de tarifas terrestres FTL/LTL, aéreas y marítimas FCL/LCL muestra exactamente «Días de tránsito». Elimina la etiqueta especial «Días de tránsito para la entrega» sin modificar transitDays, guardado ni lógica de visibilidad.
- Prueba de regresión del texto. DholeWeb 1.44.0 → 1.44.1; ecosistema Dhole 1.44.0 → 1.44.1. CI, compilación y staging requeridos; promover a master por autorización del usuario tras verificar.

## [1.44.0] - 2026-11-12

- MINOR DH-20261112-PRICING-TARIFF-CRM-121: el modal «Aplicar tarifario a cliente» usa el mismo selector de cuentas y prospectos de CRM que el wizard, sin campos manuales de cliente o ejecutivo; reconsulta CRM al guardar para obtener nombres y vendedor vigentes, incluyendo Castro Fallas institucional.
- La QUO derivada envía ClientAccountId o ClientLeadId para mantener la vinculación al historial del CRM; el backend Pricing verifica cada ID/ACL con el token actual y sustituye nombres por el valor canónico. El maestro y su revisión permanecen intactos.
- DholeWeb 1.43.6 → 1.44.0, DholePricingService 1.16.3 → 1.17.0, DholeSystem/ecosistema 1.43.8 → 1.44.0. REST heredado y SignalR compatibles. CI, staging y health antes de producción.

## [1.43.6] - 2026-11-12

- PATCH DH-20261112-PRICING-CRM-TARIFF-119: Pricing respeta el ejecutivo real de CRM para cuentas y prospectos institucionales, sin sustituir Castro Fallas por el usuario conectado ni por valores antiguos de Config.
- Los borradores y las nuevas tarifas revalidan su propietario antes de guardarse; los registros CRM cuyo nombre contiene TARIFARIO se fuerzan a tarifario maestro reutilizable, preservando las QUO individuales derivadas.
- DholeWeb 1.43.5 → 1.43.6, DholeSystem/ecosistema 1.43.6 → 1.43.7; PricingService y CRMService sin cambios. Pendientes CI, compilación y validación funcional en staging; producción no autorizada.

## [1.43.5] - 2026-11-12

- PATCH DH-20261112-DYNAMICS-QUO-613-619-118: consola para conciliación de QUO-613 por línea Dhole existente y QUO-619 mediante confirmación manual de operación no aplicada, por IDTRA, RateId y cliente, separada del reenvío. No se crean cabeceras ni líneas en la acción de conciliación.
- Web 1.43.4 → 1.43.5, ecosistema 1.43.5 → 1.43.6. Se conservan controles de seguridad, DhModal, REST, SignalR y Outbox; CI/staging pendientes, sin producción.

## [1.43.4] - 2026-11-12

- PATCH DH-20261112-PRICING-LTL-CURRENCY-VALUE-118: pantalla 5 LTL (propios/coloaders) presenta Config.currencies.Value y no códigos CUR-* en venta, costo y mínimo; resuelve moneda por ID/código histórico y agrega regresión USD/CRC.
- DholeWeb 1.43.3 → 1.43.4; ecosistema/DholeSystem 1.43.4 → 1.43.5; DholePricingService 1.16.2 sin cambios. Conserva corrección de Outbox incorporada previamente en develop. CI/staging pendientes, producción no autorizada.

## [1.43.3] - 2026-11-12

- PATCH DH-20261112-PRICING-OUTBOX-CORRELATION-115: el modal de reenvío de notificaciones de QUO muestra el detalle real devuelto por Pricing, incluyendo código de error cuando exista; elimina el mensaje genérico que atribuía incorrectamente errores de Outbox a Reports.
- El backend normaliza los correlationId de Outbox mayores de varchar(100), conservando el identificador de la operación y los destinatarios; corrección reproducible para QUO-00000-000609.
- DholeWeb 1.43.2 → 1.43.3; Pricing 1.16.1 → 1.16.2; System/ecosistema 1.43.3 → 1.43.4. Sin modificar componentes UI globales, API o framework.
- Pendiente CI y validaciones staging/SMTP antes de producir nuevos correos.

## [1.43.2] - 2026-11-12

- PATCH DH-20261112-LTL-CFZ-ROUTE-116: corrige la ausencia de la ruta CFZ, Panamá → San José, Costa Rica en los tarifarios LTL propios y en Pantalla 5. Crea una tarifa propia calculada en tiempo real desde los cuatro conceptos vigentes de Costos y recargos sin requerir fila preexistente en la tabla de rutas.
- Se muestran Bunker, Flete Terrestre Internacional, Gastos Panamá a Costa Rica y Custodia + Marchamo. La selección toma el peso real y los tramos configurados, respeta ruta, modalidad y condiciones, y no agrega cargos documentales ficticios ni duplica el flete por CBM.
- DholeWeb 1.43.1 → 1.43.2, DholeSystem/ecosistema 1.43.1 → 1.43.2; PricingService conserva 1.16.0 al reutilizar el catálogo de costos sin cambiar contratos REST/SignalR.
- Validación de integración, staging y producción sujetas a CI, pruebas reales y autorización.

## [1.43.1] - 2026-11-12

- PATCH DH-20261112-LTL-PANAMA-COSTS-115: ruta LTL propia CFZ Panamá → San José Costa Rica consume los cuatro costos LTL activos del catálogo Panamá → Costa Rica: Bunker, Flete Terrestre Internacional, Gastos Panamá a Costa Rica y Custodia + Marchamo.
- Resuelve costo y venta por tramos de peso (monto fijo o por KG), evita duplicar el flete por CBM del tarifario y mantiene los costId; muestra los vínculos en LTL propios.
- DholeWeb 1.43.0 → 1.43.1 y ecosistema 1.43.0 → 1.43.1. PricingService 1.16.0 sin cambios de API. CI y staging pendientes; producción no autorizada.

## [1.43.0] - 2026-11-12

- MINOR DH-20261112-PRICING-RESEND-CHOICE-114: pantalla 9 permite seleccionar cuál notificación reenviar desde DhModal con DhSelect: Apertura con PDF, cotización enviada según preferencias CRM o aviso urgente SIN PDF.
- Los errores del servidor se muestran por etapa; las operaciones conservan el requestId al reintentar la misma opción y generan un identificador nuevo al cambiar la selección.
- DholeWeb 1.42.0 → 1.43.0, DholePricingService 1.15.0 → 1.16.0 y DholeSystem/ecosistema 1.43.0. Sin modificar estado comercial, IDTRA, REST/SignalR ni framework.
- CI/staging/SMTP pendientes antes de cerrar el incidente QUO-00000-000609.

## [1.42.0] - 2026-11-12

- MINOR DH-20261112-PRICING-ACCEPTANCE-MAIL-113: botón «Reenviar notificación» para QUO aceptadas en pantalla 9, confirmado por DhModal y restringido a pricing.rate.update.
- Reenvío manual con UUID de idempotencia compartido entre petición y Outbox; aprobación, IDTRA, PDF, adjuntos y revisión no cambian.
- DholeWeb 1.41.2 → 1.42.0, Pricing 1.15.0 y ecosistema Dhole 1.42.0; CI y staging requeridos.

## [1.41.2] - 2026-11-12

- PATCH DH-20261112-PRICING-LINKED-QUO-NUMBER-113: en pantalla 9 de Pricing Crystal, «QUO aceptada vinculada» resuelve el número comercial de la QUO mediante su ID interno; no muestra UUID, mantiene navegación y se sincroniza al actualizar/vincular otra cotización.
- El asistente anterior utiliza el mismo formato seguro y tampoco muestra el UUID cuando la consulta falla. Sin cambios de Pricing Service, REST, SignalR, datos ni permisos.
- DholeWeb 1.41.1 → 1.41.2 y DholeSystem 1.41.1 → 1.41.2. Validar CI/build y staging antes de producción.

## [1.41.1] - 2026-11-12

- PATCH DH-20261112-PRICING-CLIENT-QUO-PICKER-112: carga automática y paginada de cotizaciones enviadas y aceptadas del mismo cliente en el modal «Cliente aceptó otra QUO», con filtros, modalidad, ruta y estado. No permite vincular una QUO enviada sin aceptación; la referencia se revalida contra Pricing.
- Reconciliado con DholeWeb 1.41.0 (agrupación de cuentas CRM). DholeWeb 1.41.0 → 1.41.1, DholeSystem 1.40.1 → 1.41.1, PricingService 1.14.0 sin cambios; CI/staging pendientes, producción no autorizada.

## [1.41.0] - 2026-11-12

- MINOR DH-20261112-CRM-ACCOUNT-GROUPS-112: interfaz CRM para agrupar cuentas en una principal y vinculadas, con selección de cuentas existentes, confirmación para desvincular y DhModal propio de Dhole.
- La ficha muestra todas las cuentas del grupo; las secciones de actividades, seguimientos, análisis comercial, procedimientos, tarifas preferenciales, historial de QUO y rutas consultan registros comerciales del conjunto con filtros de permisos.
- Cada cuenta conserva su cédula, razón social, contactos, vendedor, dirección, crédito y contratos. Historial Pricing se obtiene por cuenta y se muestra consolidado sin mutar la relación original.
- DholeWeb 1.40.1 → 1.41.0; DholeCRMService 1.25.0; ecosistema 1.41.0. CI y staging pendientes; sin autorización de producción.

## [1.40.1] - 2026-11-12

- PATCH DH-20261112-CRM-DRAFT-DHMODAL-111: estandariza todos los diálogos nativos detectados, incluyendo Mercadeo (insertar enlace, archivar/eliminar contenido y categorías). Reemplaza la confirmación nativa de recuperación de borradores CRM por DhModal con botones DhButton y opciones Recuperar, Descartar y Más tarde.
- No muestra diálogos para formularios cerrados; las recuperaciones pendientes se cancelan al cambiar de registro o desmontar el formulario. «Más tarde» conserva el borrador sin pérdidas y las solicitudes concurrentes se serializan.
- Sin cambios en contratos REST, SignalR ni backend. Release coordinado con CRMService 1.24.1 y DholeSystem 1.40.1; CI y staging pendientes.

## [1.40.0] - 2026-11-11 (Dhole API Manager)

- MINOR: Builder de APIs de terceros ahora ofrece ocho catálogos de Config con selección de campos y URL pública versionada.
- Preserva operaciones existentes de Pricing y el acceso con API Keys; publicación requiere identidad técnica.
- Release coordinado con Gateway 1.6.0, pendiente de CI y staging.

## [1.39.0] - 2026-11-11

- MINOR DH-20261111-CRM-DRAFT-RECOVERY-109: autoguardado y restauración local de borradores CRM por usuario, cliente, formulario y registro. Protege cuentas, prospectos, contactos, actividades, minutas, compromisos, ubicaciones, procedimientos, créditos, contratos, rutas y vínculos comerciales ante cierre inesperado, pérdida de conexión o error de guardado.
- Los datos persistidos con éxito eliminan su borrador; los errores conservan el trabajo. Se advierte que los archivos adjuntos deben seleccionarse nuevamente. Sin escrituras automáticas a CRM, manteniendo scopes, APIs REST, SignalR y semántica de versión existentes.
- DholeWeb 1.38.1 → 1.39.0; DholeCRMService 1.23.0 → 1.24.0; ecosistema 1.39.0. CI y staging pendientes; sin autorización para despliegue en producción.

## [1.38.1] - 2026-11-11

- PATCH DH-20261111-CRM-GEOAPIFY-CSP-108: corrige el error de búsqueda de direcciones y negocios de Geoapify en visitas CRM: la política Content-Security-Policy de Nginx ahora permite explícitamente conexiones HTTPS a api.geoapify.com en connect-src, conservando el resto de dominios autorizados y las protecciones existentes.
- Agrega regresión de CSP en el test CRM Geoapify. Mantiene mapa, autocompletado, geocodificación inversa y ubicaciones guardadas sin modificar API key, REST, SignalR o datos de CRM.
- DholeWeb 1.38.0 → 1.38.1; versión global 1.38.1 (DholeSystem 1.37.2 → 1.38.1). Validar CI, despliegue y búsqueda real en staging antes de producción.

## [1.38.0] - 2026-11-11

- MINOR DH-20261111-CRM-ACCOUNT-INLINE-RELATIONS-107: agrega secciones opcionales de contactos y direcciones con alta múltiple desde «Nueva cuenta», guardadas directamente con el cliente. La edición de cuentas permite crear contactos desde la pestaña Contactos y mantiene el alta/edición de direcciones en la misma ficha.
- Reutiliza el formulario de ubicación geográfica, respeta los scopes de CRM y valida únicamente los registros opcionales que se agreguen. Web 1.37.2 → 1.38.0, CRM 1.22.0 → 1.23.0, ecosistema 1.38.0; CI y staging pendientes, sin despliegue a producción.

## [1.37.2] - 2026-11-11

- PATCH DH-20261111-PRICING-QUO-LINK-ACTION-106: muestra «Cliente aceptó otra QUO» en pantalla 9 del asistente Crystal usado para visualizar cotizaciones; el botón anterior existía únicamente en el asistente antiguo.
- En pantalla 8 de duplicación FCL, permite vincular la QUO original sin guardar ni alterar el borrador de la nueva tarifa. Modal con búsqueda, selección y validación de QUO aceptada del mismo cliente; el estado interno sigue siendo QUOVinculada, sin afectar estadísticas de vencidas o no aceptadas.
- Regresión ejecutable y compatibilidad REST/SignalR sin migración ni cambios en Pricing. Web 1.37.1 → 1.37.2; ecosistema 1.37.2; staging y CI requeridos antes de producción.

## [1.37.1] - 2026-11-11

- PATCH DH-20261111-PRICING-DUPLICATE-FCL-FREIGHT-105: corrige el guardado FCL al duplicar una tarifa y cambiar el contenedor y el flete marítimo. La pantalla 5 admite tarifa vigente o configuración manual válida cuando no existe una combinación preaprobada para los nuevos equipos; no exige RateId importado si existe un flete manual completo.
- Verifica agente, naviera, moneda, importes y línea Freight por alternativa POE/naviera; limpia montos de flete de contenedores extra heredados para no reutilizar el flete original. Incluye regresiones de fuentes importadas/manuales y validaciones de guardado.
- Versión DholeWeb 1.37.0 → 1.37.1; ecosistema 1.37.1. Conserva REST, realtime y eventos. CI y staging obligatorios; no se realiza despliegue manual a producción.

## [1.37.0] - 2026-11-11

- MINOR DH-20261111-PRICING-QUO-LINKED-104: nuevo estado comercial QUOVinculada para cotizaciones cuya operación fue aceptada bajo otra QUO del mismo cliente. El vínculo a la QUO aceptada es obligatorio, persistente y validado en Pricing.
- El módulo Web muestra «Cliente aceptó otra QUO» con búsqueda, selección y navegación al documento aceptado; las tarifas vinculadas se muestran por separado y no computan como vencidas o no aceptadas.
- Componente DholeWeb 1.36.1 → 1.37.0, ecosistema Dhole 1.37.0. Contratos REST, SignalR e infraestructura Outbox preservados. CI/staging pendientes; sin autorización de producción.

## [1.36.2] - 2026-11-11

- PATCH DH-20261111-SRM-CREDIT-NUMERIC-104: corrige el error SRM «creditDays.trim is not a function» en proveedores con crédito. Los campos numéricos del formulario Vue (plazo, límite, financiamiento e interés moratorio) admiten números y texto durante la validación, conservando rango, precisión y cero permitido para porcentajes.
- Agrega regresión con 120 días, límite USD 1.200.000 e intereses 0%, incluida validación de nulos, NaN y precisión. Mantiene API REST/SignalR existentes; CI y staging pendientes. No autorizado despliegue de producción.

## [1.36.1] - 2026-11-11

- PATCH DH-20261111-SRM-CREDIT-PERSIST-103: exige verificación de lectura posterior al POST/PUT para confirmar que los campos de crédito (plazo, límite, moneda, intereses y conceptos) y los contactos se almacenaron realmente. Nunca confirma éxito antes del readback; conserva el formulario si la persistencia no coincide y evita reintentos silenciosos.
- Agrega prueba de regresión con crédito activo de 120 días, 1.200.000 USD, intereses 0% y conceptos incluidos/excluidos. Conserva REST, realtime e integración CRM. Ecosistema 1.36.1; CI/staging pendientes y producción no autorizada.

## [1.35.0] - 2026-11-11

- MINOR DH-20261111-CRM-QUOTE-MULTI-CONTACTS-102: elimina selección de QUO individual. Configuración persistente por cuenta con DhMultiSelect para varios contactos que recibirán todas las próximas cotizaciones, con CC al vendedor asignado.
- Validación de correos y pertenencia a la cuenta, envío idempotente por Outbox y compatibilidad REST/realtime. Ecosistema Dhole 1.35.0; CI y staging pendientes.

## [1.34.1] - 2026-11-11

- PATCH DH-20261111-SRM-SUPPLIER-CREDIT-SAVE-101: corrige el bloqueo al guardar proveedores SRM con contactos y crédito. Validaciones por sección con mensajes visibles y desplazamiento al campo; casos combinados cubiertos con pruebas ejecutables.
- Revisa respuestas HTTP 200 con errores funcionales en altas y modificaciones SRM; informa fallos y confirma operaciones correctas. Compatible con API Config existente y prefijos de CRM. Ecosistema 1.34.1; CI y staging pendientes, sin autorización de producción.

## [1.34.0] - 2026-11-11

- MINOR DH-20261111-CRM-VISIT-LOCATIONS-096: selección de ubicaciones registradas de clientes y prospectos en visitas CRM, geocodificación Geoapify con fallback a búsqueda por texto libre y botón Buscar; mensajes HTTP y recuperación manual del marcador.
- Nueva pestaña Ubicaciones de prospectos, con alta y edición protegida mediante scopes; cambios de cliente reinician las coordenadas anteriores. DholeCRMService 1.21.0, ecosistema 1.34.0; CI/staging pendientes.

## [1.33.1] - 2026-11-11

- PATCH DH-20261111-SRM-SUPPLIER-SAVE-PHONE-096: el botón de guardar/actualizar proveedor SRM ejecuta la acción, valida obligatorios explícitamente y muestra errores en el panel lateral.
- Los contactos adoptan el prefijo telefónico del país elegido utilizando CrmPhoneInput (CRM); con varios países, permiten asignar país por contacto sin perder números históricos. Ecosistema 1.33.1. CI y staging pendientes; producción no autorizada.

## [1.33.0] - 2026-11-11

- MINOR DH-20261111-CRM-ACCOUNT-QUOTE-DELIVERY-093: «Configurar envío de cotizaciones» guarda por cuenta una preferencia reutilizable en todas las cotizaciones futuras, sin elegir QUO específica. El destinatario es el vendedor o un contacto elegido con copia al vendedor.
- CRM almacena configuración y valida contactos; Pricing resuelve la preferencia antes de cada envío. REST y realtime existentes se conservan; tests de regresión incluidos.
- Ecosistema 1.33.0; CI/staging pendientes antes de producción.

## [1.32.4] - 2026-11-11

- PATCH DH-20261111-CRM-GEOAPIFY-DIRECT-KEY-095: utiliza la clave pública Geoapify suministrada directamente en el componente del mapa de visitas CRM, sin requerir variables `.env` ni argumentos de compilación Docker; conserva autocompletado, puntos, coordenadas y API REST.
- Se requiere restringir la clave por HTTP referrers en Geoapify. Compatible con DholeCRMService 1.19.0. Ecosistema Dhole 1.32.4; verificación CI y staging pendientes.

## [1.32.3] - 2026-11-11

- PATCH DH-20261111-PRICING-SELLER-SYNC-094: el wizard reconoce una modificación completada por Pricing en el guardado, limpia el envío pendiente local, refresca la bandeja y vuelve a la QUO sin crear otra revisión. Reintentar una solicitud ya completada es idempotente.
- Coordinado con DholePricingService 1.11.4 y Dhole ecosistema 1.32.3. Recuperación de solicitudes históricas en backend; CI/staging pendientes y sin autorización de despliegue productivo.

## [1.32.2] - 2026-11-11

- PATCH DH-20261111-PRICING-SELLER-REQUEST-HISTORY-093: la vista de cualquier tarifa con solicitudes vinculadas presenta por separado la solicitud original de Ventas y todas las modificaciones históricas, incluyendo las completadas o canceladas, con vendedor, fecha, estado, revisión de origen y valores originales/solicitados.
- La consulta de solo lectura utiliza el endpoint de Pricing /by-rate/{rateId}/history y permisos pricing.rate.view; conserva los payloads originales y el historial de revisiones de la QUO. Coordinado con Pricing 1.11.3, ecosistema Dhole 1.32.2. CI/staging pendientes; no autorizado producción.

## [1.32.1] - 2026-11-11

- PATCH DH-20261111-CRM-QUOTE-SEND-VISIBLE-092: vuelve siempre visible «Enviar cotización» en el encabezado de cada cuenta CRM, incluso en Cliente y cuando todavía no hay QUO vinculadas. El panel muestra lista de cotizaciones enviables, opciones vendedor/cliente, contacto y CC vendedor asignado; informa cuando faltan tarifas o contactos.
- Elimina el formulario oculto bajo la pestaña Cotizaciones y conserva la validación del backend/Outbox; protege con test de regresión la disponibilidad del botón y del selector sin QUO.
- Web 1.32.0 → 1.32.1; ecosistema Dhole 1.32.1; staging y CI obligatorios antes de producción.

## [1.32.0] - 2026-11-11

- MINOR DH-20261111-CRM-GEOAPIFY-VISIT-089: actividades VISIT con mapa Geoapify, autocompletado de direcciones y negocios, selección de punto y geocodificación inversa. Conserva coordenadas en creación, edición y visualización de visitas.
- Coordinado con DholeCRMService 1.19.0 y preserva CRM Quote Delivery 1.31.0 ya integrado en develop. Ecosistema Dhole 1.32.0. CI y staging pendientes; sin autorización para despliegue productivo.

## [1.31.0] - 2026-11-11

- MINOR DH-20261111-CRM-QUOTE-DELIVERY-089: en Cotizaciones de cada cuenta CRM se puede elegir enviar la QUO al vendedor o a un contacto específico del cliente con copia al vendedor asignado.
- Valida que el contacto tenga correo y pertenezca a la cuenta; envía el PDF comercial mediante el Outbox existente, con correo distinto para el cliente sin vínculos privados. Coordina Pricing 1.11.0 y System 1.31.0; CI y staging pendientes, sin autorización para producción.

## [1.30.0] - 2026-11-11

- MINOR DH-20261111-CRM-ACTIVITY-COMPLETE-EDIT-088: pantalla de edición integral en actividades CRM, incluso completadas: título, tipo, agenda, recordatorios, minutas, acuerdos y pendientes con casillas de completado y retiro reversible antes de guardar.
- Integra la edición atómica del servicio CRM, revisa conflictos de versión y conserva los acuerdos retirados en el historial. Ecosistema Dhole 1.30.0; CI/staging pendientes; producción no autorizada.

## [1.29.2] - 2026-11-11

- PATCH DH-20261111-CRM-INSTITUTIONAL-SELLER-VISIBILITY-088: corrige la omisión del vendedor institucional Castro Fallas en los selectores de Cuentas y Prospectos. Vue convertía el prop Boolean opcional omitido en false; su valor por defecto ahora es true y ambos formularios y la reasignación lo activan explícitamente.
- La opción institucional permanece fija sobre el listado desplazable de Auth y visible independientemente de la búsqueda y los resultados de vendedores; mantiene la bandera assignToCastroFallas, sin UUID ficticio. No altera contratos REST ni SignalR. Ecosistema Dhole 1.29.2; CI y staging pendientes.

## [1.29.0] - 2026-11-11

- MINOR DH-20261111-CRM-LEAD-INSTITUTIONAL-087: permite elegir Castro Fallas como vendedor institucional de prospectos en creación y reasignación, enviando el indicador separado en vez de UUID de Auth.
- Conserva el selector de cuentas, responsables por scopes 1.28.1, controles de acceso, REST/SignalR y pruebas. Backend CRM 1.17.0, ecosistema 1.29.0. CI y staging pendientes; producción no autorizada.

## [1.28.1] - 2026-11-11

- PATCH DH-20261111-CRM-RESPONSIBLES-SCOPES-086: cambia Vendedor responsable por Responsable e incluye usuarios activos con los scopes efectivos crm.activity.read, crm.activity.read-all o crm.followup.manage; se elimina el filtro basado en roles y se actualizan las pruebas.
- Ecosistema Dhole 1.28.1, compatible con APIs REST y SignalR. CI/staging pendientes; despliegue productivo no autorizado.

## [1.28.0] - 2026-11-11

- MINOR DH-20261111-CRM-DOCUMENT-DROPZONE-086: drag & drop y carga acumulativa sin límite fijo de documentos en cuentas, prospectos, contactos, actividades, seguimientos y procedimientos, con visualización y descarga de adjuntos almacenados.
- Máximo 100 MB por archivo; sin duplicados al reintentar guardados. Web 1.28.0, CRM 1.16.0, ecosistema 1.28.0. CI/staging pendientes; producción no autorizada.

## [1.27.1] - 2026-11-11

- PATCH DH-20261111-CRM-AGREEMENT-LIST-085: permite quitar individualmente compromisos detectados en «Acuerdos alcanzados» y restaurarlos antes de guardar, sin borrar sus textos ni generar avisos para los excluidos; maneja repeticiones.
- REST/SignalR y backend conservados. Versión global 1.27.1; CI/staging pendientes; producción no autorizada.

## [1.27.0] - 2026-11-11

- MINOR DH-20261111-CRM-PROCEDURE-ATTACHMENTS-085: cada procedimiento específico de una cuenta admite múltiples documentos enlazados a su ID por Dhole Storage, carga al crear o editar, reintento seguro sin duplicar procedimientos y consulta de adjuntos en la tarjeta desplegable.
- Vista previa protegida de PDF, imágenes y texto con el visor existente; Word y Excel se descargan. La API CRM verifica visibilidad de la cuenta y permisos de edición antes de habilitar adjuntos del procedimiento.
- Ecosistema Dhole 1.27.0; DholeCRMService 1.15.0. Mantiene contratos REST, SignalR y otros adjuntos CRM. CI y staging por verificar; producción no autorizada.

## [1.26.0] - 2026-11-11

- MINOR DH-20261111-CRM-DOCUMENTS-084: documentos asociados por registro en Cuentas, Prospectos, Contactos, Actividades y Seguimientos; carga múltiple mediante Dhole Storage con validación de autorización por registro.
- Conserva mejoras de Workspace Tabs 1.25.1 de develop, REST/SignalR existentes y recuperación de carga sin duplicar actividad. Ecosistema 1.26.0; CI/staging pendientes; producción no autorizada.

## [1.25.1] - 2026-11-11

- PATCH DH-20261111-CRM-WORKSPACE-TABS-084: unifica las pestañas de Prospectos y Agenda/Seguimientos entre listas, actividades y fichas de detalle; evita duplicados al restaurar sesiones, conserva el registro activo y respeta los demás grupos.
- Ecosistema Dhole 1.25.1, coordinado con DholeSystem. REST/SignalR sin cambios; CI y staging pendientes. Producción no autorizada.

## [1.25.0] - 2026-11-10

- MINOR DH-20261110-CRM-LEAD-DUPLICATE-083: Muestra alerta de prospecto duplicado con el nombre del vendedor, conserva los datos ingresados y evita avisos emergentes duplicados por SignalR.
- Ecosistema Dhole 1.25.0; validaciones CI y staging pendientes. Sin despliegue de producción aprobado.

## [1.24.0] - 2026-11-10

- MINOR DH-20261110-CRM-ACCOUNT-CATEGORY-SCOPE-082: Restringe la asignación de categoría por scope en clientes y conversión de prospectos, conservando el CRM y las cotizaciones vigentes.
- CI y staging pendientes; no se autorizó despliegue a producción.

## [1.23.0] - 2026-11-10

- MINOR DH-20261110-CRM-LEAD-QUO-PARITY-082: Prospectos consulta QUO reales e indicadores de Pricing por ClientLeadId, integra rutas cotizadas al análisis comercial y ofrece la vinculación histórica confirmada solo a superadministradores.
- Coordinado con Pricing 1.10.0 y System 1.23.0. Conserva 1.22.0 (procedimientos de cuentas), 1.21.1 (tarifas vencidas) y DhMultiSelect. REST/SignalR compatibles; sin migraciones.

## [1.22.0] - 2026-11-10

- MINOR DH-20261110-CRM-ACCOUNT-PROCEDURES-080: pestaña «Procedimientos específicos» en cada cuenta con múltiples tarjetas desplegables, buscador, creación, edición y eliminación confirmada; campos nombre, detalle y equipo asignado.
- Integra CRUD de CRM 1.11.0, permisos crm.account.update y control de concurrencia. Preserva el PATCH 1.21.1 de tarifas vencidas; CI y staging pendientes.

## [1.21.1] - 2026-11-10

- PATCH DH-20261110-SELLER-EXPIRED-081: permite aceptar o rechazar tarifas vencidas en el dashboard y detalle del vendedor, incluso sobre la última revisión publicada sin modificaciones activas. Las solicitudes de modificación siguen disponibles.
- La vigencia original se conserva y se advierte al registrar la decisión; no se alteran permisos, borradores no publicados ni contratos REST/SignalR.

## [1.21.0] - 2026-11-10

- MINOR DH-20261110-CRM-CONTACTS-SELLERS-078: DhMultiSelect único para contactos de actividad y añadido múltiple en participantes de su detalle, sin duplicados. Mantiene los cambios previos en prospectos de 1.20.2.
- Auth filtra responsables a vendedor/superusuarios; CRM valida asignaciones. Sin migración ni cambios de SignalR.

## [1.20.2] - 2026-11-10

- PATCH DH-20261110-CRM-LEAD-PARITY-079: incorpora a Prospectos pestañas Ficha e Historial de rutas, y gráficos de cotizaciones vinculadas mediante oportunidades por ID. Corrige el tipo de pestaña history del CRM, preserva el dashboard de Pricing para Cuentas y los cambios de vendedores/compromisos de 1.20.1.
- Coordinado con DholeSystem 1.20.2. Sin migraciones ni cambios REST/SignalR; CI y staging pendientes.

## [1.20.1] - 2026-11-10

- PATCH DH-20261110-CRM-SELLERS-COMMITMENTS-078: solo Vendedores activos en selector de responsables, filtros de agenda y leyenda; casilla de compromisos habilitada para responsables autorizados mediante crm.activity.update.
- Versión global 1.20.1; compatibilidad REST/realtime. CI y staging pendientes.

## [1.20.0] - 2026-11-10

- MINOR DH-20261110-CRM-AGENDA-UNIFIED-077: todos los compromisos enlazados a una actividad principal se pueden marcar completados desde el detalle, con autorización de tareas/seguimientos, control de versión optimista y actualización del estado. Conserva el flujo unificado «Nueva actividad», la minuta, contactos, permisos y directorio seguro de la versión 1.19.5.
- Release coordinado con DholeSystem 1.20.0. CI y pruebas staging pendientes; sin migraciones ni cambios de SignalR.

## [1.19.5] - 2026-11-10

- PATCH DH-20261110-CRM-GLOBAL-AGENDAS-076: muestra todas las agendas a superadministradores y a quienes poseen ambos scopes crm.account.read-all y crm.lead.read-all. Corrige selector de responsables con directorio interno CRM autorizado, sin exigir auth.users.view; permite crear actividades para otros vendedores activos. Conserva filtros por cliente y permisos de escritura.
- Requiere DholeAuthService y DholeCRMService del mismo release; CI y staging pendientes.

## [1.19.4] - 2026-11-10

- PATCH DH-20261110-CRM-HISTORICAL-ACTIVITIES-075: permite registrar actividades comerciales pasadas conservando fecha y hora originales, completas cuando ya finalizaron, sin recordatorios retroactivos. Las minutas, participantes, acuerdos y compromisos posteriores se conservan. No altera la validación de fechas futuras de seguimientos.
- Compatible con releases existentes 1.19.2 y 1.19.3, CRM 1.9.1 y DholeSystem 1.19.4; CI y staging requeridos.

## [1.19.3] - 2026-11-10

- DH-20261110-CRM-LEAD-TABBED-DETAIL-073: ficha de Prospectos con pestañas similares a Cuentas; resumen, análisis comercial y rutas, cotizaciones, agenda y conversión, mostrando solo una sección a la vez.
- Respeta permisos, deep links de conversión y los cambios vigentes de Agenda/Realtime de develop. Ecosistema Dhole 1.19.3.

## [1.19.2] - 2026-11-10

- PATCH DH-20261110-PRICING-CRM-SELLER-MODIFICATION-075: completa la revalidación del ejecutivo comercial de prospectos CRM en el flujo independiente de solicitudes de modificación realizadas por vendedores (`submitSellerModification`). Complementa el guardado de solicitudes normales, ediciones y modificaciones de Pricing introducido en 1.19.1.
- Respeta autorización CRM por registro y no sustituye al vendedor por el usuario actual. Añade regresión; sin cambios REST, datos ni SignalR. Release coordinado DholeWeb/DholeSystem 1.19.2; staging y CI antes de promoción master.

## [1.19.1] - 2026-11-10

- PATCH DH-20261110-PRICING-CRM-LEAD-REQUESTS-074: las solicitudes de tarifas de vendedores, ediciones y solicitudes de modificación vinculadas a cuentas o prospectos CRM consultan el ejecutivo vigente por ID antes de guardar. Elimina los falsos errores de ejecutivo vacío en prospectos después de recuperar solicitudes históricas, sin depender de que la pantalla 3 esté montada.
- Mantiene visibilidad y permisos CRM, excepción Castro Fallas y compatibilidad con QUO sin vínculo, respetando el cliente cambiado y sin sustituir al vendedor por el usuario conectado. Incluye prueba de regresión; sin cambiar REST, SignalR, ni migrar datos.
- Coordinación con DholeSystem 1.19.1 y backport master DholeWeb/System 1.17.17; staging y CI pendientes, sin despliegue producción hasta validación.

## [1.19.0] - 2026-11-10

- MINOR DH-20261110-CRM-AGENDA-RECONCILED-070: agenda CRM con contactos vinculados, minuta ampliable, vendedores autorizados y compromisos reversibles con referencia a la actividad principal.
- Compatibilidad con actualizaciones previas de CRM y Web. CRM 1.9.0, System 1.19.0. CI y staging pendientes.

## [1.18.3] - 2026-11-10

- DH-20261110-CRM-PROSPECT-SELLER-072: se muestra el vendedor asignado en lista y ficha de Prospectos; administradores pueden crear o reasignar prospectos a vendedores activos mediante scopes CRM/Auth, sin exponer datos de otros usuarios.
- Respeta cambios recientes en Pricing y la selección de vendedor institucional solo para cuentas. Ecosistema Dhole 1.18.3.

## [1.18.2] - 2026-11-10

- PATCH DH-20261110-PRICING-MODIFICATION-CRM-OWNER-072: el guardado de modificaciones de tarifas vinculadas al CRM recupera por ID la cuenta y el ejecutivo comercial vigentes aunque se abra directamente en Pantalla 5 LCL, sin depender del selector de la Pantalla 3.
- Se conserva el cambio explícito de cuenta, Castro Fallas y las QUO históricas sin vinculación. Se bloquea un vendedor inexistente o inactivo; sin cambios REST, SignalR ni migraciones. Prueba de regresión y CI/staging pendientes.
- DholeWeb y DholeSystem 1.18.2, resto de servicios sin cambios. Sin autorización de despliegue a producción.

## [1.18.1] - 2026-11-10

- PATCH DH-20261110-CRM-ADMIN-CALENDAR-NAV-071: muestra las entradas de Actividades y Seguimientos en la navegación CRM a administradores Auth incluso cuando no tienen scopes individuales de vendedor. La lectura global y los permisos sobre minutas, participantes, acuerdos e historial siguen protegidos por la API CRM del release 1.18.0.
- Conserva el aislamiento para usuarios normales y los permisos de escritura; DholeSystem 1.18.1, sin cambios de esquema ni SignalR. CI y staging pendientes.

## [1.18.0] - 2026-11-10

- MINOR DH-20261110-CRM-ADMIN-CALENDAR-069: todos los administradores verificados en Auth pueden consultar todas las agendas CRM y buscar responsables, incluidos los que no tienen citas en el período. Seguimientos históricos muestran título, política, fecha e historial y minutas asociadas cuando existen.
- Conserva el release 1.17.13 de rutas/cotizaciones comerciales de prospectos. Auth 1.6.0, CRM 1.8.0 y Web/System 1.18.0; CI y staging pendientes.

## [1.17.13] - 2026-11-10

- DH-20261110-CRM-PROSPECT-ROUTES-QUOTES-069: nombres de prospectos en UPPER CASE desde API y UI, análisis comercial con rutas y cotizaciones vinculadas mediante oportunidades de CRM y Pricing.
- Release Dhole 1.17.13, sin migraciones de datos.

# Changelog

## [1.129.2] - 2026-11-25 · DH-20261125-OPS-PICKUP-COMPLETENESS

- PATCH: elimina contacto y ventana de recolecta de la apertura manual y sus bloqueos; resumen muestra puntos de recolecta, entrega y WHS, sin columnas POD vacías.


## [1.129.1] - 2026-11-25 · DH-20261125-OPS-OPERATIONAL-LOCATIONS

- PATCH: oculta la responsabilidad comercial de costos en ubicaciones de Operations; conserva comportamiento de Pricing, dirección, tipo de carga y mapa. Elimina la asignación comercial de borradores y nuevas aperturas manuales.


## [1.129.0] - 2026-11-25 · DH-20261125-OPS-PRICING-PARITY

- MINOR: apertura manual comparte reglas de países y perspectiva de Pricing, ruta dinámica, ubicaciones de recolecta/entrega y WHS FCA. Sin modalidad multimodal independiente. Candidato pendiente de CI/staging.


## [1.128.0] - 2026-11-25 · DH-20261125-OPS-OPENING-VALIDATION

- MINOR: apertura manual con terminales compatibles, eliminación de equipos incompatibles, muellaje condicional, peso estimado, dimensiones aéreas y validaciones EXW/FCA/entrega.
- Mantiene peso real en Coordinación Origen, autoguardado y asignación existentes. Candidato pendiente de CI y staging.


## [1.17.12] - 2026-11-10

- PATCH DH-20261110-PRICING-CRM-REQUEST-IDENTITY-067: solicitudes normales, edición y modificaciones de QUO recuperan el ejecutivo comercial vigente desde el CRM por ID, conservan executiveUserId al enviar y no reemplazan al vendedor con el usuario conectado. Se respetan cuentas Castro Fallas, permisos CRM, delegación y cotizaciones históricas sin vincular. Prueba de regresión pricingCrmRequestCommercialOwner; Pricing 1.9.10 y CRM 1.7.5 en develop / 1.4.2 en master.

## [1.17.11] - 2026-11-10

- PATCH DH-20261110-CRM-ACTIVITY-FULL-DETAIL-066: el detalle CRM de actividades y seguimientos muestra cliente, ejecutivo, contacto, fechas, ubicación, recordatorios, repeticiones, minuta, involucrados y observaciones; vincula compromisos con su actividad principal y muestra estado de finalización. Consulta nombres y relaciones con permisos, sin alterar datos históricos.
- Coordina DholeCRMService develop 1.7.4 / master 1.4.2 y DholeSystem 1.17.11. Nuevos endpoints REST de solo lectura, sin migraciones ni cambios en SignalR. Integración sujeta a CI y comprobación en staging.

## [1.17.10] - 2026-11-10

- PATCH DH-20261110-CRM-AGENDA-CLIENT-EXECUTIVE-065: Agenda y seguimientos muestra Cliente y Ejecutivo comercial; nombres resueltos del CRM con `calendar/labels`, lotes autorizados de hasta 100 y fallback para registros históricos.
- Mantiene las búsquedas por cédula del release 1.17.9, permisos, paginación y contratos REST. Añade pruebas de regresión.

## [1.17.9] - 2026-11-10

- PATCH DH-20261110-CRM-ACCOUNT-SEARCH-064: la búsqueda en CRM > Cuentas permite localizar por nombre comercial, razón social y cédula/identificación fiscal. El backend filtra antes de paginar; se mantienen roles y filtros.
- Añade regresión de UI para búsqueda por identidad, conserva contratos REST y SignalR, y se coordina con DholeCRMService 1.7.3 en develop / 1.4.1 en master; pendiente de CI y staging, sin producción autorizada.

## [1.17.8] - 2026-11-10

- PATCH DH-20261110-CRM-QUO-STATUS-061: sincronización de versión entre develop y master para conservar la traducción de los estados comerciales de QUO en CRM tras los releases 1.17.6 y 1.17.7 de selección múltiple de POE.
- Se mantienen las pruebas de CRM y los cambios de solicitudes FCL; sin cambios adicionales en el contrato API ni en datos.

## [1.17.7] - 2026-11-10

- FIX DH-20261110-PRICING-SELLER-MULTI-POE-063: corregir la referencia de plantilla a sellerModificationRateId, que se inyecta durante las transformaciones Vite pero no forma parte de los props visibles a vue-tsc. La validación de tipo del selector FCL múltiple para Ventas se realiza mediante una propiedad calculada tipada, sin exponer selección múltiple durante modificaciones de una tarifa existente.
- Mantener las selecciones de POE en el JSON de solicitudes para Pricing, edición y duplicación; agregar prueba de regresión del contrato y la plantilla. Se conserva un solo POE en modalidades distintas de FCL marítimo.

## [1.17.6] - 2026-11-10

- PATCH DH-20261110-PRICING-SELLER-MULTI-POE-062: Ventas puede seleccionar varios destinos POE marítimos FCL al solicitar tarifas. Se guardan todos en la solicitud, se recuperan al editar, duplicar y continuar en Pricing, y se muestran en la bandeja de solicitudes; las solicitudes anteriores conservan compatibilidad. Se mantiene la limitación de un POE para LCL, terrestre, aéreo y modificaciones de tarifas existentes.

## [1.17.5] - 2026-11-10

- PATCH DH-20261110-CRM-QUO-STATUS-061: los estados de cotizaciones vinculadas en el historial y resumen de CRM y en las tablas de vinculación histórica se presentan con traducciones comerciales (Aceptada, No aceptada, Enviada, Vencida, Abierta, Cancelada, etc.) en vez de los nombres técnicos del enum.
- Añadir etiquetas localizadas ES/EN y normalización de estados plurales heredados (Enviadas, Vencidas). No cambia el estado persistido en Pricing, las métricas ni las autorizaciones. Ecosistema 1.17.5; DholeSystem 1.17.4.

## [1.17.4] - 2026-11-10

- PATCH DH-20261110-PRICING-LAND-TRANSIT-060: mostrar «Días de tránsito para la entrega» en la pantalla 6 de tarifas terrestres FTL/LTL, incluso cuando no está seleccionado transporte internacional.
- Conservar los días introducidos al navegar entre pantallas, guardarlos como transitDays/transitTime al crear o editar y presentarlos en el resumen. Mantener ocultos el flete internacional y días libres cuando no aplican; sin cambios al contrato REST.

## [1.17.3] - 2026-11-10

- PATCH DH-20261110-PRICING-CRM-EXECUTIVE-059: Pricing envía el executiveUserId de Auth asociado a la cuenta o prospecto CRM junto con su nombre al crear y actualizar SPOT/tarifarios. Evita el error «Debe seleccionar un ejecutivo comercial» cuando el vendedor ya aparece asignado en pantalla 3.
- Valida las asignaciones incompletas antes del POST sin sustituir el vendedor CRM, preserva Castro Fallas, compatibilidad REST y precios. Coordinado con DholePricingService 1.9.5 y ecosistema 1.17.3.

## [1.17.2] - 2026-11-10

- PATCH DH-20261110-CRM-QUO-SUPERADMIN-058: la sección de vinculación de QUO históricas se presenta en un acordeón cerrado por defecto, carga datos solo al abrirse y aparece exclusivamente a SuperAdmin, SuperAdministrador, SuperUsuario y SuperUser.
- Las cotizaciones, rutas e indicadores ordinarios del cliente siguen disponibles sin el panel administrativo. Protección complementaria en Pricing 1.9.4, ecosistema 1.17.2.

## [1.17.1] - 2026-11-10

- PATCH DH-20261110-CRM-QUO-LIVE-057: indicadores y rutas CRM se consultan directamente en las QUO de Pricing vinculadas por ID de cuenta; se eliminan ceros causados por registros de oportunidades CRM no relacionados.
- Selección masiva segura de QUO pendientes por página o por resultados filtrados (hasta 1000), revisión y confirmación explícita, refresco de historial e indicadores tras vincular.
- Coordinado con DholePricingService 1.9.3, DholeSystem 1.17.1. Sin alterar importes ni estados.

## [1.17.0] - 2026-11-09 (candidate: realtime crítico Auth/Notifications)

- MINOR: recibir authSecurityChanged en la conexión universal existente, finalizar inmediatamente la sesión afectada, limpiar estado y navegar a login; los cambios de permisos disparan reconciliación con Auth. Prueba del transporte compartido.
- Ecosistema candidato 1.17.0, release `DH-20261109-RT-CRITICAL-056`. Sin merge a develop/master, despliegue o certificación WSS multiusuario. CI y staging pendientes.



## [1.16.1] - 2026-11-09

- PATCH DH-20261109-CRM-QUO-LINK-SYNC-056: la bandeja de vinculación CRM ahora lista solamente las QUO sin cuenta o prospecto. Tras vincular desaparecen de pendientes y el cliente y ejecutivo CRM se reflejan en Pricing.
- Acción para sincronizar datos CRM en tarifas previamente vinculadas; refresca listado de cliente y rutas, mantiene permisos, importes y estados. Pricing 1.9.2, ecosistema 1.16.2.

## [1.16.0] - 2026-11-09

- MINOR: el CRM muestra todas las QUO históricas en DhDataTable con búsqueda y paginación del servidor, vinculación manual confirmada por cuenta y estado visible para cotizaciones previamente asociadas.
- Integración coordinada con DholePricingService 1.9.0, sin alterar montos ni estados. Release DH-20261109-CRM-LEGACY-QUO-CATALOG-055.

## [1.15.3] - 2026-11-09

- PATCH: keep a bounded REST reconciliation timer for each active realtime observer even while NotificationsHub WebSocket reports connected. Previously a successful connection disabled polling indefinitely, allowing silently lost catalog/CRM/Pricing events to leave selects stale.
- Add regression that a connected WebSocket without resourceChanged still refreshes authorized owner REST snapshots and cancels timers on unsubscribe/logout. SignalR remains the immediate delivery channel. Staging only; global 1.15.4.


## [1.15.2] - 2026-11-09

- PATCH: subscribe once per browser to authenticated Config catalog-list invalidations on NotificationsHub. Pricing shared ports, agents and container catalogs and CRM single/multi catalog pickers reload REST options on cross-user changes, preserving user selections and drafts.
- Start/stop realtime on login/logout, preserve one socket, activate browser pilot only in staging. No production/master changes; global version 1.15.2.


## [1.15.1] - 2026-11-09

- PATCH: aceptar/rechazar cotizaciones Abiertas en Ventas cuando exista una revisión comercial enviada y no queden modificaciones abiertas. La interfaz de dashboard y detalle mantiene protegida cualquier revisión no publicada.
- Mostrar cuando el envío de PDF a Apertura queda pendiente de validación; regresión para QUO-00000-000269 y estados Open, Sent y PendingApproval. Release DH-20261109-SELLER-OPEN-DECISION-054, PricingService 1.8.1.

## [1.15.0] - 2026-11-09

- Cotizaciones Pricing: cuentas y prospectos CRM y vendedor asignado automáticamente.
- CRM Cotizaciones e Historial: conciliación manual de QUO previas sin alterar importes ni estados.

## [1.14.4] - 2026-11-09

- PATCH QUO-00000-000269: mostrar el estado real Open (Abierta) de Pricing en el panel y detalle comercial incluso cuando el snapshot de la última cotización enviada tenga estado Sent. Filtros, contadores e indicadores comerciales comparten el estado actual.
- La API separa currentRateStatus de status del snapshot; no publica borradores, cargos ni importes internos. Las acciones permanecen bloqueadas mientras revisionPending sea true.
- Regression tests para cotización abierta, solicitud de modificación abierta, aprobación y compatibilidad con APIs anteriores. Release DH-20261109-QUO269-SELLER-STATUS-053 con DholePricingService 1.7.2 y ecosistema 1.14.4 (develop).

## [1.14.3] - 2026-11-09

- PATCH Ventas/Pricing: separar revisión no publicada de modificación realmente abierta en Pricing; mostrar el estado comercial correcto sin exponer borradores.
- Refrescar tarifas del vendedor tras cambios de solicitudes y entregas diferidas, manteniendo bloqueadas las acciones hasta el envío de la revisión.
- Release coordinado DH-20261109-SELLER-PRICING-STATUS-052 con DholePricingService 1.7.1 y manifiesto central 1.14.3.

## [1.14.2] - 2026-11-09

- PATCH Pricing: mostrar inventario LCL del POE si no hay salidas compatibles y vigentes; ETD vencidas y otros POL son solo consulta, nunca cotizables.
- Preservar matriz Shanghai/Ningbo, POL físico Yantian, Balboa/Moín y guardas de selección. Contratos REST y backend sin cambios.
- Release DH-20261109-PRICING-OWNLCL-VISIBILITY-051 (develop).

## [1.14.1] - 2026-11-09

- PATCH CRM: tablas y paginación unificadas con DhDataTable y DhPagination en cuentas, prospectos, contactos, agenda, relaciones, historial de cambios y rutas.
- Selección de 10/25/50 filas, reinicio a la primera página al cambiar filtros o tamaño; respeta la paginación y autorización del backend.
- Release DH-20261109-CRM-DHPAGINATION-050; preserva el piloto realtime NotificationsHub de develop.

## [1.14.0] - 2026-11-09 (NotificationsHub universal realtime pilot; candidate)

- Coordinación 2026-11-09: integrados los commits recientes de `develop` y `master` en la rama candidata, conservando los cambios del release 1.14.0; validación post-sincronización mediante CI.

- MINOR: Share the existing Notifications SignalR endpoint and legacy notificationReceived dispatcher for resourceChanged, with REST reconciliation and staging-only Vite flags.
- Ecosystem candidate 1.14.0 / 16 Dhole repositories; CustomCodeFramework excluded. Release `rt-20261107-01`, isolated branch `feature/rt-notificationshub-20261109-01`.
- Staging compile, deployment and post-deploy security audit pending; `develop`, `master` and production not changed by this candidate.




## [1.13.8] - 2026-11-08 (Dhole realtime 1.13.15 coordination)

- PATCH synchronization with 17-repository realtime release. F2/F6 read-only AOF evidence and F10 production branch retention correction remain in DholeSystem.
- SignalR frontend stays gated/off until formal security and recovery acceptance; no develop/master merge or deploy.





## [1.13.7] - 2026-11-08 (F9 staging candidate)

- Alineación PATCH de release 1.13.14. Se conserva recuperación REST y autorización; pruebas funcionales reales de staging se ejecutarán tras desplegar a staging, sin activar flags de producción.





## [1.13.6] - 2026-11-08 (candidato F3)

- Versionado PATCH 1.13.6 / ecosistema 1.13.13 sincronizado para integrar el ensayo TLS/WSS automático del Gateway en el release coordinado. Sin cambios en comportamiento frontend, flags no activados.





## [1.13.5] - 2026-11-08 (F9 candidate only)

- Sincronizado a versión global `1.13.12` tras auditoría de staging de F6. PATCH Web `1.13.4` → `1.13.5`; no cambia estado, vistas, comunicación WS/REST, validaciones ni feature flags. Integración sujeta a gates formales del batch.





## [1.13.4] - 2026-11-08 (candidato F9, sin publicación)

- Coordina la versión global `1.13.11` de Dhole Realtime tras las correcciones de CI de Config, Reports y Gateway. PATCH Web `1.13.3` → `1.13.4` en package.json, package-lock.json y version.json; sin cambios de UI, precios, rutas ni flags.





## [1.13.3] - 2026-11-08 (candidato F9, sin publicación)

- Versionado PATCH coordinado con las 13 APIs, Gateway, System y Framework: `ecosystemVersion=1.13.10` para el batch realtime `rt-20261107-01` sin desplegar ni habilitar flags. Mantiene reconciliación REST, vista de cotización y correcciones FCL existentes sin cambios de interfaz o API; actualiza package.json, package-lock.json y version.json.





## [1.13.2] - 2026-11-08

- Reconcile current develop fixes into the isolated realtime candidate while preserving realtime security changes.




## [1.13.1] - 2026-11-08

- Purge realtime conflict snapshots on revocation and disposal; reject stale callbacks after revisiting a resource.

- F6.12 (candidato, sin release): vista AgentExecutionDetail enlazada al Hub universal por `agent.execution`, con GET REST autoritativo, polling fallback, rechazo de respuestas stale tras revocación y limpieza de caché Pinia. CI Vue/Agent/regresiones #42507658702 PASS.

- F6/F7 (candidato): soporte de los 21 recursos con ACL del Gateway, reconciliación REST aun con pistas de versión fuera de orden y purga de vistas autorizadas al logout/expiración; pruebas de contingencia C01/C02/C03/C06/C07/C09/C10/C12 agregadas, **sin sustituir chaos real de staging**.




## [1.13.0] - 2026-11-07 (candidato F4, NO liberado)

- F6.02: detalle de tarifa en Vue reconcilia cada invalidación mediante GET REST, sin asumir que `RevisionNumber` cambia en todas las mutaciones. [CI #42492212712](https://github.com/CustomCodeCR/DholeWeb/actions/runs/42492212712) PASS.
- Seguridad F6: el manager elimina inmediatamente las vistas observadas al recibir `resourceRevoked` del Gateway; ignora mensajes malformados y no vuelve a aplicar eventos sobre el recurso revocado. [CI #42492867135](https://github.com/CustomCodeCR/DholeWeb/actions/runs/42492867135) PASS. Web `1.13.0` continúa versión global candidata sin activar flags.
- Cliente universal Vue `RealtimeManager` con una conexión SignalR por pestaña, tickets opacos, suscripción autorizada por recurso, reconexión inicial/con backoff y jitter, apagado por triple feature flag.
- Recuperación por REST de vistas activas CRM/Pricing, deduplicación, revisión de versiones y protección de formularios sucios: nunca se reemplaza una edición sin guardar, se muestra aviso de conflicto.
- Estado discreto para conectado, reconectando, degradado, offline y sesión no autorizada; escucha solo mientras la sesión está activa, se limpia en logout/cambio de usuario/impersonación.
- Pruebas aisladas para 100 montajes/desmontajes, 30 reconexiones, 30 fallos iniciales y contingencia; **gate F4 no aprobado hasta CI y gates F0–F3**.
- La migración sigue aislada de `develop` y `master`; no se activa realtime, no se publica ni despliega.




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


## [1.12.18] - 2026-11-09

- ALL IN solo cuando la alternativa FCL es marítima/multimodal, su POE está en Panamá y el POD final en Costa Rica; Caldera, Moín y otros destinos mantienen desglose. La decisión se calcula para cada alternativa al crear MultiQUO y se visualiza por subtarifa en pantalla 8.
- Release coordinado DH-20261109-PRICING-FCL-PANAMA-ALLIN-049; DholeWeb 1.12.18 / DholePricingService 1.5.20.
- Pruebas unitarias y de regresión más validación de staging antes de master.



## [1.12.17] - 2026-11-09

- Gestión de tarifas muestra una sola fila por MultiQUO, con número principal, contador de opciones y paginación real desde Pricing; conserva todas las alternativas en el detalle.
- Flete marítimo manual: el POE viene de la ruta activa; comentarios, tarifa manual guardada y huella de idempotencia quedan aislados por POE y naviera, sin repetir valores en otras opciones.
- No elimina datos ni modifica la selección de fletes importados. Release coordinado DH-20261109-PRICING-QUO-PORT-ISOLATION-048 con DholePricingService 1.5.19.
- Compilación, regresiones y staging antes de integrar a master.
