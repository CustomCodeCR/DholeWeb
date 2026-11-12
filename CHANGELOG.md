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
