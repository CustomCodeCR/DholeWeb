## [1.132.3] - 2026-11-25

- DH-20261125-FTL-CUSTOMS-SCOPE: separar CUSTOMS_FOREIGN de CUSTOMS_CR en pantalla 7 y guardado; aliases históricos requieren país explícito. Conservar RateDetails FTL negociados en cambios exclusivos de agente elegible, sin tratar la naviera oculta como cambio de contexto. Regresiones incluidas; CI/staging pendientes.

## [1.132.2] - 2026-11-25

- DH-20261125-FTL-PERSISTED-AGENT-P6: recuperar el agente FTL persistido en consulta y edición sin sustituir su ID; respetar el filtro de país en nuevas rutas. Permitir revisar las líneas de pantalla 7 sin bloquear por el catálogo; la verificación final de contexto permanece en guardado. Pruebas de regresión incluidas; CI y staging pendientes.

## [1.130.0] - 2026-11-25

- Promote staged commercial quotation workbook with all or selected statuses, creation dates and search; existing DH button and permissions. No unrelated staging changes.

## [1.127.5] - 2026-11-25

- Fix compact sidebar brand: reuse bundled SVG silhouette, preserve theme color and transition, avoid stale cached public mask, and provide symmetric compact padding. CI and authenticated staging pending.

## [1.127.0] - 2026-11-25

- Add optional Booking Request Shipper document category in Pricing screen 4, reusing the existing Storage upload and document metadata. CI and staging pending.

## [1.124.35] - 2026-11-25

- PATCH DH-20261125-OWN-LCL-DRAWER: backport aislado del editor LCL propio con DhDrawer, DhTabs, escenarios FOB por país, QUOs y pie fijo; misma vista validable que develop, sin otros cambios de staging. CI y staging pendientes.

## [1.124.34] - 2026-11-25

- DH-20261125-OWN-LCL-WIZARD-BUNDLE: use wizard-bundle endpoint for own LCL destination charges and selected IDs; CI/staging pending.

## [1.124.33] - 2026-11-25

- DH-20261125-OWN-LCL-MAERSK-BALBOA: isolated backport of own-LCL draft line API, explicit destination/line errors and protection against stale responses; CI and staging pending.

## [1.124.32] - 2026-11-24

- DH-20261124-PRICING-AIR-QUANTITY-SAVE: conservar precios unitarios negociados al editar agente elegible, peso y cantidades de carga de una cotización aérea existente, incluso combinados; recalcular cantidades mediante el flujo existente, mantener validación de ruta/servicios y respetar eliminaciones explícitas. Regresiones añadidas; CI/staging pendientes.

## [1.124.31] - 2026-11-24

- DH-20261124-PRICING-AIR-AGENT-SAVE: corrección aislada de guardado de cotización aérea existente cuando únicamente cambia a un agente elegible; conservar importes negociados, no recalcular costos y evitar sustitución automática del agente. Validaciones de demás cambios conservadas. CI y staging pendientes.

## [1.124.30] - 2026-11-24

- DH-20261124-PRICING-EDIT-CONTEXT-NORMALIZATION: promoción aislada de la corrección de contexto de edición validada en CI de develop; normaliza referencias equivalentes y excluye fuentes marítimas residuales, mantiene validaciones reales y diagnóstico específico. CI de master y prueba funcional de staging pendientes.

## [1.124.29] - 2026-11-24

- DH-20261124-PRICING-COST-CONTEXT-RELINK: conservar operación al reseleccionar el cliente de la QUO; separar identidad CRM de la consulta física de cargos en edición; reutilizar reconciliación P7 verificada para la misma configuración; esperar actualización de Vue antes de capturar contexto y guardar. Mantener bloqueo para cambios de transporte no verificados. CI y staging pendientes.


## [1.124.28] - 2026-11-24

- DH-20261124-PRICING-DUPLICATE-RELINK: recuperar automáticamente vínculos CRM perdidos por duplicaciones anteriores al guardar una QUO. Exigir coincidencia exacta única, propietario comercial coincidente, consulta completa, verificación por ID y ausencia de cambios concurrentes; persistir el vínculo en el PUT normal. Pruebas de regresión; CI/staging pendientes.


## [1.124.27] - 2026-11-24

- DH-20261124-PRICING-HISTORICAL-EDIT: mostrar el error específico y solicitar el vínculo CRM explícito en duplicados afectados; capturar contexto de todas las modalidades al finalizar hidratación, reintentar una consulta de costos transitoria sin omitir validación de cambios reales. Pruebas de regresión añadidas; CI, manifiesto central y staging pendientes.


## [1.124.26] - 2026-11-24

- DH-20261124-VERSION-CARD-FIX: evitar encabezado duplicado de DhCard, tooltip interno y versión centrada en tarjeta compacta de ancho ajustado. CI/staging pendientes.

## [1.124.25] - 2026-11-24

- DH-20261124-TOPBAR-VERSION-CARD: reutilizar DhCard con padding compacto compatible para mostrar versión entre notificaciones y usuario; canal fuera de producción. Centrar el logo del sidebar en el card completo con espacio simétrico para los controles y conservar su transición. CI/staging pendientes.

## [1.124.24] - 2026-11-24

- DH-20261124-TOPBAR-VERSION: retirar versión del sidebar y mostrarla en la barra superior, entre búsqueda y acciones; en pantallas estrechas consultar detalle en tooltip de configuración. CI/staging pendientes.

## [1.124.23] - 2026-11-24

- DH-20261124-SIDEBAR-VERSION-FOOTER: trasladar versión y canal al pie fijo del sidebar; modo compacto con icono informativo y tooltip de versión/commit. Logo, animación, login y contratos sin cambios. CI/staging pendientes.

## [1.124.22] - 2026-11-24

- DH-20261124-SIDEBAR-BRAND-MOTION: reducir 15% el logotipo del sidebar en ambos estados y animar su transición con el ancho del menú, respetando movimiento reducido. SVG, favicon, login y tooltip sin cambios. CI/staging pendientes.

## [1.124.21] - 2026-11-24

- DH-20261124-EXACT-SVG-LOGO: usar exactamente dhole-erp(1).svg entregado por el usuario; colores dinámicos mediante CSS, favicon transparente con rojo original #A90E19. Descripciones de marca solo en tooltip sobre logo; se conserva versión visible. CI/staging pendientes.

## [1.124.20] - 2026-11-24

- DH-20261124-OFFICIAL-SQUARE-LOGO: geometría rectangular del logo oficial, O cuadrada, logotipo completo en menú expandido e inicio de sesión, símbolo compacto y favicon rojo original transparente. CI/staging pendientes.

## [1.124.19] - 2026-11-24

- DH-20261124-THEME-LOGO: nuevo logotipo SVG sin fondo, color primario y texto del tema, favicon ICO rojo original; regresiones de identidad visual. CI y staging pendientes.

## [1.124.18] - 2026-11-24

- DH-20261124-LCL-DIRECT-STEP6-COST: habilitar el costo de flete coloader LCL en edición de una cotización existente al ingresar directamente a pantalla 6. Conserva restricciones de creación, solo lectura y ventas. Prueba obligatoria en prebuild; CI y staging pendientes.

## [1.124.17] - 2026-11-24

- DH-20261124-LCL-EDIT-COST: promoción aislada de la corrección LCL integrada en develop. Normalizar contexto tras hidratación, compartir reconciliaciones, permitir revisar costos ante falla transitoria y conservar validación antes de guardar. CI de develop superado; staging y CI de master pendientes.

## [1.124.16] - 2026-11-24

- DH-20261124-PERSISTED-DETAIL-IDENTITY: conservar identidad y precios de cargos históricos, reconocer flete terrestre CFZ–GAM sin marcador, separar Inland y validar snapshot de guardado. Promoción aislada del release integrado en develop; CI de master y staging pendientes.

## [1.124.15] - 2026-11-24

- DH-20261124-INLAND-PERSISTED-EDIT: conservar Inland Merchant/Naviera persistido al modificar cotizaciones, incluso Variable sin CostId. Recuperar el detalle original y sus precios sin duplicar el flete terrestre independiente; respetar eliminaciones explícitas. Promoción aislada de la corrección integrada en develop; validación de staging y CI de master pendientes.

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
- DholeWeb/DholeSystem 1.124.5 → 1.124.6; promoción selectiva del mismo código de develop; conserva release concurrente 1.124.5. Sin cambio REST, realtime ni base de datos. CI y staging pendientes.

## [1.124.4] - 2026-11-24 · DH-20261124-OPENINGS-IDTRA-GUARD

## [1.124.5] - 2026-11-24

- DH-20261124-SELLER-EXPIRED-RENEWAL: conectar dashboard móvil/escritorio y detalle de ventas con la autorización existente de jefatura; permitir continuar con actualización sin cambiar carga tras aprobación; refrescar decisiones por notificaciones realtime.
- Candidato pendiente de CI y staging.

- PATCH: distingue la omisión de un correo de Aperturas por IDTRA asignado de una notificación realmente encolada. Reutiliza DhModal, DhSelect, DhButton y el toast existente. Conserva el reenvío comercial. CI y staging pendientes.


- PATCH: distingue la omisión de un correo de Aperturas por IDTRA asignado de una notificación realmente encolada. Reutiliza DhModal, DhSelect, DhButton y el toast existente. Conserva el reenvío comercial. CI y staging pendientes.

## [1.124.3] - 2026-11-24 · DH-20261124-PRICING-SENT-CRM-FIX

- PATCH de sincronización de versión Web/System para el hotfix de transición Sent de Pricing. Sin cambios de interfaz, lógica ni contratos REST/realtime.

## [1.124.2] - 2026-11-24 · DH-20261124-SELLER-ACCEPTANCE-FIX

- PATCH coordinado: sincronización Web/System para la corrección de registro de aceptación de QUO en DholePricingService. Sin cambios visuales, componentes DH ni payload REST. CI y staging pendientes.

## [1.120.11] - 2026-11-23 · DH-20261123-PRICING-LCL-INCH-PERSISTENCE-432

- PATCH: corrige la persistencia de dimensiones LCL/LTL en Pricing. Las líneas conservan su unidad interna durante el guardado aunque POL/catálogos se rehidraten; únicamente una transición explícita de origen transforma la representación interna.
- El payload REST continúa enviando largo/ancho/alto en centímetros y el formulario sigue mostrando la unidad elegida (pulgadas, centímetros, metros o milímetros), preservando peso y reglas de CFT/CBM.
- Regresión automatizada reproduce las cinco tarimas del caso Miami (50 × 44 × 29 in y otras cuatro líneas), con 68.248 CFT antes/después de cambios de contexto; incluida en prebuild.
- Versión global DHOLE/DholeWeb 1.120.10 → 1.120.11; PricingService y demás servicios sin cambios de contrato ni versión. CI de develop aprobado; promoción selectiva solicitada y autorizada expresamente. Validación master y reapertura autenticada en staging pendientes.

## [1.120.10] - 2026-11-23 · DH-20261123-CRM-LEAD-AUDIT-431

- PATCH: Prospectos incorpora Historial de cambios independiente del Historial de rutas, con la misma línea de tiempo de Cuentas, usuario, fecha, cambios antes/después, actualización y paginación DhPagination. Reutiliza los tokens y componentes DH existentes en ambos temas.
- Consume GET /api/crm/leads/{id}/change-history del servicio CRM autorizado; maneja errores y navegación entre prospectos sin mezclar resultados. Versiones coordinadas CRM 1.43.1 y Web/ecosistema 1.120.10; otros componentes sin cambios.
- CI y staging pendientes; promoción a master solo después de validación. Despliegue de producción no autorizado.

## [1.120.9] - 2026-11-23 · DH-20261123-PRICING-MODIFICATION-422

- PATCH: el comparador de solicitudes de cambio de Ventas incluye modalidad y tipo de embarque verificables; la edición de P7 retiene RateDetails/CostIds originales, expone cargos excluidos y alinea los IDs con sus importes.
- Promoción aislada desde la base master 1.120.8, conserva los comportamientos de producción (incluido el desbloqueo temporal de Incoterms) sin integrar el resto de develop.
- DholeWeb/DholeSystem 1.120.8→1.120.9 y otros 15 componentes sin cambio. Pruebas staging antes de producción.

## [1.120.8] - 2026-11-23

- PATCH DH-20261123-PRICING-VAT-RELEASE-430: Se corrige el IVA fiscal por POL y POE para cargos de origen, recolecta, destino y entrega; flete según importación/exportación y alternativas multi-POE.
- Se conserva IVA actualizado en la pantalla 7 y el checkbox refleja la tasa disponible. Incluye pruebas para creación, edición y transformación de Vite.
- Release coordinado DholeSystem/DholeWeb; no se modifican contratos REST, servicios ni componentes DH compartidos.

## [1.120.7] - 2026-11-23 · DH-20261123-PRICING-LTL-EDIT-NAV-422

- PATCH: en edición de QUO LTL terrestre existente, Pantalla 6 permite avanzar a Pantalla 7 sin depender de la validación de tarifa nueva `canNext`. Se usa el snapshot persistido para revisar cargos sin reimportar ni recalcular los fletes al navegar.
- La ruta sigue exigiendo una tarifa persistida hidratada, no habilita la navegación comercial ni las cotizaciones nuevas; conserva las validaciones al guardar y el procesamiento de cambios por Outbox/Inbox existentes.
- Regresión DH-422 ejecuta el manejador `next()` generado con `canNext=false`, comprueba no mutación de detalles y casos negativos; incluida en prebuild y tests Pricing.
- DholeWeb y DholeSystem: 1.120.6 → 1.120.7; otros servicios sin cambios. CI y pruebas de staging pendientes; producción no autorizada para este nuevo release.

## [1.120.6] - 2026-11-23 · DH-20261123-PRICING-EDIT-STEP6-421 (candidato master)

- PATCH: corregir navegación P6→P7 para edición de flete terrestre en cotizaciones guardadas. Evita validar como creación; conserva costos y ventas históricas y valida guardar.
- Candidate selectivo basado en master 1.120.3, sin traer funcionalidad incompleta de develop. Se mantiene versión 1.120.6 coordinada con el release develop; versiones 1.120.4 y 1.120.5 existen en develop y no deben reutilizarse.
- Producción bloqueada hasta validar CI/staging y autorizar expresamente el despliegue automático de master. Otros 15 servicios sin cambios.

## [1.120.3] - 2026-11-23 · DH-20261123-CORS-PREFLIGHT-419

- PATCH: enrutar llamadas API de dominios oficiales production/staging bajo el mismo origen Web usando el proxy nginx existente hacia DholeApiGateway; conserva orígenes personalizados, REST, JWT y rutas SignalR existentes.
- Reutilizar catálogos por sesión e impersonación, con deduplicación de GET simultáneos, TTL de 60 segundos, invalidación por modificaciones locales de catálogos y cambios de sesión.
- Actualizar clientes de JSON, descargas y Storage, manteniendo el tratamiento especializado del endpoint Hacienda y límites de carga controlados.
- DholeWeb/ecosistema 1.120.2 → 1.120.3; DholeApiGateway 1.11.0 → 1.11.1 en release coordinado; demás microservicios sin cambios. Sin nuevas librerías ni componentes DH.
- Validación requerida: nginx -t, type-check, compilación, tests de regresión, CI y pruebas staging; no despliegue de producción sin autorización.

## [1.120.2] - 2026-11-23 · DH-20261123-PRICING-LTL-NUMERIC-418

- PATCH para producción de consolidado propio LTL: corregir TypeError de .trim() con valores numéricos de Vue que impedía enviar POST al crear ruta, y mostrar validación específica en UI.
- Agrega pruebas de regresión runtime para campos number y cargos variables; se mantiene el endpoint REST existente y no hay cambio de base de datos.
- Release aislado para master: incorpora exclusivamente fixes LTL 417 y 418, no incluye funcionalidades incompletas de Aperturas 416 presentes en develop.
- DholeWeb y DholeSystem en master 1.119.1 → 1.120.2 (semver monotónico). PricingService y otros servicios permanecen en sus versiones de producción.
- Debe validarse CI y staging antes de ejecutar merge a master, que despliega producción automáticamente.

## [1.120.1] - 2026-11-23 · DH-20261123-PRICING-LTL-ROUTES-417

- PATCH: crear nuevas rutas LTL independientes por ciudad, como San José → Tegucigalpa, sin sustituir la tarifa de San José → San Pedro Sula.
- Añade acción «Crear otra ruta con estos valores», preserva cargos y permite distinguir ciudades; evita duplicados de la misma combinación origen/destino/perfil.
- Usa DhButton existente; REST, SignalR y Redis no cambian. Prueba de regresión añadida.

## [1.119.1] - 2026-11-23 · DH-20261123-PRICING-RETURN-MODAL-415

- PATCH: mostrar «Ver devolución» y su historial en el DhModal compartido sin expandir las filas del Dashboard comercial; incluir cliente, ruta, motivo, usuario, fecha e historial.
- Promoción selectiva desde develop: preservar código de master, contratos REST/realtime y acciones «Corregir y reenviar» y «Duplicar».
- DholeWeb/DholeSystem 1.119.0 → 1.119.1, otros 15 componentes sin cambio; CI y staging obligatorios antes del merge a master.

## [1.119.0] - 2026-11-22 · DH-20261122-OPS-CASE-OVERVIEW-414

- MINOR: listado de Trámites muestra nombre CRM con resolución por cuenta, equipo, operativo y estado específico departamental, sin exponer UUID ni destacar DRAFT como estado operativo.
- Cliente por lote desde CRM 1.43.0 bajo permisos de cuenta, sin N+1 en ruta principal.
- Drawer de resumen con componentes DH, dos validadores de Aperturas, ejecutivo comercial real de CRM, ruta, mercancía, equipos, servicios, pendientes, historial y responsable.
- Expediente completo reorganizado por identificación, ruta, carga, servicios, estados de etapa y responsables; superusuario puede consultar todos los tabs según permisos calculados por backend.
- Pruebas de regresión agregadas al gate de build; mantiene realtime, contratos REST existentes y sin duplicar componentes visuales.


## [1.117.1] - 2026-11-22 · DH-20261122-DHOLE-ERP-411 (DHOLE ERP pronunciation choice)

- PATCH: se retiran todas las indicaciones de pronunciación de DHOLE ERP. La marca conserva su nombre y significado oficial sin imponer una lectura concreta.
- Prueba de branding compatible con construcción Docker que excluye .env; CI/staging y versionamiento 1.117.1 coordinados con DholeSystem.

## [1.117.0] - 2026-11-22 · DH-20261122-DHOLE-ERP-410 (integrated branding)

- MINOR: marca corporativa DHOLE ERP (Sistema de Gestión Interna) en login, menú, título de navegador, icono, traducciones, emails de sesión y compilación. Digital Hub for Operations, Logistics & Ecosystem; sin cambios de integraciones.
- Se reservan DHOLE CLOUD, DHOLE X4 y GIO para releases futuros. DholeWeb y DholeSystem 1.116.1 → 1.117.0.

## [1.116.1] - 2026-11-22 · DH-20261122-PRICING-RETURN-EMAIL-409 (master selective candidate)

- PATCH selectivo: retirar UUID de la ventana de devolución; conservar identificación comercial por cliente y ruta, con UUID solo en metadatos y URLs.
- PricingService envía email HTML legible y con CTA sin UUID visible, configurado para cada entorno. Release global 1.116.1 (Web/System 1.116.0 → 1.116.1, PricingService 1.26.25 → 1.26.26).
- Sin cambios de REST, SignalR ni reenvío existente. CI, staging y permiso de producción requeridos.

## [1.116.0] - 2026-11-22 · DH-20261122-OPERATIONS-ASSIGNMENT-SUMMARY-408

- MINOR: permite escoger equipo de Aperturas con mínimo dos validadores disponibles antes de crear un IDTRA; mantiene autoguardado y recuperación del equipo elegido, con reintentos sin duplicados.
- Estibable aplica únicamente LCL/LTL; el peso de carga y equipos ya no se ingresa desde Aperturas (Coordinación Origen).
- Nuevo resumen de la apertura en secciones y drawer de expediente con cliente, ejecutivo, ruta, mercancía, equipos, documentos y validación.
- Reutiliza los contratos de Operations, catálogos Pricing, CRM, Storage, Outbox/Inbox y SignalR; API Gateway sin cambios.
- DholeWeb/DholeSystem 1.115.1 → 1.116.0; Operations 0.15.1 → 0.16.0; 14 componentes sin cambios. Candidato de master sujeto a aprobación de producción.

## [1.115.1] - 2026-11-22 · DH-20261122-PRICING-RETURN-407

- PATCH: denominar «Devolver tarifa» la acción de Pricing; mostrar «Devuelta por Pricing» a Ventas, identificador visible y motivo obligatorio; diálogo opaco y accesible en modo oscuro.
- Ventas puede consultar el historial íntegro de devoluciones con operador, fecha/hora y motivo y corregir y reenviar la misma solicitud (sin otra QUO ni ID). El backend conserva estados Returned/Open y el outbox SignalR/Email existente.
- Release coordinado: DholeWeb/DholeSystem 1.115.0 → 1.115.1, DholePricingService 1.26.24 → 1.26.25; no se altera el contrato REST. CI + staging requeridos antes de promover master.

## [1.115.0] - 2026-11-22 · DH-20261122-OPERATIONS-OPENING-POLISH-406 (selective master candidate)

- MINOR: apertura manual autoguarda localmente por usuario/empresa y recupera el borrador; el IDTRA solo se crea al confirmar.
- Botón «Crear y asignar a equipo» asigna los validadores mediante endpoint Operations; reintentos conservan el IDTRA sin duplicarlo.
- Tarjetas de equipos FCL/FTL con selector de tamaño/tipo de Pricing y exclusión de duplicados, cantidad y peso por equipo; selectores de naturaleza de la carga y bultos e iconos por tipo de embarque.
- Contactos operativos activos de CRM preseleccionados y desmarcables; espaciado Incoterm corregido, revisión compacta sin leyenda de Coordinación Origen.
- Compatibilidad con borradores y expedientes históricos, CABYS, Storage, REST y realtime; Web/System 1.114.0 → 1.115.0 y otros 15 componentes sin cambios.

## [1.114.0] - 2026-11-22 · DH-20261122-OPERATIONS-OPENING-UX-405 (candidate master)

- MINOR: rediseño responsive de la apertura manual, selector de transporte con solo Marítimo, Aéreo y Terrestre, botones IMO/Estibable/Sobrepeso/Redestino/Anticipado con estados accesibles. Multimodal histórico se conserva sin permitir nuevas aperturas de esa modalidad.
- Ejecutivo real desde CRM/account y etiquetas CRM; pendiente bloqueante cuando no existe asignación. Contactos operativos reales activos seleccionados por ID desde CRM, sin enviar notificaciones automáticamente.
- Borradores y campos históricos preservados; división CRM read-only hasta catálogo real; auditoría de campos adicionales según especificación v1.2. CABYS, documentos Storage, rutas y pantallas de Pricing sin modificación.
- DholeWeb / DholeSystem 1.113.1 → 1.114.0; otros 15 componentes sin incremento. CI/staging obligatorios, promoción a master sin autorización de producción en este pedido.

## [1.113.1] - 2026-11-22 · DH-20261122-OPERATIONS-NO-SERVICES-404 (master selective promotion)

- PATCH sobre 1.113.0: eliminar la antigua pantalla de Servicios de la apertura manual, incluidos selector de servicios, recolecta, entrega, agente, naviera, merchant y campos administrativos o instrucciones de esa etapa.
- Conservar los tres pasos Cliente y ruta, Carga y documentos, Revisión. Mover el WHS obligatorio para FCA LCL/LTL al paso de ruta sin alterar validación.
- Conservar borradores, autogeneración de IDTRA desde Operations, CRM de Pricing, CABYS, Storage, REST y realtime existentes; compatibilidad de expedientes históricos.
- Promoción selectiva: no fusionar la historia divergente de develop ni componentes adicionales. DholeWeb y DholeSystem: 1.112.1 → 1.113.0 → 1.113.1; el resto de componentes conserva su versión.

## [1.113.0] - 2026-11-22 · DH-20261122-OPERATIONS-UX-403 (base incorporada con DH-404)

- MINOR: unificar la apertura manual con componentes de Pricing. Sustituir wizard de seis etapas por tres, recuperar cliente de CRM con PricingCrmClientSelect, buscar CABYS y permitir documentos de respaldo en Storage.
- Los países se derivan de la ruta, se oculta la leyenda técnica del identificador IDTRA, se mantienen contratos REST, permisos, borradores y SignalR.

## [1.112.1] - 2026-11-22 · DH-20261122-PRICING-OPERATIONS-STEPPER-402 (Pricing · UI de creación con componente de Operations)

- PATCH: Crear/editar tarifa usa el encabezado operativo con icono, estado y avance, y reutiliza PricingWizardStepper con las 8 etapas existentes (9 en solo lectura), sin modificar el flujo de costos, servicios ni QUO.
- Conserva los borradores múltiples, autoguardado, recuperación y descarte de la cotización activa; mantiene el bloqueo de navegación hasta registrar el motivo al editar y el diseño responsive.
- Versionado global DholeWeb 1.112.0 → 1.112.1. APIs REST/SignalR, DholeOperationsService 0.15.1 y demás microservicios no cambian. CI y staging obligatorios antes de promover a master. No autoriza despliegue a producción.

## [1.112.0] - 2026-11-22 · DH-20261122-OPERATIONS-PARITY-401 (Operations / Pricing: apertura manual)

- MINOR: wizard operativo en 6 etapas congruente con Pricing, con modalidad y embarque seleccionados en tarjetas visuales; integra los selectores compartidos de rutas, equipos y servicios.
- Conserva expediente y QUO independientes, condiciones por modalidad, Incoterms permitidos y equipos múltiples; cambios backend Ops 0.15.1 para FTL/multimodal.
- DholeWeb/DholeSystem 1.111.1 → 1.112.0. Release dirigido a master solo tras staging y CI; sin autorización de despliegue de producción.

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

## [1.110.6] - 2026-11-21 · DH-20261121-PRICING-TERRESTRIAL-FREIGHT-398 (candidate master)

- PATCH: FCL multimodal Pantalla 7 conserva el flete marítimo por contenedor y agrega el maestro Flete Internacional Terrestre marcado en data.applicable por Pricing sin confundirlo con Bunker.
- Corrige la reconciliación posterior a la carga asíncrona del catálogo y conserva CostId, valores, relaciones POE/POD y el snapshot persistido sin duplicar líneas.
- Misma corrección DH-398 integrada en develop, promovida con pruebas de regresión a master mediante rama intermedia.
- DholeWeb/DholeSystem 1.110.5 → 1.110.6; PricingService conserva 1.26.24. Despliegue de producción pendiente de autorización expresa.

## [1.110.5] - 2026-11-21 · DH-20261121-PRICING-VGM-FCL-FINAL-397 (candidate master)

- PATCH: La validación de Incoterm ya no desmarca el VGM del consolidado propio Miami elegido comercialmente ni el flete internacional terrestre de un FCL multimodal con transporte contratado.
- Se realiza la reconciliación definitiva después de la validación de Incoterm y antes de serializar los detalles; evita omitir VGM y flete terrestre incluso después de reconstrucciones.
- Continuación de DH-396 ya integrado en develop: helper idempotente, precios VGM por plan Miami y Freight terrestre independiente del marítimo/Bunker. Pruebas del build transformado actualizadas.
- Global System/Web 1.110.5, Pricing 1.26.24; no repricing de detalles persistidos ni cambios de contrato REST.


## [1.110.4] - 2026-11-21 · DH-20261121-PRICING-MISSING-LINES-396 (candidate master)

- PATCH: LCL propio Miami recupera el VGM desde el plan comercial A/B/C/D/NVOCC/LITTLE en la reconstrucción de pantalla 7 y en pre-guardado. Un VGM 0/excluido del consolidado no oculta la venta comercial; se respetan valores positivos, manuales y RateDetails persistidos.
- PATCH: FCL multimodal Panamá → GAM mantiene el flete internacional terrestre independiente del marítimo y del Bunker, incluso si la reconstrucción de pantalla 7 sustituye la lista o existe un cargo terrestre automático en cero. Se recupera antes de serializar detalles.
- Se conserva la regla interna USD 2.140/cont. cuando no existe maestro aplicable, sin inventar CostId; importes negociados y datos históricos permanecen intactos.
- Regresiones dinámicas de los planes Miami, conservación de importes y coexistencia de fletes. Release coordinado System/Web 1.110.4, Pricing 1.26.23; CI y staging antes de master.

\n## [1.110.3] - 2026-11-21 · DH-20261121-PRICING-FINAL-POLISH-395 (candidate master)

- PATCH LCL Miami: conserva VGM del plan propio cuando se restauran líneas del consolidado, sin duplicados ni modificación de revisiones.
- PATCH FCL Panamá multimodal: la tarifa terrestre USD 2.140 por contenedor se presenta independientemente del marítimo y Bunker no se confunde con Freight; CostId real solo cuando Pricing devuelve costo aplicable.
- PATCH LTL: días de tránsito editables en pantallas 4 y 7 y persistidos en la cotización.
- Backport selectivo de DH-395, sin reemplazar el wizard de master con la rama develop. Pricing 1.26.22, DholeSystem 1.110.3; validar CI y staging antes de producción.

## [1.110.2] - 2026-11-21 · DH-20261121-PRICING-LAST-THREE-FIXES-394 (candidate master)

- PATCH: LTL Panamá → Costa Rica muestra Flete, Bunker, Gastos y Custodia + Marchamo con cruces entre POL comercial y POE físico.
- PATCH: FCL multimodal conserva el flete internacional terrestre independiente del marítimo y prioriza el CostId devuelto por Pricing para la ruta activa.
- PATCH: LCL Miami recupera líneas SED/Manejos/VGM/TICA/Marchamo/Documentación/Forwarding y seguro cuando aplican, sin duplicar datos del consolidado ni modificar tarifas históricas.
- Backport selectivo sobre master; System 1.110.2, Pricing 1.26.21; pruebas, CI y staging pendientes.

## [1.110.1] - 2026-11-21 · DH-20261121-PRICING-TRANCHE-MIAMI-PANAMA-393 (candidato master)

- PATCH: Pantalla 7 FCL Multimodal conserva el tramo marítimo y aplica el flete internacional terrestre Panamá → GAM desde catálogo InlandTransport/FTL o la regla USD 2140 cuando no existe maestro aplicable.
- PATCH: LTL Panamá → Costa Rica concilia por separado Flete terrestre, Bunker, Gastos y Custodia + Marchamo desde tramos de peso. No repricia ni elimina snapshots existentes sin cambios explícitos.
- PATCH: LCL Miami alinea plan D con cotizador_miami.html, preservando desglose CFT y mínimos comerciales. Backend DholePricingService 1.26.20.
- Promoción selectiva desde release DH-393 sobre master divergente, sin importar operaciones DH-392 ni otros cambios no relacionados. Global Web/System 1.110.1. CI y staging por validar.

## [1.109.3] - 2026-11-21 · DH-20261121-P7-COSTS-391 (candidato master)

- PATCH: en LTL Panamá → Costa Rica, muestra las cuatro líneas del catálogo por POE/POD múltiples y tramos reales WeightKg, incluida Gastos 0/0 cuando el tramo lo determina; respeta FCA y los CostIds.
- PATCH: LCL propio consulta independientemente el servicio de agencia de aduanas CRC seleccionado y calcula por tramo sin eliminar la matriz ni costos/ventas negociados.
- PATCH: multimodal FCL mantiene dos fletes separados (marítimo + terrestre) y nombra el flete según modalidad, también en guardado.
- PATCH: modificación de cotizaciones considera Sobrepeso y peso de la carga como deltas explícitos; conserva identidades de RateDetails y evita recotizar sin autorización.
- Añade pruebas de regresión DH-391 y validación de compilación. Backend PricingService sigue en 1.26.19; REST/SignalR compatibles.
- CI de develop aprobado y staging automatizado desplegado. QA autenticada pendiente; master/prod requieren autorización.

## [1.109.2] - 2026-11-21 · DH-20261121-WIZARD-COSTS-390 (candidato master)

- PATCH: el excedente de FCL multimodal Panamá → Costa Rica sobre 19.000 kg por contenedor se calcula con los cuatro costos LTL maestros presentes en data.catalog del mismo wizard-bundle, no con data.applicable filtrado a FCL.
- PATCH: la edición de muellaje registra Anticipado/Redestino como delta explícito; elimina únicamente el detalle persistido de la alternativa reemplazada y permite restaurarlo al revertir, conservando flete, costo, venta e identidad de los demás RateDetails.
- Integración con PricingService 1.26.19 para exponer Recolecta/Entrega editables y gastos Panamá con tramos cero correctamente evaluados. No se importan rubros ajenos del catálogo ni se recrean cotizaciones.
- Pruebas de regresión agregadas. Release de master pendiente de CI, validación funcional en staging y autorización de producción; no efectuar merge hasta superar las validaciones.

## [1.109.1] - 2026-11-21 · DH-20261121-PRICING-EDIT-BUNDLE-389

- PATCH: al modificar una QUO, Pantalla 6 y Pantalla 7 consultan GET /api/pricing/costs/wizard-bundle para el contexto vigente; no aceptan una respuesta vacía por la existencia de RateId.
- PATCH: recupera las alternativas Inland Merchant/Carrier y agrega únicamente cargos nuevos solicitados y aplicables; Flete Internacional Terrestre mantiene su CostId independiente del marítimo FCL.
- PATCH: preserva RateDetails originales (DetailId, CostId, costo, venta, moneda) y la selección Inland; no reintroduce opcionales no seleccionados ni duplica líneas por navegación.
- Tests DH-389 de carga read-only, validación de contexto y compatibilidad con release 1.109.0 Blobatar. CI y staging obligatorios antes de promoción.
- DholeSystem 1.109.1; PricingService permanece en 1.26.18 con wizard-bundle compatible; REST y SignalR sin cambios.

## [1.109.0] - 2026-11-21 · DH-20261121-BLOBATAR-ACCESSORIES-388

- MINOR: personalización avanzada de Blobatar: selector visual por categorías, tarjetas de accesorios, vista previa ampliada, etiquetas activas y selección múltiple accesible en Apariencia.
- MINOR: nuevos accesorios SVG (gorrito de bufón, accesorios navideños, Halloween, símbolos del mes patrio de Costa Rica y divertidos), renderizados también en la mascota flotante. Se combinan por ranuras; un accesorio en el mismo lugar reemplaza al anterior sin afectar los demás.
- Compatibilidad: la configuración de accesorio única existente se migra automáticamente al formato múltiple; persistencia local por usuario, foto opcional, expresiones y preferencias de movimiento conservadas. Traducciones ES/EN y pruebas de regresión actualizadas.
- Release global DholeSystem 1.109.0; otros componentes mantienen sus versiones registradas. Requiere CI, pruebas en staging y autorización de producción antes del despliegue.

## [1.108.20] - 2026-11-21 · DH-20261121-QUO-EDIT-DELTA-387

- PATCH: modificación de QUO por delta comparado con snapshot original; servicios adicionales crean solo líneas solicitadas (Servicio de Aduanas, Seguro de Carga) sin alterar costo/venta, CostId, DetailId o moneda de líneas retenidas.
- PATCH: cambios explícitos de ruta/naviera/agente/Incoterm/inland/condiciones habilitan solo rubros aplicables; deshacer selección revierte exclusivamente el delta. Sin consultas legacy de catálogo de costos.
- Incluye en este candidato master el release anterior 1.108.19 DH-386 (wizard-bundle único y flete internacional terrestre independiente), con historial preservado. DholeSystem 1.108.20, DholePricingService 1.26.18.
- CI, validación de staging y control de versionamiento obligatorios antes de promoción.

## [1.108.19] - 2026-11-21 · DH-20261121-WIZARD-BUNDLE-ONLY-386

- PATCH: costos del asistente de creación/modificación exclusivamente desde GET /api/pricing/costs/wizard-bundle; solo data.applicable crea líneas y data.catalog es referencia histórica por CostId.
- PATCH: mantiene Flete Internacional Terrestre como CostId independiente del flete marítimo por equipo FCL y muestra ambos en Flete Internacional.
- PATCH: edición conserva RateDetails originales y evita cargos globales no solicitados; pruebas DH-386, compilación y staging en develop aprobadas; release master aislado sujeto a CI y verificación.
- DholeSystem 1.108.19 y DholePricingService 1.26.18 coordinados.

## [1.108.18] - 2026-11-21 · DH-20261121-PRICING-EDIT-TIERS-LAND-385

- PATCH: el cost loader final de Vite envía contenedor, kg, bultos y días a Pricing; mantiene la clave de contexto alineada para evitar precios obsoletos.
- PATCH: modificar una QUO no regenera cargos del maestro; refresco explícito solo actualiza CostId previamente contratado, conservando exclusiones, IDs y precios históricos.
- PATCH: reconoce flete internacional terrestre distinto del marítimo en multimodal y descarta solamente el flete genérico en cero.
- Pruebas de regresión de 40HC, 28000 kg, paquetes/días y líneas eliminadas; CI y staging pendientes. Release coordinado DholeSystem 1.108.18 y PricingService 1.26.17.

## [1.108.17] - 2026-11-21 · DH-20261121-PRICING-P7-RESTORE-384

- PATCH: Pantalla 7 envía la eliminación de líneas persistidas por RateDetailId; evita que reaparezcan.
- PATCH: recupera los detalles de la primera revisión compatible sin modificar automáticamente la base; guarda nueva revisión solo al confirmar.
- PATCH: habilita refresh explícito sin incluir opcionales de catálogos ajenos ni seguro automático.

## [1.108.16] - 2026-11-21 · DH-20261121-PRICING-P7-EDIT-SAFETY-383

- PATCH: Edición de cotizaciones conserva las RateDetails originales sin regeneración de cargos 0/0, deduplicación ni inserción silenciosa de servicios aduanales.
- PATCH: aplicable contextual de Pricing es la única fuente de cargos nuevos; el maestro global no incorpora líneas automáticamente.
- QUO-00000-000744: verificar 6 cargos y sus costos/ventas; no modifica DB ni revisiones retroactivamente.

## [1.108.15] - 2026-11-21 · DH-20261121-PRICING-P7-SNAPSHOT-TIERS-382

- PATCH: los costos aplicables se obtienen del conjunto contextual de Pricing sin mezclar los 274 rubros del maestro, evitando resucitar cargos opcionales no seleccionados.
- PATCH: al editar se consultan costos después de recuperar peso, bultos, contenedor y días guardados; el backend devuelve importes efectivos por tramo, no 0 en la cabecera.
- PATCH: selección de equipo prioriza el ID FCL persistido, incluso durante la hidratación del catálogo.
- PATCH: las cotizaciones guardadas no se repreciarán automáticamente según cambios del maestro; RateDetail, costo, venta e identificadores de revisión permanecen autoritativos.
- Pruebas sobre aislamiento de opcionales, snapshots y consulta de contexto completo.
- Coordinación semver DholeWeb/DholeSystem 1.108.14→1.108.15 y PricingService 1.26.13→1.26.14.

## [1.108.14] - 2026-11-21 (DH-20261121-PRICING-TIERS-381 · costos condicionados por contenedor, bultos, peso y días extra)

- PATCH: resuelve en P6 los importes de costos de agente desde pricingRulesJson y no desde el 0 de cabecera.
- PATCH: para tarifas de peso, paquetes o contenedor se aplica la banda real; por kg se multiplica la regla por kg y por días extra solo los días que superan los incluidos. Si no coincide una regla, no se inventa precio cero.
- PATCH: P7 invalida los cargos automáticos de tramos tras cambiar equipo, cantidad, kg, bultos, pallets o días, preservando los cargos manuales y las demás líneas previamente editadas.
- PATCH: en el refresco explícito de tarifas existentes compara y usa el monto resuelto, nunca el 0 de la cabecera; no se modifica automáticamente el snapshot guardado.
- Regresión automatizada: 20DV 670/705, 40HC 740/780, bultos 1–3 y 4–12, 20 y 40 kg por kg, 3 días incluidos y 4/7 días reales.
- Backport selectivo a master desde develop, sin copiar los demás cambios divergentes. Coordina DholeSystem/DholeWeb 1.108.14; PricingService conserva 1.26.13. No hay cambios REST, base de datos ni SignalR.

## [1.108.13] - 2026-11-21 (DH-20261121-PRICING-P7-EDIT-380 · costos unificados y edición segura)

- PATCH: Seguro de carga explícitamente solicitado aparece desde la creación; no se oculta según responsabilidad Incoterm.
- PATCH: elimina cargos variables origen/recolecta monetarios de cero no seleccionados; al fallar GET de catálogo no crea líneas ficticias.
- PATCH: líneas guardadas conservan los importes del snapshot durante abrir/guardar edición.
- PATCH: el resumen y la persistencia mantienen el orden de bloques de Pantalla 7.
- PATCH: port selectivo del wizard-bundle de develop a master, incluidos transforms FCL/LTL/LCL, sin retirar API REST anterior; requiere PricingService 1.26.13.
- Compilación, regresiones y staging pendientes; NO autorizado despliegue de producción.

## [1.108.12] - 2026-11-21 (DH-20261121-FOB-FCL-MASTER-379 · promoción selectiva de develop)

- PATCH coordinado DholeWeb/DholeSystem 1.108.10 → 1.108.12 en master; versión idéntica a develop. DholePricingService continúa 1.26.12. Mantiene los cambios exclusivos de master sin incorporar toda la divergencia de develop.
- FOB + Exportación: flete FCL por contenedor generado desde naviera se conserva como costo de proveedor, no se incluye automáticamente en líneas, totales ni POST. Incorporación fuera de responsabilidad requiere «Agregar servicio fuera del Incoterm» y «Cotizar por acuerdo» para el contexto actual.
- Corrección de Vite que eliminaba helpers del wizard: scoped optional-cost replacement y verificación de los símbolos en código final; soporte de pruebas nativas Node 24 con imports .ts. Mantiene cambios históricos de cotizaciones, Price/CostId y Realtime existentes.
- Incluye regresiones 377/378/379, diagnósticos del bundle, version.json/lock/CHANGELOG. CI, build y verificación de producción obligatorios. Sin migración de BD, cambios backend ni despliegue de infraestructura.

## [1.108.11] - 2026-11-21 (DH-20261121-INCOTERM-RUNTIME-SCOPE-378 · incluido en la promoción a master)

- Corrige los dos transformadores Vite que reemplazaban shouldIncludeOptionalCost con un patrón demasiado amplio y eliminaban applyIncotermAutomaticChargeGuard. Aserciones de bindings Incoterm en la fuente compilada y test regresivo.

## [1.108.10] - 2026-11-21 (DH-20261121-INCOTERMS-MODIFICATIONS-MASTER-378 · backport selectivo de correcciones Incoterms y modificación de cotizaciones)

- Solo los cambios solicitados ya integrados en develop, sin integrar miles de commits ajenos: en Marítimo/Multimodal se admiten 11 Incoterms y en Aéreo/Terrestre 7. Operación comercial ahora se muestra compacta con override manual y notas de requisitos de EXW/FCA/CIF/CIP.
- Pantalla 7 muestra en rojo los bloques que corresponden a la contraparte, sin auto-incluir los cargos nuevos en totales ni POST; permite cotizarlos por acuerdo, conservando los CostId y precios de la ruta y sin borrar líneas persistidas.
- Edición de cotizaciones: ambos formularios rechazan snapshots incompletos, no infieren borrados de RateDetails por faltar una fila; Vite transform preserva líneas LCL/FCL históricas. El backend asociado solo agrega flete importado cuando el cliente lo seleccionó.
- Runtime: se usa una función pura compartida para los Incoterms marítimos sin ReferenceError, y diagnóstico del bundle generado.
- Backport master DholeWeb/DholeSystem 1.107.5 → 1.108.10; PricingService 1.26.9 → 1.26.12. Sin merge masivo de develop. CI y validación autenticada de staging obligatorios antes de considerarlo producción lista.

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
- Promoción a master autorizada expresamente el 20 de noviembre de 2026; CI completo aprobado en develop. La verificación autenticada en staging no está confirmada y se mantiene como validación pendiente.

## [1.107.3] - 2026-11-20 (DH-20261120-PRICING-PERSPECTIVE-364 · corregir perspectiva comercial de Pricing)

- PATCH: resuelve SV desde etiquetas explícitas «El Salvador» en POL/POE/POD aunque Config no incluya ISO, y lee metadatos ISO-2 alternativos para clientes CRM.
- Permite seleccionar manualmente Importación, Exportación o Tránsito sin bloquear una cotización por datos de países incompletos; conserva la elección en borradores y cotizaciones existentes.
- Elimina la advertencia genérica de perspectiva no determinada y utiliza una instrucción accionable. Se mantiene el cálculo de IVA por POD y la responsabilidad Incoterm según la operación seleccionada.
- DholeWeb/DholeSystem 1.107.2 → 1.107.3; DholePricingService 1.26.9 sin cambios. Sin migraciones, nuevos endpoints ni cambios en SignalR. Validación CI/staging requerida antes de master.

## [1.107.2] - 2026-11-20 (DH-20261120-PRICING-INLAND-RESTORE-363 · restaurar carga de cargos en producción)

- PATCH urgente sobre 1.107.1: revierte solamente la mutación sincronizada y el guardado prematuro de CostId/inland de pantallas 6 a 7 que provocó una regresión en producción.
- Reutiliza el comportamiento de contención previamente desplegado en staging (DholeWeb 1.106.17), sin mezclar develop completo. Se preservan todos los cambios posteriores de master, incluida la configuración de avisos de versión, la autorización de vencidas y el desbloqueo temporal de Incoterms.
- DholeWeb y DholeSystem 1.107.1 → 1.107.2; DholePricingService se mantiene 1.26.9. REST, SignalR, esquema de base de datos e infraestructura sin modificaciones. Pruebas CI y verificación funcional posterior al despliegue obligatorias; el problema original de selección automática todavía requiere prueba autenticada.

## [1.107.1] - 2026-11-20 (DH-20261120-VERSION-NOTICE-500-362 · hotfix 500 de avisos de actualización)

- PATCH metadatos coordinados para corrección de backend Auth 1.17.1, transacción y outbox con estrategia de reintentos.
- Interfaz y permisos sin cambios funcionales. Sistema y Web sincronizados 1.107.1.

## [1.107.0] - 2026-11-20 (DH-20261120-VERSION-NOTICES-361 · notificaciones de versiones por usuario)

- MINOR: Ajustes permite desactivar el aviso de actualización globalmente o para usuarios específicos. Las preferencias personales se conservan en Auth; SuperUsuario administra todas las cuentas. Global=false prevalece.
- DholeWeb recibe invalidación por SignalR sin generar notificaciones y reconcilia preferencias por REST cada 60 segundos.
- Backport aislado sobre master 1.106.18; DholeWeb/DholeSystem → 1.107.0. CI, staging y pruebas multiusuario pendientes; producción autorizada para promoción solo cuando se cumplan las validaciones.

## [1.106.18] - 2026-11-20 (DH-20261120-PRICING-EXPIRED-MASTER-361 · tarifas vencidas solo requieren aprobación para Ventas)

- PATCH: hotfix selectivo de política ya integrada en develop/staging como 354. Oculta “Solicitar autorización” a Pricing y Superadmin y permite abrir editor directo; vendedores siguen solicitud y flujo de jefatura.
- Mantiene el resto de master incluido desbloqueo temporal de Incoterms e inland reciente. Web/System 1.106.16 → 1.106.18, Pricing 1.26.8 → 1.26.9, para no disminuir versión respecto de develop 1.106.17.
- Backend validará permisos con alcance de JWT y rol, tests de regresión y CI antes de producción. REST/SignalR, notificaciones y auditoría sin cambios de contrato.

## [1.106.16] - 2026-11-20 (DH-20261120-PRICING-INLAND-QA-358 · pruebas del inland 6→7)

- PATCH: ajusta la prueba automatizada de paridad Merchant/Carrier para que simule el guardado del borrador ahora obligatorio al elegir inland en Pantalla 6. Sin cambio adicional al contrato REST/SignalR ni a los precios aplicados.
- Release de control de calidad posterior a DholeWeb 1.106.15; DholeSystem 1.106.16, DholePricingService permanece en 1.26.8.
- Se exige CI verde y prueba de navegación en staging antes de cualquier promoción a master. Producción no autorizada.

## [1.106.15] - 2026-11-20 (DH-20261120-PRICING-INLAND-STEP67-357 · cargos e inland pantallas 6 → 7)

- PATCH: los cargos Optional verificados en Pantalla 6 se trasladan por CostId al catálogo de Pantalla 7 antes de reconstruir RateLines, sin recargar el navegador ni traer los de otra POE/naviera.
- El inland Merchant/Carrier seleccionado manualmente o automáticamente se conserva en el borrador por alternativa y al volver a la pantalla; un cargo InlandTransport configurado como Fixed/Variable también puede incorporarse si corresponde.
- Las respuestas Optional retrasadas se descartan si cambia la ruta, agente o naviera; se conserva el contexto de costos vigente y los importes editados.
- Pruebas de regresión de navegación 6→7, selección, restauración del catálogo y solicitudes asíncronas; CI/staging pendientes, sin despliegue a producción.

## [1.106.14] - 2026-11-20 (DH-20261120-PRICING-COSTS-BUILD-356 · reparar build de cargos LTL)

- PATCH urgente: pricingOwnLtlPanamaCosts admite el nuevo loader de catálogo completo sin exigir un bloque Vite que ya no existe; se corrige el fallo de compilación que impidió construir el release anterior de recuperación de cargos.
- Para LTL propio CFZ → San José, preserva la selección de las cuatro partidas reales de Costos y recargos, conserva su CostId y respeta ruta, proveedor, servicios y tramos de precio. El Incoterm no bloquea cargos contratados.
- Web 1.106.13 → 1.106.14; System se sincroniza a 1.106.14. Sin cambios REST, SignalR ni migraciones. Compilación, CI y pruebas de staging obligatorias antes de considerar completo el release.

## [1.106.13] - 2026-11-20 (DH-20261120-PRICING-COSTS-355 · recuperación de cargos y recargos en Pricing)

- PATCH: Pantalla 7 reconstruye cargos y recargos con respaldo del catálogo activo para FCL, LCL, LTL, FTL y aéreo cuando /costs/select contextual omite costos; coteja multi-POL/POE/POD, agente, naviera, modalidad y servicios sin bloquear por el Incoterm.
- Recupera recargos Optional y cargos EXW/FCA, preserva CostIds distintos y detalles existentes al cambiar Incoterm. No rellena precios por tramos inexistentes ni filtra proveedores ajenos.
- La indisponibilidad temporal de beneficios CRM no deja la pantalla 7 vacía: muestra costos del catálogo, informa la incidencia y mantiene el bloqueo existente para guardar tarifas comerciales no verificadas.
- Web 1.106.12 → 1.106.13; System 1.106.10 → 1.106.13 (manifiesto global); Pricing 1.26.7 sin modificación. REST, SignalR, permisos y esquema sin cambios. CI, staging y validación autenticada pendientes.

## [1.106.12] - 2026-11-20 (DH-20261120-INCOTERM-TEMP-UNBLOCK-353 · desbloqueo temporal de Incoterms)

- PATCH temporal: habilita todas las secciones de cotización y evita los bloqueos de navegación EXW/FCA por ubicación, WHS y clasificación especial de carga en Pricing Web.
- Sin cambios en validación de servicio seleccionado, costos asociados por catálogo, rutas, IVA, permisos ni contratos REST/SignalR. Transforms de Vite alineados para impedir que reaparezcan restricciones en producción.
- DholeWeb 1.106.11 (develop) / 1.106.9 (master) → 1.106.12 y DholePricingService 1.26.6 (develop) / 1.26.4 (master) → 1.26.7; versión global 1.106.12. Requiere posterior solución definitiva del modelo de responsabilidades.

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

## [1.106.4] - 2026-11-20 (DH-20261120-PRICING-MERCHANT-HAULAGE-346 · Merchant Haulage FCL por Balboa y destinos seleccionados)

- PATCH: Pantalla 6 identifica como transporte Merchant/Naviera costos Inland Fixed, Variable u Optional, no sólo cargos opcionales; admite Balboa → San José y mantiene coincidencia estricta de ruta, servicios e Incoterm según Pricing.
- La alternativa seleccionada pasa a Pantalla 7 sin duplicar transporte terrestre, manteniendo CostId, precios, cantidad por contenedor y cargos fijos comunes independientes. Los cargos de naviera no son reclasificados como Merchant.
- Regresión Merchant/Naviera fijo, condición explícita, selección exclusiva de transporte y contexto de ruta. Promoción selectiva de develop 1.106.4 a master; Vite/REST/SignalR sin cambios contractuales.
- DholeWeb y DholeSystem 1.106.3 → 1.106.4; los otros 15 componentes no se alteran. CI y comprobación de staging requeridas antes de producción.

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

- PATCH: al generar una nueva cotización para una cuenta CRM, Pantalla 7 obtiene los acuerdos vigentes de esa cuenta y sustituye solamente el importe de venta en los cargos que coinciden: CostId/rubro, modalidad, equipo, POL, POE, POD, naviera, Incoterm y servicios.
- Respeta opción más específica, rangos de venta, cargos manuales y descuentos; conserva costos, IVA y cotizaciones existentes. Ante fallo de CRM impide guardar cotización estándar silenciosa y permite reintentar.
- Coordinado con CRM 1.42.8 y DholeSystem 1.104.5. CI/staging pendientes antes de master.

## [1.104.4] - 2026-11-20 (DH-20261120-EXPIRED-APPROVAL-SELLER-ACCESS-312 · aprobación desde el dashboard vendedor)

- PATCH: Roy y José Pablo, este último vendedor sin rol Pricing o SuperUsuario, ven la bandeja de autorizaciones para tarifas vencidas desde Inicio y pueden aprobar o rechazar de manera segura.
- Contador actualizado por SignalR y acceso directo desde la notificación en /home?expiredApprovals=1. Se reutiliza la validación de identidad de Auth ya implementada en la API.
- DholeSystem/Web 1.104.3 → 1.104.4; Pricing 1.26.1 → 1.26.2.

## [1.104.3] - 2026-11-20 (DH-20261120-CRM-INVITEE-VISIBILITY-323 · invitados internos visibles en agenda)

- PATCH: la ficha CRM muestra nombres reales de personas invitadas internamente a cada actividad, identifica internos versus contactos externos y refresca participantes al recibir notificaciones y reconexiones SignalR.
- El calendario del invitado carga la misma actividad compartida cuando tiene permisos de tareas o seguimientos. No duplica registros ni cambia el responsable principal.
- Promoción selectiva desde develop: Web/System master 1.103.24 → 1.104.3 para empatar global 1.104.3, CRM 1.42.6 → 1.42.7; se preservan los demás cambios de producción y las versiones del resto de componentes.
- CI y staging son obligatorios antes de integrar master. 

## [1.103.24] - 2026-11-20 (DH-20261120-PRICING-COUNTRY-OPTIONS-310 · corrección del wizard de tarifas en blanco)

- PATCH: reparar TypeError pricingQuoteCountryOptions undefined al abrir Crear tarifa; la vista consume las opciones de países desde el catálogo reactivo de Config en ambas pantallas, sin acceso a computed susceptible a transformaciones Vite.
- Añade regresión de selector de país y comprobación del bundle minificado que falla si reaparece el símbolo sin enlace. Se conservan países CRM, país de POL/POD, impuestos, los contratos REST y SignalR sin cambios.
- Web/System 1.103.23 → 1.103.24; demás 15 componentes permanecen en sus versiones previas. CI y validación de staging antes de master.

## [1.103.23] - 2026-11-20 (DH-20261120-PRICING-CLIENT-COUNTRY-298 · país CRM y POL Vietnam en FCL)

- PATCH: al cotizar rutas FCL, permite seleccionar el país real del cliente en pantalla 3 si CRM no lo proporciona, sin editar CRM. Evita el bloqueo circular de campo requerido antes de pantalla 5.
- Reconoce Vietnam explícito en la etiqueta Ho Chi Minh, Vietnam aunque metadata Config incompleta; admite códigos ISO explícitos de CRM y conserva el POD para IVA.
- Web 1.103.22→1.103.23, System 1.103.22→1.103.23, 15 componentes sin cambios. Pruebas de regresión y CI; requiere validación staging antes del merge y producción no autorizada.

## [1.103.22] - 2026-11-20 (DH-20261120-CRM-INVITEE-SYNC-309 · persistencia de invitados de actividades y acuerdos CRM)

- PATCH: confirma los invitados en CRM mediante lectura tras guardar y conserva las selecciones incluso fuera de la primera página del directorio de Auth.
- Coordina con backend CRM 1.42.6 que propaga invitados posteriores a compromisos pendientes; preserva outbox, SignalR, permisos y REST.
- Web/System 1.103.20 → 1.103.22. Se respetan los releases concurrentes anteriores y CI/staging; producción expresamente autorizada para master.

## [1.103.20] - 2026-11-20 (DH-20261120-CRM-MANUAL-AMOUNT-297 · corregir guardado de ítems manuales)

- PATCH selectivo 1.103.18→1.103.20: Vue 3 v-model en campos numéricos entrega number y manual.amount.trim() lanzaba TypeError antes del try/catch, impidiendo el POST.
- Admite importes number/string mediante validador probado; formulario novalidate para mostrar errores y confirmar altas manuales. Mantiene las mejoras existentes del Dashboard y Pricing.
- Pruebas automáticas; Sin modificaciones de CRM, REST, SignalR ni infraestructura. Versionado Web/System coordinado. CI/staging previo a master.

## [1.103.18] - 2026-11-19 (DH-20261119-SELLER-DASHBOARD-PARITY-295 · equivalencia de dashboards vendedor/supervisión)

- PATCH: al seleccionar vendedor en supervisión, consulta /seller-rates/dashboard?sellerUserId y reutiliza exactamente la proyección personal publicada (manuales/directas, recibos, vinculadas y alternativas), evitando recorte por RateRequest. Cambios de selección invalidan cifras previas y respeta fechas por vendedor.
- Mantiene el guard de master de decisiones sobre cotizaciones aún no publicadas y no suplanta identidad del vendedor. La fórmula comercial permanece (aceptadas−vencidas)/(cotizadas−abiertas)×100, incluidas rechazadas en la base.
- Web/System 1.103.17→1.103.18, Pricing 1.25.3→1.25.4. Conserva resto del ecosistema, sin migraciones ni cambios SignalR. CI/staging antes de master.

## [1.103.17] - 2026-11-19 (DH-20261119-CRM-TIERED-CHECK-293 · guardar TIERED_SALE sin 409)

- PATCH: CRM 1.42.3 habilita TIERED_SALE en PostgreSQL; Web elimina duplicados y conserva pendientes tras fallos parciales, sin reenviar ítems ya persistidos.
- Master Web/System 1.103.15→1.103.17. Backport selectivo que conserva Dashboard, Pricing, APIs, SignalR y las funcionalidades existentes. CI/staging antes de producción.

## [1.103.15] - 2026-11-19 (DH-20261119-DASHBOARD-TABLE-293 · backport contextual del dashboard)

- PATCH: backport selectivo de tarjetas que filtran la tabla «Tarifas del equipo y seguimiento de ventas» y hacen scroll a esa tabla; no abre Pricing.
- Selector muestra únicamente clientes existentes en las tarifas del vendedor y el estado/búsqueda activos. Deduplica nombres y reinicia paginación; preserva la versión global 1.103.15 coordinada con System.
- Master 1.103.14→1.103.15. Sin migraciones REST ni cambios en SignalR. Antes de merge debe aprobar CI y staging; despliegue a producción no autorizado.

## [1.103.14] - 2026-11-19 (DH-20261119-DASHBOARD-PERFORMANCE-292 · ajuste de desempeño comercial)

- PATCH: el desempeño comercial se calcula como (aceptadas − vencidas) / (total cotizadas − abiertas) × 100. Las rechazadas se contabilizan en la base; las abiertas aún no se han entregado. Las vencidas penalizan incluso si producen porcentaje negativo.
- Conserva todos los filtros generales y los cinco grupos de ventas de la versión 1.103.13; incorpora prueba de regresión en CI.
- Web y System se sincronizan a 1.103.14 desde 1.103.13. 15 componentes sin cambios, REST y SignalR compatibles. Staging requerido antes de master.

## [1.103.13] - 2026-11-19 (DH-20261119-DASHBOARD-GLOBAL-FILTER-291 · dashboard comercial global)

- PATCH: filtros generales de fecha, vendedor y modalidad se aplican a indicadores comerciales, ventas, cotizaciones, solicitudes y reportería.
- Desempeño: (aceptadas + abiertas − vencidas) / cotizadas no canceladas × 100. Venta por moneda: aceptadas, abiertas, enviadas + vencidas, rechazadas y total sumado.
- DholeWeb y DholeSystem 1.103.12 → 1.103.13. Conserva el guard de recepción de decisiones comerciales publicado en master; sin alteraciones REST ni SignalR. Staging y CI requeridos antes de la promoción.

## [1.103.12] - 2026-11-19 (DH-20261119-PRICING-EXPIRY-1D-SYSTEM-291 · recordatorio interno 1 día antes del vencimiento)

- PATCH de versión coordinada DholeWeb/DholeSystem 1.103.11→1.103.12 y Pricing 1.25.2→1.25.3. Sin cambios visuales ni de rutas; el centro de notificaciones existente recibe eventos System desde Pricing a través de Redis Streams y SignalR.
- Recordatorio al vendedor asignado a las 09:00 (Costa Rica) del día anterior a ValidTo; correo preexistente conservado, mensaje interno idempotente. Migración compatible para marcador 1d-system.
- CI, staging y pruebas obligatorias antes de master. Producción no autorizada.

## [1.103.11] - 2026-11-19 (DH-20261119-CRM-INVITATIONS-SAVE-290 · CRM: guardado de invitados)

- PATCH: versión coordinada con DholeSystem 1.103.11 y DholeCRMService 1.42.2; conserva los selectores de invitados y payload participantUserIds de la agenda.
- El backend valida los invitados contra Auth y persiste invitaciones y avisos de forma individual, sin cambios incompatibles de REST ni SignalR.
- CI, staging y aprobación explícita de despliegue productivo requeridos antes de merge a master.

## [1.103.10] - 2026-11-19 (DH-20261119-CRM-FOLLOWUP-EDIT-PROMOTION-286 · editor CRM de seguimientos)

- PATCH: promueve desde staging el editor integral de seguimientos y recordatorios. Permite editar asunto, tipo, fechas, responsable, invitados y avisos sin crear duplicados, con recuperación de borradores y control de concurrencia.
- Conserva los cambios del master 1.103.9, incluido CRM de tarifas preferenciales. Coordinado con DholeSystem 1.103.10 y CRM 1.42.1. Mantiene APIs REST y eventos SignalR.
- Validación de compilación y regresión CRM antes de integrar a master.

## [1.103.9] - 2026-11-19 (DH-20261119-CRM-MANUAL-BENEFITS-285 · backport corrección guardado de ítems manuales)

- PATCH: backport funcional del release 275 a la versión actual de master (1.103.8), sin perder las correcciones posteriores de Pricing/CIF/LTL y CRM.
- Verifica con GET que CRM guardó el ítem manual (nombre, valor, moneda, unidad) antes de limpiar el formulario; muestra los cargos manuales de la combinación y el resultado junto al botón.
- Evita solicitudes simultáneas y añade prueba de regresión. Coordinación DholeWeb/DholeSystem 1.103.8→1.103.9. Backend CRM, REST y SignalR sin modificaciones.
- Validar CI, versionado y despliegue automático tras merge a master.

## [1.103.8] - 2026-11-19 (DH-20261119-PRICING-LTL-DDP-FREIGHT-284 · promoción selectiva DDP/LTL a master)

- PATCH Web/System 1.103.7→1.103.8 coordinado con DholePricingService 1.25.1→1.25.2. El backend ahora acepta flete internacional cotizado DDP para LTL/FTL por CBM/camión sin exigir distribución FCL.
- Web conserva íntegra la funcionalidad de master y el payload existente (shipmentMode Ltl, containers []); solo cambia metadatos/versionado para el parche backend. No se incorporan diferencias no relacionadas de develop.
- Misma corrección validada en CI/staging; controles CIF/FCL, contratos REST, SignalR y datos existentes sin cambios.

## [1.103.7] - 2026-11-19 (DH-20261119-PRICING-LTL-MANUAL-ENDTOEND-278 · recuperación de LTL manual y país CRM)

- PATCH master 1.103.6→1.103.7 solo para Web/System: reconoce LTL manual propio como fuente válida en pantallas 5 y 6; conserva importe y estado en borradores.
- Las solicitudes de Ventas consultan el país y responsable CRM al retomar pantalla 5; si el país falta, Pricing debe seleccionarlo explícitamente para esta cotización sin modificar CRM. Guardado señala el motivo sin redirección silenciosa.
- Hotfix aislado de Pricing; sin integrar cambios extra CRM ni alterar servicios backend, permisos, REST o SignalR. CI y staging antes de master.

## [1.103.6] - 2026-11-19 (DH-20261119-PRICING-LTL-STEP6-277 · validación LTL manual paso 6)

- PATCH: el paso 6 de LTL/FTL terrestre no requiere un carrierId marítimo oculto. Solo el LTL coloader manual exige agente; moneda, costo y venta deben ser valores numéricos válidos no negativos.
- Se sincronizan los mensajes de campos obligatorios con la validación del botón Continuar. Las reglas marítimas existentes se conservan.
- Web/System 1.103.5 → 1.103.6; pruebas de regresión, compilación y staging antes de master; backend, REST y SignalR sin cambios.

## [1.103.5] - 2026-11-19 (DH-20261119-PRICING-COUNTRY-LTL-276 · corrección país cliente CRM y fuente LTL propia)

- PATCH de promoción aislada a master desde desarrollo probado en staging 1.103.5. Salta el intervalo de números de develop 1.103.3/1.103.4 sin arrastrar funcionalidad CRM ni cambios pendientes. Web/System master 1.103.2 → 1.103.5, versiones de backend sin cambios.
- Pricing utiliza Config/countries para resolver UUID de país del cliente CRM y conserva configuración IVA de country-vat-rates; corrige bloqueo de guardado por perspectivas comerciales indebidamente indeterminadas.
- Pantalla 5 de tarifas LTL permite crear tarifa propia manual al no encontrar una tarifa vigente, independiente de la opción manual coloader.
- Se conservan contratos REST, SignalR, scopes y migraciones. CI y staging preceden a la integración de master. Producción se maneja mediante el workflow de master.

## [1.103.2] - 2026-11-19 (DH-20261119-WIZARD-ROUTE-RUNTIME-274 · sin referencias runtime en Crear tarifa)

- PATCH: corrige `resolveClientRouteOperation is not defined` y evita el anterior `routeOperation is not defined`: calcula la perspectiva desde país CRM + POL/POD directamente en los computados existentes del wizard, sin helper adicional.
- Mantiene importación/exportación/tránsito, Incoterms y bloqueo de guardado cuando faltan países; CI valida que el bundle minificado no contenga las referencias inválidas.
- Coordinado con DholeSystem 1.103.2. Compilación y staging obligatorios antes de producción; backend y realtime sin cambios.

## [1.103.1] - 2026-11-19 (DH-20261119-WIZARD-ROUTE-REF-273 · wizard de tarifas sin referencia inválida)

- PATCH: evita `Can't find variable: routeOperation` al abrir Crear tarifa, sustituyendo la referencia por un resolvedor elevado a función que permanece disponible para Vue/Vite.
- Preserva perspectiva Import/Export/TransitDomestic según país CRM y POL/POD, validación del país de cliente e Incoterms; añade prueba de regresión de bindings.
- Release coordinado DholeWeb/DholeSystem 1.103.1; sin cambios en datos, REST ni SignalR. Validar CI y staging antes de integrar master; despliegue productivo no autorizado.

## [1.103.0] - 2026-11-19 (DH-20261119-PRICING-RETURN-PROMOTION-272 · devolver solicitudes incorrectas de Pricing)

- MINOR: ahora Pricing puede usar «Devolver solicitud» al lado de «Continuar tarifa» con un motivo obligatorio y la reserva vigente; Ventas recibe notificación sistema/correo, ve el motivo y puede corregir y reenviar la misma solicitud.
- Promoción aislada de la funcionalidad CI/staging aprobada de develop. No arrastra otras diferencias entre ramas; versiones de Web/System 1.102.0→1.103.0, Pricing 1.24.9→1.25.1.
- Validación de build, test y versión antes de la promoción de master, que activa despliegue productivo automático.

## [1.102.0] - 2026-11-19 (DH-20261119-PRICING-CLIENT-COUNTRY-PROD-271 · Incoterms según país de cliente en producción)

- MINOR: libera clasificación del cliente según su país CRM frente a POL y POD final, incluyendo responsable de Incoterm y flete; elimina la referencia fija a Costa Rica.
- Preserva todos los cambios de release 270/271: Web 1.100.1 → 1.102.0, System 1.101.0 → 1.102.0, CRM 1.41.0 → 1.42.0.
- Cliente país origen: exporta; país destino: importa; tercer país: tránsito/doméstico. Se bloquea guardado con país desconocido. IVA/aduanas permanece por país físico POD.
- Versionado y pruebas CI/semver, staging primero, después master con autorización expresa de producción.

## [1.100.1] - 2026-11-19 (DH-20261119-CRM-PREFERENTIAL-ROUTE-271 · Filtro de rutas en tarifas preferenciales)

- PATCH: «Mostrar todos los ítems de Pricing» ya no pasa por alto POL/POE/POD, naviera, Incoterm ni servicios seleccionados.
- Con POE Caldera y POD San José se excluyen los costos asociados a otros puertos, incluyendo portRole=Any o sin rol y vínculos explícitos incompatibles.
- Permite otras modalidades solamente si sus cargos son aplicables a los puertos; mantiene cargos generales y edición manual.
- Pruebas de regresión incluidas. Backport selectivo desde develop; no incorpora cambios funcionales ajenos al release.
- Web/System 1.100.0 → 1.100.1; CRM 1.41.0 sin cambios. Staging y CI requieren verificación.

## [1.100.0] - 2026-11-19 (DH-20261119-CRM-PREFERENTIAL-MATCH-270 · selección por servicio, manual y fallback)

- MINOR: backport a master del configurador de preferencias con todos los ítems de Pricing, alta manual, modalidad aérea y selección de servicios y ámbitos opcionales.
- Vista previa de tarifa más específica sin sobrescribir las generales; inventario de acuerdos de la cuenta. Conserva fixes CIF existentes de master.
- Integración automática en cotizaciones de Pricing fuera de este release; costos originales no se alteran.
- Web/System 1.98.0 → 1.100.0; CRM 1.39.0 → 1.41.0 (versión de release igual que develop).

## [1.98.0] - 2026-11-19 (DH-20261119-CRM-PREFERENTIAL-SCOPE-267 · tarifas preferenciales por naviera e Incoterm)

- MINOR: backport de CRM > Tarifas preferenciales con ámbito persistente por naviera e Incoterm en configurador y editor avanzado.
- Los filtros de costos usan los criterios sin alterar el costo de Pricing; acuerdos antiguos siguen compatibles y su aplicación automática a cotizaciones permanece pendiente.
- Mantiene corrección CIF del release DH-20261119-GCF-CIF-268-MASTER y todas las funcionalidades actuales de master.
- DholeWeb/DholeSystem 1.97.9 → 1.98.0; CRM 1.38.0 → 1.39.0; pruebas y release en master después de staging.

## [1.97.9] - 2026-11-19 (DH-20261119-GCF-CIF-268-MASTER · Grupo Castro Fallas mundial y CIF sin flete)

- PATCH: backport selectivo del release 1.98.1 de develop, sin arrastrar cambios nuevos de CRM ni API.
- Al guardar GCF se escriben todos los 249 códigos ISO 3166-1 y nombres de países/territorios en metadata.countries y metadata.countryCodes; se mantiene allCountries y el resto de campos existentes.
- Pricing FCL ofrece GCF para cualquier POL aunque su metadata histórica sea parcial y prioriza a los agentes específicos del país.
- Duplicación CIF/CFR de importación sin flete marítimo a cargo del cliente puede continuar y guardarse sin exigir un nuevo flete. FOB/EXW importación y CIF exportación conservan el requisito.
- DholeWeb y DholeSystem master 1.97.8 → 1.97.9. Los servicios restantes conservan sus versiones y comportamiento REST/realtime. CI antes de fusionar.

## [1.97.8] - 2026-11-19 (DH-20261119-DHOLE-REBRAND-266 · Identidad Dhole System)

- PATCH: reemplaza Orvelum System por Dhole System en producción, login, sidebar, textos ES/EN, notificación de versión, metadatos y build.
- Nuevo logo SVG transparente de globo logístico, paquete y ruta, para favicon y navegación. Preserva la cobertura mundial GCF 1.97.7 sin alteraciones.
- Web/System master 1.97.7 → 1.97.8; staging ya preparado en versión 1.97.7 del mismo cambio visual. Sin cambios de API ni permisos.

## [1.97.7] - 2026-11-19 (DH-20261119-GCF-ALL-COUNTRIES-266 · Grupo Castro Fallas con cobertura mundial)

- PATCH: promoción de la corrección GCF validada en develop 1.97.5, aplicada sobre master 1.97.6.
- GCF opera en todos los países actuales y futuros; catálogo muestra «Todos los países», persiste metadata.allCountries al guardar y preserva los países/códigos preexistentes.
- En Pricing LCL y cotizaciones existentes GCF es alternativa para cualquier POL; se priorizan agentes específicos del país cuando existen.
- Mantiene Orvelum System y su iconografía en master, sin trasladar la identidad de staging.
- DholeWeb/DholeSystem 1.97.6 → 1.97.7; el resto de microservicios sin cambios. CI y pruebas de regresión obligatorias; sin despliegue manual.

## [1.97.6] - 2026-11-19 (DH-20261119-PRICING-CIF-NAV-265 · CIF importación: avance a costos sin alternativas marítimas)

- PATCH: Corrige el bloqueo de Pantalla 6 «Ir a líneas 1/0»: CIF/CFR importación sin flete facturable avanza con navegación estándar a Pantalla 7; no se exige ni crea flete internacional. FOB/EXW importación y CIF exportación conservan MultiQUO.
- Release global 1.97.6; las versiones intermedias 1.97.4 y 1.97.5 se reservaron para cambios de staging que no se promoverán junto a este parche, por lo que master pasa directamente desde 1.97.3.
- Conserva Orvelum System y todas las funcionalidades productivas existentes. Sin despliegue de producción hasta validación de staging y autorización expresa.

## [1.97.3] - 2026-11-19 (DH-20261119-PRICING-CIF-NO-FREIGHT-262 · Importación CIF sin flete marítimo adicional)

- PATCH: Pantalla 6 del wizard FCL oculta ambas tarjetas de creación de flete manual cuando el Incoterm ya cubre el tramo internacional (CIF/CFR en importación).
- Impide crear una fuente manual de flete por llamada directa en operaciones sin ese cargo; conserva cargos de destino y aduanas.
- Al omitir Pantalla 5, agente, naviera y moneda se eligen en Pantalla 6 sin bloquear la selección de naviera.
- Regresiones CIF importación, FOB importación, CIF exportación y DDP exportación. Web/System 1.97.2 → 1.97.3; CI y staging pendientes antes de master.
- Preserva Orvelum System en master/producción; sin despliegue productivo.

## [1.97.2] - 2026-11-19 (DH-20261119-ORVELUM-TRANSPARENT-261 · Icono transparente Orvelum System)

- PATCH de master: elimina el fondo del icono orbital y adapta su color a la paleta activa de la interfaz en login y sidebar.
- El favicon SVG carece de fondo; se invalida la caché en la versión 1.97.2. Conservar Orvelum System en producción.
- Respeta las mejoras de Dashboard de Operaciones 1.97.1; en develop se restaura la identidad anterior Dhole.

## [1.97.1] - 2026-11-19 (DH-20261119-OPS-DASHBOARD-UX-257 · Rediseño operativo)

- PATCH: unifica el encabezado del Dashboard de Operaciones con selector de rol Dh y filtros por equipo en una barra adaptable.
- Los cuatro KPI no muestran ceros ficticios durante la carga, los resultados del equipo anterior se descartan, y el listado vacío es compacto y proporciona acceso a Trámites.
- Traducciones ES/EN, tests de regresión; conserva roles/scopes y las vistas de Pricing/Vendedor. Web/System 1.97.0 → 1.97.1. Staging validado en develop; producción pendiente de aprobación.

## [1.97.0] - 2026-11-19 (DH-20261119-ORVELUM-BRAND-256 · Orvelum System)

- MINOR: Orvelum System en interfaz ES/EN, login, menú y avisos de actualización.
- Icono orbital y favicon SVG; título del navegador con versión real: Orvelum System · v1.97.0.
- Web/System sincronizados, sin cambiar contratos API, permisos, integraciones ni identificadores técnicos Dhole.

## [1.96.1] - 2026-11-19 (DH-20261119-OPS-SIDEBAR-255 · Navegación de Operaciones simplificada)

- PATCH: elimina únicamente la entrada de «Aperturas» del sidebar de Operaciones; permanecen «Trámites» y «Equipos» según scopes.
- La ruta protegida /operations/apertures, la validación dual, los datos y el acceso desde Dashboard se conservan intactos.
- Web/System 1.96.0 → 1.96.1; Operations y demás servicios conservan sus versiones. Promoción master pendiente de validaciones y autorización.

## [1.96.0] - 2026-11-19 (DH-20261119-OPS-ROLE-TEAM-DASHBOARD-254 · Dashboard por rol y equipo)

- MINOR: Dashboard de Operaciones con selección de equipos permitidos, resumen real de Aperturas, doble validación y expedientes recientes.
- Rediseño de Equipos usando componentes Dh, lista visible por departamento y bitácora plegable; mantiene DhMultiSelect y Auth.
- Tabla de solicitudes de Pricing sin fondos rojos completos por fila, con prioridad señalizada en badges/bordes.
- Release promovido selectivamente desde develop, probado en staging. Web 1.95.1 → 1.96.0, Operations 0.11.0 → 0.12.0 y System 1.95.1 → 1.96.0.

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

## [1.91.1] - 2026-11-19 (DH-20261119-OPS-ROLE-NAME-248 · rol logístico existente)

- PATCH: el selector de integrantes muestra correctamente el rol «Operativo Logístico», junto con «Supervisor Operativo».
- Web/System 1.91.1, Auth 1.16.1, Operations 0.10.0 sin cambios; complementa DH-247.

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
- CRM prospect capture: source of acquisition, referral notes, province and canton, contacts.
- Structured contact management in prospect detail and identity preservation during account conversion.
- Follow backend/Config 1.38.0/1.12.0. Production deployment requires explicit authorization.

## [1.83.2] - 2026-11-18 (SRM: mostrar descripción y vigencia de adjuntos)

- PATCH DH-20261118-SRM-ATTACHMENT-METADATA-240: cada adjunto de tarifas y crédito muestra descripción; las tarifas presentan fechas de vigencia desde/hasta, con formato dd/mm/aaaa y etiquetas para datos no indicados.
- Compatibilidad con metadatos históricos de Storage (`metadatJson`) y contrato corregido `metadataJson`; no altera archivos existentes, sus permisos, ni las funciones Ver y Descargar.
- DholeWeb 1.83.1 → 1.83.2; DholeStorageService 1.2.2 → 1.2.3; versión de ecosistema objetivo 1.87.5.

## [1.83.1] - 2026-11-18 (Ventas: retirar cancelación de cotizaciones)

- PATCH DH-20261118-SELLER-CANCEL-HIDE-234: elimina «Cancelar cotización» del dashboard comercial de vendedores (móvil y escritorio), detalle y modal de decisión. Permanecen Ver tarifa, aceptación, rechazo, PDF y modificaciones permitidas.
- La cancelación de cotizaciones aceptadas permanece exclusivamente en el módulo Pricing con scopes y auditoría existentes; sin cambios en REST, microservicios ni SignalR.
- DholeWeb 1.83.0 → 1.83.1; DholeSystem/ecosistema 1.87.3 → 1.87.4. CI y staging pendientes; producción no autorizada.

## [1.83.0] - 2026-11-18 (CRM: agenda compartida e invitados internos)

- MINOR DH-20261118-CRM-SHARED-AGENDA-229: selección múltiple de empleados de Auth como invitados a llamadas, citas, reuniones y seguimientos. Misma actividad visible en sus calendarios y recordatorios individuales Email/System mediante Outbox.
- Cambios de invitados en detalle, roles y scopes conservados, REST compatible; controles idempotentes. DholeWeb 1.82.1 → 1.83.0; DholeCRMService 1.36.0 → 1.37.0, DholeSystem/ecosistema 1.86.1 → 1.87.0.
- CI/staging pendientes; producción no autorizada.

## [1.82.1] - 2026-11-18 (LCL/LTL: peso por unidad de carga · master)

- PATCH DH-20261118-CARGO-WEIGHT-PER-UNIT-229: backport selectivo de develop a master. El peso ingresado se interpreta por unidad y se multiplica por cantidad, como el CBM/CFT. El resumen de Ventas y los equivalentes por peso respetan todas las unidades.
- El API continúa recibiendo peso total por línea; la rehidratación en Pricing restaura peso unitario sin duplicaciones. Solicitudes históricas con desglose deben validarse con Ventas antes de rehacer la cotización.
- Web 1.82.0 → 1.82.1; Pricing 1.24.5 → 1.24.7; DholeSystem/ecosistema 1.86.0 → 1.86.1. Se preservan cambios específicos de master. Staging Web/Pricing desplegado correctamente; CI de master y prueba autenticada aún por verificar.

## [1.82.0] - 2026-11-18 (Blobatar: estresado, cansado y resignado)

- MINOR DH-20261118-BLOBATAR-MOODS-228: tres nuevas expresiones propias para Blobatar 2.7.0: Estresado (temblor y mirada inquieta), Cansado (ojos vencidos) y Resignado (mirada caída, asimétrica).
- Las 17 poses se comparten entre el encabezado y Configuración → Apariencia; se conservan el ciclo Auto de 30 segundos, Fijo, persistencia por usuario, animaciones, mirada y movimiento reducido. Traducciones ES/EN y regresión SSR.
- DholeWeb 1.81.x → 1.82.0; DholeSystem/ecosistema → 1.86.0. Otros 15 componentes sin cambios. Sin cambios REST, SignalR o scopes; CI y staging obligatorios antes de promover master.

## [1.81.0] - 2026-11-18 (SRM · categorías y rutas de proveedores)

- MINOR DH-20261118-SRM-ROUTES-225: diez categorías logísticas de proveedor, multiselección y conservación de clasificaciones históricas.
- DhDrawer con pestañas de ficha, contactos, bancos, crédito, tarifas, bitácora y rutas; cobertura POL/POE/POD multiorigen/destino y CRUD auditado en Config.
- Config 1.10.1 → 1.11.0; Web master 1.80.4 → 1.81.0; ecosistema master 1.84.4 → 1.85.0. Conserva el backport EXW/LCL de Pricing. CI y staging validados en develop; verificar candidate master antes del merge.

## [1.80.4] - 2026-11-18 (Pricing: recolecta EXW en LCL propio)

- PATCH DH-20261118-PRICING-EXW-PICKUP-226: backport sobre master del ajuste validado en develop para mostrar recolecta EXW editable aun sin costo maestro, conservar precios manuales y reflejar rubros al guardar.
- Vincula únicamente costos EXW de recolecta aplicables a la ruta y evita sobrescribir los importes negociados al actualizar matriz; vista conserva el snapshot histórico sin regeneración.
- DholeWeb 1.80.3 → 1.80.4, DholePricingService 1.24.4 → 1.24.5, DholeSystem 1.83.6 → 1.84.4. Ecosistema master 1.84.3 → 1.84.4; release funcional equivalente al develop Web 1.81.1, Pricing 1.24.5, System 1.85.1.
- CI del backport pendiente; staging del release develop aprobó despliegue y health/bundle. No hay aún smoke autenticado del caso real.
- Staging comprobado: Pricing https://github.com/CustomCodeCR/DholePricingService/actions/runs/44381748194 y Web https://github.com/CustomCodeCR/DholeWeb/actions/runs/44381755824 (ambos success). CI de backport debe superar controles propios de master antes de integrar.

## [1.80.3] - 2026-11-18 (Pricing: flete DDP exportación terrestre LTL/FTL)

- PATCH DH-20261118-DDP-EXPORT-FREIGHT-225: corregir el filtrado de flete internacional por Incoterm para distinguir exportador/importador. DDP en exportación y EXW en importación conservan flete cuando el servicio internacional está contratado.
- La pantalla de proveedor ya no oculta ni borra costo/venta o líneas de Freight para DDP exportación; mantiene la protección contra reinicios transitorios durante carga de catálogos. Importación DDP continúa sin cargar automáticamente el flete al importador; doméstico permite tramos contratados.
- Regresiones de tipos de operación y flujo de cotización; sin migraciones, nuevos scopes ni cambios de contrato REST o eventos SignalR.
- DholeWeb 1.80.2 → 1.80.3; DholePricingService 1.24.3 → 1.24.4; ecosistema 1.84.2 → 1.84.3. CI y staging requeridos antes de master.

## [1.80.0] - 2026-11-18 (Pricing: múltiples puntos y perspectiva comercial)

- MINOR DH-20261118-INLAND-MULTIPOINT-219: recolección y entrega registran múltiples paradas con tipo de carga y responsable de costos por punto. Se conservan coordenadas opcionales y soporte a solicitudes históricas de un solo punto.
- Incoterms EXW y DDP mantienen significado ICC; importación/exportación cambian la perspectiva de quién contrata/paga y tránsito doméstico permite responsable híbrido por tramo.
- API REST retrocompatible, outbox/inbox/SignalR y scopes existentes sin cambios; CI/staging pendientes, sin despliegue a producción.
- DholeWeb 1.79.2 → 1.80.0; DholePricingService 1.23.6 → 1.24.0; ecosistema 1.83.2 → 1.84.0.

## [1.79.5] - 2026-11-18 (MultiQUO: detalle con alternativas internas)

- PATCH DH-20261118-MULTIQUO-SINGLE-223: listado y búsqueda muestran una sola QUO base; dentro del wizard y modal vendedor se comparan A/B y se acepta una opción del grupo.
- La otra alternativa queda como No seleccionada en historial, sin cotización comercial extra. Conserva mejoras de error de reservas, Dh componentes, scopes y sincronización en tiempo real.
- Web 1.79.4 → 1.79.5; Pricing 1.23.9 → 1.23.10; ecosistema 1.83.5 → 1.83.6. CI/staging previos a master.

## [1.79.4] - 2026-11-18 (Pricing: apertura de solicitudes con errores legibles)

- PATCH DH-20261118-PRICING-LEASE-220: el wizard distingue el error de reserva del de lectura y muestra el código HTTP y TraceId disponible; Reintentar reutiliza el control de operaciones pendientes y no duplica claims.
- El backend obtiene el resultado del advisory lock PostgreSQL de forma tipada y devuelve 409 de contención o 503 con identificador de diagnóstico. Se conservan la seguridad, auditoría, heartbeat y SignalR.
- DholeWeb 1.79.3 → 1.79.4; Pricing 1.23.7 → 1.23.8; ecosistema 1.83.3 → 1.83.4. CI/staging antes del merge a master.

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
