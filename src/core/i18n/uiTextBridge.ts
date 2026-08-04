import es from './es.json'
import en from './en.json'
import type { LocaleCode } from '@/core/stores/locale'

type MessageTree = Record<string, unknown>
type TextState = { source: string; applied: string }

const legacyPairs: Array<[string, string]> = [
  ['Operations Platform', 'Plataforma de operaciones'],
  ['Centro de trabajo', 'Workspace'],
  [
    'Empiece por la siguiente tarea del flujo operativo y deje la administración para cuando la necesite.',
    'Start with the next operational task and use administration only when needed.',
  ],
  ['Bienvenido', 'Welcome'],
  ['Acceso recomendado', 'Recommended access'],
  ['Bandeja de correos de tarifas', 'Rate email inbox'],
  [
    'Revise primero qué correos requieren una acción manual.',
    'First review which emails require manual action.',
  ],
  ['Abrir bandeja', 'Open inbox'],
  ['Operación diaria de Pricing', 'Daily pricing operation'],
  [
    'Siga estos pasos en orden. Cada tarjeta abre exactamente la pantalla necesaria.',
    'Follow these steps in order. Each card opens the exact screen you need.',
  ],
  ['Herramientas y administración', 'Tools and administration'],
  [
    'Configuración, monitoreo, archivos, auditoría y seguridad.',
    'Configuration, monitoring, files, audit and security.',
  ],
  ['Abrir módulo', 'Open module'],
  ['Comenzar flujo', 'Start workflow'],
  [
    'El flujo principal de Dhole inicia con la recepción del correo, continúa con la revisión de la extracción y termina en una tarifa oficial.',
    'Dhole’s main flow starts when an email arrives, continues with extraction review and ends with an official rate.',
  ],
  ['Asistente IA', 'AI Assistant'],
  ['Abrir asistente IA', 'Open AI assistant'],
  ['¿En qué puedo ayudarte?', 'How can I help you?'],
  [
    'Pregunta sobre el sistema, procesos o información operativa sin abandonar la pantalla actual.',
    'Ask about the system, processes or operational information without leaving the current screen.',
  ],
  ['Perfil: assistant', 'Profile: assistant'],
  ['Perfil activo: assistant', 'Active profile: assistant'],
  [
    'Enter para enviar · Shift + Enter para nueva línea',
    'Enter to send · Shift + Enter for a new line',
  ],
  ['Escribe tu mensaje...', 'Type your message...'],
  [
    'Escriba su consulta... Enter para enviar, Shift+Enter para nueva línea',
    'Type your question... Enter to send, Shift+Enter for a new line',
  ],
  ['Limpiar conversación', 'Clear conversation'],
  ['Conversación', 'Conversation'],
  ['Inicie una conversación', 'Start a conversation'],
  ['Asistente de IA', 'AI Assistant'],
  [
    'Converse con el asistente general de Dhole. Las preguntas y respuestas quedan registradas en AuditLogs.',
    'Chat with Dhole’s general assistant. Questions and answers are recorded in AuditLogs.',
  ],
  ['Centro de inteligencia artificial', 'Artificial intelligence center'],
  [
    'Pruebe perfiles, administre proveedores y prepare el servicio para integraciones gRPC y tareas en segundo plano.',
    'Test profiles, manage providers and prepare the service for gRPC integrations and background tasks.',
  ],
  ['Conexiones sanas', 'Healthy connections'],
  ['Modelos activos', 'Active models'],
  ['Perfiles activos', 'Active profiles'],
  ['Ejecuciones OK', 'Successful executions'],
  ['Costo últimas 50', 'Cost of last 50'],
  ['Banco de pruebas', 'Playground'],
  [
    'La ejecución usa el perfil completo, incluyendo prioridad, fallback, costos y plantilla.',
    'The execution uses the complete profile, including priority, fallback, costs and template.',
  ],
  ['Seleccione un perfil activo', 'Select an active profile'],
  ['Buscar conexiones', 'Search connections'],
  ['Buscar modelos', 'Search models'],
  ['Buscar perfiles', 'Search profiles'],
  ['Buscar plantillas', 'Search templates'],
  ['Buscar ejecuciones', 'Search executions'],
  ['Configuración del proveedor', 'Provider configuration'],
  ['Proveedor', 'Provider'],
  ['URL base', 'Base URL'],
  ['Referencia del secreto', 'Secret reference'],
  ['Timeout (segundos)', 'Timeout (seconds)'],
  ['Seleccione una conexión', 'Select a connection'],
  ['Capacidades', 'Capabilities'],
  ['Ventana de contexto', 'Context window'],
  ['Costo entrada / 1M', 'Input cost / 1M'],
  ['Costo salida / 1M', 'Output cost / 1M'],
  ['Modelos del perfil', 'Profile models'],
  [
    'Ordene por prioridad y marque cuáles pueden utilizarse como fallback.',
    'Order by priority and mark which models may be used as fallback.',
  ],
  [
    'No hay modelos activos. Registre o active uno antes de crear el perfil.',
    'There are no active models. Register or activate one before creating the profile.',
  ],
  ['Key de integración', 'Integration key'],
  ['Asistente de Pricing', 'Pricing Assistant'],
  ['Uso del perfil', 'Profile purpose'],
  ['Plantilla', 'Template'],
  ['Enrutamiento', 'Routing'],
  ['Formato de respuesta', 'Response format'],
  ['Temperatura', 'Temperature'],
  ['Máximo de tokens', 'Maximum tokens'],
  ['Prioridad', 'Priority'],
  ['Permitir fallback', 'Allow fallback'],
  ['Guardar cambios', 'Save changes'],
  ['Crear perfil', 'Create profile'],
  ['Conexión', 'Connection'],
  ['Detectados', 'Discovered'],
  ['Registrados', 'Registered'],
  ['Disponible', 'Available'],
  [
    'El proveedor no devolvió modelos disponibles.',
    'The provider did not return any available models.',
  ],
  ['Registrado', 'Registered'],
  ['Nuevo', 'New'],
  ['Registrar', 'Register'],
  ['Estado', 'Status'],
  ['Tipo', 'Type'],
  ['Duración', 'Duration'],
  ['Costo estimado', 'Estimated cost'],
  ['Resolución', 'Resolution'],
  ['Perfil', 'Profile'],
  ['Modelo', 'Model'],
  ['Inicio', 'Start'],
  ['Fin', 'End'],
  ['Tokens', 'Tokens'],
  ['Finalización', 'Completion'],
  ['Errores', 'Errors'],
  ['Intentos', 'Attempts'],
  ['System prompt', 'System prompt'],
  ['Plantilla del usuario', 'User template'],
  ['Uso esperado de esta plantilla', 'Expected use of this template'],
  ['Variables', 'Variables'],
  ['Use variables con formato', 'Use variables in the format'],
  ['. Sepárelas por coma o por línea.', '. Separate them with commas or line breaks.'],
  ['Resumen de tarifa', 'Rate summary'],
  ['Eres un asistente especializado en...', 'You are an assistant specialized in...'],
  ['Analiza la tarifa {{rateJson}} y devuelve...', 'Analyze the rate {{rateJson}} and return...'],
  ['Storage', 'Storage'],
  [
    'Archivos importados, correos, adjuntos, versiones y proveedores de almacenamiento.',
    'Imported files, emails, attachments, versions and storage providers.',
  ],
  ['Archivos', 'Files'],
  ['Imágenes', 'Images'],
  ['Vista previa integrada', 'Built-in preview'],
  ['Se abren dentro de Dhole', 'Opened inside Dhole'],
  ['Proveedores', 'Providers'],
  ['Activos / configurados', 'Active / configured'],
  ['Nombre, checksum, servicio o entidad', 'Name, checksum, service or entity'],
  ['Archivo eliminado', 'File deleted'],
  ['Selects de Pricing', 'Pricing selects'],
  ['Administrar catálogos', 'Manage catalogs'],
  [
    '20DV, 40DV, 40HC, 45HC u otros contenedores usados en pricing.',
    '20DV, 40DV, 40HC, 45HC or other containers used in pricing.',
  ],
  ['Branding por cliente', 'Client branding'],
  [
    'Estos valores se aplican con variables CSS al cliente activo, sin cambiar el color global del servidor.',
    'These values are applied through CSS variables to the active client without changing the server-wide color.',
  ],
  ['Color principal', 'Primary color'],
  ['Imagen de fondo', 'Background image'],
  [
    'Use un valor alto si la imagen tiene mucho detalle y necesita que las tarjetas sigan siendo legibles.',
    'Use a high value when the image has a lot of detail and cards must remain readable.',
  ],
  ['Preview', 'Vista previa'],
  ['Previsualizar', 'Preview'],
  [
    'El color afecta botones, brillos, selección, scrollbars y acentos visuales.',
    'The color affects buttons, glows, selections, scrollbars and visual accents.',
  ],
  ['Preferencias locales', 'Local preferences'],
  [
    'Herramientas para limpiar el estado guardado en este navegador.',
    'Tools to clear state stored in this browser.',
  ],
  ['Restaurar', 'Restore'],
  ['Guardar cliente', 'Save client'],
  ['Cambie el modo visual general del sistema.', 'Change the system’s overall visual mode.'],
  ['Cambie el idioma de la interfaz.', 'Change the interface language.'],
  ['Combinación', 'Key combination'],
  ['Grabar', 'Record'],
  ['Grabando', 'Recording'],
  [
    'Atajos personalizables guardados localmente. Dhole los intercepta antes que el navegador cuando la app tiene foco.',
    'Customizable shortcuts stored locally. Dhole intercepts them before the browser when the app has focus.',
  ],
  ['Volver', 'Back'],
  ['Split workspace', 'Espacio de trabajo dividido'],
  ['Detalle de usuario', 'User details'],
  [
    'El detalle completo se abre normalmente desde el drawer de usuarios para mantener el contexto de trabajo.',
    'Full details normally open from the users drawer to preserve work context.',
  ],
  ['Detalle de rol', 'Role details'],
  [
    'El detalle completo se abre desde el drawer de roles.',
    'Full details open from the roles drawer.',
  ],
  ['Detalle de permiso', 'Scope details'],
  ['Los scopes son de solo lectura desde Auth.', 'Scopes are read-only from Auth.'],
  ['Detalle de sesión', 'Session details'],
  [
    'La administración de sesiones se realiza desde la vista de sesiones.',
    'Sessions are managed from the sessions view.',
  ],
  ['Bloqueado', 'Locked'],
  ['Desbloqueado', 'Unlocked'],
  ['Revocada', 'Revoked'],
  ['Activa', 'Active'],
  ['Inactivar', 'Deactivate'],
  ['Desbloquear', 'Unlock'],
  ['Cambiar contraseña', 'Change password'],
  ['Nueva contraseña', 'New password'],
  ['Digite la nueva contraseña', 'Enter the new password'],
  ['Guardar contraseña', 'Save password'],
  ['Guardar y agregar otro', 'Save and add another'],
  ['Buscar usuario por nombre o correo', 'Search user by name or email'],
  ['Flujo de trabajo', 'Workflow'],
  [
    'Siga los pasos de izquierda a derecha. Puede volver a cualquier etapa sin perder los datos.',
    'Follow the steps from left to right. You can return to any stage without losing data.',
  ],
  ['Flujo de Pricing', 'Pricing workflow'],
  ['Correos de tarifas', 'Rate emails'],
  ['Revisar importaciones', 'Review imports'],
  ['Revisar lote de tarifas', 'Review rate batch'],
  ['Volver a bandeja', 'Back to inbox'],
  ['Salir del lote', 'Exit batch'],
  ['Mesa de decisión FCL', 'FCL decision desk'],
  ['Importar tarifario', 'Import rate sheet'],
  ['Crear tarifa manual', 'Create manual rate'],
  ['Nuevo costo', 'New cost'],
  ['Tarifas', 'Rates'],
  ['Costos', 'Costs'],
  ['Aplicar filtros', 'Apply filters'],
  ['Todas', 'All'],
  ['Todos', 'All'],
  ['Abrir pantalla de revisión', 'Open review screen'],
  ['Aprobación requerida', 'Approval required'],
  ['Aprobada', 'Approved'],
  ['Aprobadas', 'Approved'],
  ['Borrador', 'Draft'],
  ['Borradores', 'Drafts'],
  ['Rechazada', 'Rejected'],
  ['Rechazadas', 'Rejected'],
  ['Pendiente', 'Pending'],
  ['Pendientes', 'Pending'],
  ['Creada', 'Created'],
  ['Creadas', 'Created'],
  ['Nombre de la tarifa', 'Rate name'],
  ['Creando desde tarifa importada', 'Creating from imported rate'],
  ['Complete los datos ausentes de la importación', 'Complete the missing import data'],
  ['La importación no coincide completamente con Config', 'The import does not fully match Config'],
  ['Ruta y responsables', 'Route and stakeholders'],
  [
    'Todos los valores provienen de catálogos para evitar datos inconsistentes.',
    'All values come from catalogs to prevent inconsistent data.',
  ],
  ['Vigencia y moneda', 'Validity and currency'],
  [
    'La vigencia se valida antes de enviar la tarifa.',
    'Validity is checked before submitting the rate.',
  ],
  ['Datos y condiciones comerciales', 'Commercial data and conditions'],
  [
    'Identificadores del cliente y condiciones que se mostrarán en la cotización.',
    'Customer identifiers and conditions shown in the quotation.',
  ],
  ['Construcción de la tarifa', 'Rate construction'],
  [
    'Costo, venta y utilidad visibles por rubro. El flete marítimo y terrestre se calcula por contenedor.',
    'Cost, sale and profit are visible for each line. Ocean and inland freight are calculated per container.',
  ],
  ['Automático', 'Automatic'],
  ['Nota operativa:', 'Operational note:'],
  ['Sin rubros en esta sección.', 'No line items in this section.'],
  ['Costo total', 'Total cost'],
  ['Venta total', 'Total sale'],
  ['Utilidad general', 'Total profit'],
  ['Margen actual / esperado', 'Current / expected margin'],
  ['Agente', 'Agent'],
  ['Seleccione agente', 'Select agent'],
  ['Naviera', 'Carrier'],
  ['Seleccione naviera', 'Select carrier'],
  ['Contenedor', 'Container'],
  ['Seleccione contenedor', 'Select container'],
  ['POL · Origen', 'POL · Origin'],
  ['Seleccione POL', 'Select POL'],
  ['POE · Entrada', 'POE · Entry'],
  ['Seleccione POE', 'Select POE'],
  ['POD · Destino final', 'POD · Final destination'],
  ['Seleccione POD', 'Select POD'],
  ['Moneda', 'Currency'],
  ['Seleccione moneda', 'Select currency'],
  ['Días libres', 'Free days'],
  ['Válida desde', 'Valid from'],
  ['Válida hasta', 'Valid to'],
  ['Cliente', 'Customer'],
  ['Nombre del cliente', 'Customer name'],
  ['Cantidad de contenedores', 'Container quantity'],
  ['Tiempo de tránsito (días)', 'Transit time (days)'],
  ['Tarifa incluye', 'Rate includes'],
  ['Sujeto a', 'Subject to'],
  ['No incluye', 'Excludes'],
  ['Rubro manual', 'Manual line item'],
  ['Concepto', 'Item'],
  ['Nombre del rubro', 'Line item name'],
  ['Valor fijo del dashboard', 'Fixed dashboard value'],
  ['Rubro', 'Line item'],
  ['Costo', 'Cost'],
  ['Venta', 'Sale'],
  ['Quitar rubro', 'Remove line item'],
  ['Aplicación', 'Application'],
  ['Notas', 'Notes'],
  ['Costos opcionales', 'Optional costs'],
  ['Seleccione costos opcionales', 'Select optional costs'],
  ['Crear tarifa', 'Create rate'],
  ['Autorización requerida', 'Authorization required'],
  ['El margen está por debajo del 12% esperado.', 'The margin is below the expected 12%.'],
  ['Vigencia · Días libres', 'Validity · Free days'],
  ['Contenedores', 'Containers'],
  ['Tiempo de tránsito', 'Transit time'],
  ['Estado comercial', 'Commercial status'],
  ['Cantidad', 'Quantity'],
  ['Desde importación', 'From import'],
  ['Imprimir', 'Print'],
  ['Duplicar', 'Duplicate'],
  ['Marcar enviada', 'Mark as sent'],
  ['Solicitada por cliente', 'Requested by client'],
  ['Solicitada por el cliente', 'Requested by the client'],
  ['Solicitadas por el cliente', 'Requested by the client'],
  ['Cerrada', 'Closed'],
  ['Cerradas', 'Closed'],
  ['El motivo del cierre quedó registrado.', 'The closure reason was recorded.'],
  ['No se pudo cerrar la tarifa.', 'The rate could not be closed.'],
  ['Explique por qué se cerró la tarifa...', 'Explain why the rate was closed...'],
  ['El motivo es obligatorio.', 'The reason is required.'],
  ['Cerrar tarifa', 'Close rate'],
  ['Motivo del cierre', 'Closure reason'],
  ['Tarifa cerrada', 'Closed rate'],
  ['Aceptada por cliente', 'Accepted by customer'],
  ['Rechazada por cliente', 'Rejected by customer'],
  ['Aprobar margen', 'Approve margin'],
  ['En objetivo', 'On target'],
  ['Bajo', 'Low'],
  ['Cargando datos para revisión...', 'Loading review data...'],
  ['Estado de la tarifa', 'Rate status'],
  [
    'Todos los datos obligatorios están listos para guardar y aprobar.',
    'All required data is ready to save and approve.',
  ],
  ['1. Clasificación comercial', '1. Commercial classification'],
  [
    'Identifique quién ofrece la tarifa y para qué tipo de importación aplica.',
    'Identify who offers the rate and which import type it applies to.',
  ],
  ['2. Ruta', '2. Route'],
  [
    'Confirme la secuencia POL → POE → POD. El POE debe existir en Config para aprobar.',
    'Confirm the POL → POE → POD sequence. The POE must exist in Config before approval.',
  ],
  ['3. Valores y condiciones', '3. Values and conditions'],
  [
    'Revise el flete y los cargos detectados. Los campos en cero son válidos.',
    'Review the detected freight and charges. Zero values are valid.',
  ],
  ['Costo total calculado', 'Calculated total cost'],
  ['4. Vigencia y auditoría', '4. Validity and audit'],
  [
    'Defina la vigencia comercial y documente cualquier corrección manual.',
    'Define commercial validity and document any manual correction.',
  ],
  [
    'Puede guardar el avance, pero complete los campos marcados antes de aprobar.',
    'You may save progress, but complete the marked fields before approval.',
  ],
  ['La tarifa está lista para guardarse y aprobarse.', 'The rate is ready to save and approve.'],
  ['Perfil de importación *', 'Import profile *'],
  ['Agente *', 'Agent *'],
  ['Naviera *', 'Carrier *'],
  ['Contenedor *', 'Container *'],
  ['POL · Puerto de origen *', 'POL · Origin port *'],
  ['POE · Puerto de entrada *', 'POE · Entry port *'],
  ['POD · Destino final *', 'POD · Final destination *'],
  ['Moneda *', 'Currency *'],
  ['Flete internacional *', 'International freight *'],
  ['Cargos de origen *', 'Origin charges *'],
  ['Cargos de destino *', 'Destination charges *'],
  ['Recargos *', 'Surcharges *'],
  ['Venta opcional', 'Optional sale'],
  ['Días libres *', 'Free days *'],
  ['Días de tránsito', 'Transit days'],
  ['Vigente desde *', 'Valid from *'],
  ['Vigente hasta *', 'Valid to *'],
  ['Mercancía / condición comercial', 'Commodity / commercial condition'],
  ['Notas de revisión para auditoría', 'Review notes for audit'],
  ['Guardar y aprobar', 'Save and approve'],
  ['Identificación del costo', 'Cost identification'],
  [
    'Defina cómo se aplicará este rubro al construir una tarifa.',
    'Define how this line item will apply when building a rate.',
  ],
  ['Relaciones operativas', 'Operational relationships'],
  [
    'Los selects guardan el identificador y su snapshot para conservar el histórico.',
    'Selects store the identifier and snapshot to preserve history.',
  ],
  [
    'El costo se agregará automáticamente cuando coincidan las relaciones configuradas. Puede ser global, solo por puerto, solo por naviera/agente o combinar ambas condiciones.',
    'The cost will be added automatically when configured relationships match. It may be global, port-only, carrier/agent-only or combine both conditions.',
  ],
  [
    'Este rubro aparecerá en el selector múltiple al construir o editar una tarifa.',
    'This line item will appear in the multi-select when building or editing a rate.',
  ],
  [
    'Este rubro queda disponible como plantilla ajustable para la cotización.',
    'This line item remains available as an adjustable quotation template.',
  ],
  ['Utilidad del rubro', 'Line item profit'],
  ['THC, handling, BL...', 'THC, handling, BL...'],
  ['Punto de aplicación', 'Application point'],
  ['Sin puerto específico', 'No specific port'],
  ['Costo asociado a', 'Cost associated with'],
  ['Seleccione puerto', 'Select port'],
  ['Costo contable por contenedor', 'Accounting cost per container'],
  ['Cargando detalle del correo...', 'Loading email details...'],
  ['Recibido', 'Received'],
  ['Destinatarios', 'Recipients'],
  ['Resultado de clasificación', 'Classification result'],
  ['Adjuntos', 'Attachments'],
  [
    'El correo se procesó desde su cuerpo; no contiene adjuntos registrados.',
    'The email was processed from its body and has no registered attachments.',
  ],
  ['Seguimiento de extracción y Pricing', 'Extraction and Pricing tracking'],
  ['Aún no hay trabajos de extracción asociados.', 'There are no associated extraction jobs yet.'],
  ['Vista previa del correo', 'Email preview'],
  ['Ver revisión', 'View review'],
  ['Creando revisión...', 'Creating review...'],
  ['Revisar en Pricing', 'Review in Pricing'],
  ['Volver a extraer', 'Extract again'],
  ['Cuerpo del correo', 'Email body'],
  ['Adjunto', 'Attachment'],
  ['Ver en Pricing', 'View in Pricing'],
  ['Enviar a revisión', 'Send to review'],
  ['Cargando todos los datos de la tarifa...', 'Loading all rate data...'],
  ['POE no asignado', 'POE not assigned'],
  [
    'El POE detectado no existe como referencia válida en Config. La importación no puede aprobarse hasta asignar manualmente un POE real.',
    'The detected POE does not exist as a valid Config reference. The import cannot be approved until a real POE is assigned manually.',
  ],
  ['Valores importados', 'Imported values'],
  ['Venta importada', 'Imported sale'],
  ['Revise antes de aprobar', 'Review before approval'],
  ['El POE aparece como', 'The POE appears as'],
  ['No asignado', 'Not assigned'],
  ['Aprobar tarifa', 'Approve rate'],
  ['Crear tarifa oficial', 'Create official rate'],
  ['Asignar POE manualmente', 'Assign POE manually'],
  ['Seleccione un POE de Config', 'Select a Config POE'],
  ['Asignar POE', 'Assign POE'],
  ['Recomendación de IA', 'AI recommendation'],
  ['No fue posible completar el análisis', 'The analysis could not be completed'],
  [
    'El BackgroundTask está analizando la información.',
    'The background task is analyzing the information.',
  ],
  ['Esta ventana se actualizará automáticamente.', 'This window will update automatically.'],
  ['Solicitado', 'Requested'],
  ['Finalizado', 'Completed'],
  ['Ejecución IA auditada', 'Audited AI execution'],
  ['Análisis de correo', 'Email analysis'],
  ['Análisis del panel', 'Panel analysis'],
  [
    'PDF, Excel, CSV o imagen. El archivo se valida antes de crear registros.',
    'PDF, Excel, CSV or image. The file is validated before records are created.',
  ],
  ['Seleccione un archivo.', 'Select a file.'],
  ['Resultado de la extracción', 'Extraction result'],
  ['Filas', 'Rows'],
  ['Advertencias', 'Warnings'],
  ['Inválidas', 'Invalid'],
  ['Extraer tarifas', 'Extract rates'],
  [
    'Indique un motivo claro. Esta información queda disponible para auditoría y seguimiento operativo.',
    'Provide a clear reason. This information remains available for audit and operational tracking.',
  ],
  ['Explique por qué se rechaza...', 'Explain why it is rejected...'],
  [
    'Se copiarán la ruta, los rubros, costos y ventas. Defina la vigencia de la nueva tarifa.',
    'The route, line items, costs and sales will be copied. Define the new rate validity.',
  ],
  ['Duplicar tarifa', 'Duplicate rate'],
  ['Buscar costo...', 'Search cost...'],
  ['Nota operativa:', 'Operational note:'],
  ['Run ID', 'ID de ejecución'],
  ['Rate Candidate ID', 'ID de tarifa candidata'],
  ['Actualizar', 'Update'],
  ['Enviar', 'Send'],
  ['Filtrar...', 'Filter...'],
  ['ID externo', 'External ID'],
  ['Intentos y fallback', 'Attempts and fallback'],
  [
    'La referencia secreta debe apuntar a la clave configurada en el entorno del servicio. No escriba la API key directamente.',
    'The secret reference must point to the key configured in the service environment. Do not enter the API key directly.',
  ],
  ['Máximo de salida', 'Maximum output'],
  ['No hay intentos registrados.', 'No attempts recorded.'],
  ['Nombre visible', 'Display name'],
  ['Número', 'Number'],
  ['Número IDTRA', 'IDTRA number'],
  ['Número QUO', 'QUO number'],
  [
    'Solo se muestran las acciones permitidas por sus scopes.',
    'Only actions allowed by your scopes are shown.',
  ],
  [
    'Solo se puede asignar o revocar según los scopes del usuario actual.',
    'Assignment or revocation is allowed only according to the current user scopes.',
  ],
  ['Sí / No', 'Yes / No'],
  ['Texto', 'Text'],
  ['Usuario', 'User'],
  ['Sesión activa', 'Active session'],
  ['Abrir revisión', 'Open review'],
  ['Aceptada por el cliente', 'Accepted by the customer'],
  ['Aceptadas por el cliente', 'Accepted by the customer'],
  [
    'Administre accesos de usuarios internos y externos.',
    'Manage access for internal and external users.',
  ],
  [
    'Administre las tarifas finales disponibles para cotizar y operar.',
    'Manage final rates available for quoting and operations.',
  ],
  ['Agentes o proveedores asociados a una tarifa.', 'Agents or providers associated with a rate.'],
  ['Aplicar revisión de tarifa', 'Apply rate review'],
  ['Aprobación', 'Approval'],
  ['Aprobar y crear tarifa final', 'Approve and create final rate'],
  [
    'Apruebe la importación antes de convertirla en tarifa.',
    'Approve the import before converting it into a rate.',
  ],
  ['Archivo anterior a Storage', 'File created before Storage'],
  ['Archivo procesado', 'File processed'],
  ['Archivos y adjuntos', 'Files and attachments'],
  ['Arrastre o seleccione el tarifario', 'Drag or select the rate sheet'],
  ['Asigne al menos un modelo al perfil.', 'Assign at least one model to the profile.'],
  [
    'Asigne catálogos, corrija rutas y apruebe los registros completos.',
    'Assign catalogs, correct routes and approve complete records.',
  ],
  ['Asunto o remitente', 'Subject or sender'],
  ['Atajos configurables en el navegador.', 'Browser-configurable shortcuts.'],
  ['Bloquear usuario', 'Lock user'],
  ['Buscar IDTRA', 'Search IDTRA'],
  ['Buscar QUO', 'Search QUO'],
  [
    'Cambie la vía, el contenedor o el rango de fechas para encontrar tarifas importadas vigentes.',
    'Change the route, container or date range to find valid imported rates.',
  ],
  ['Cargando información', 'Loading information'],
  ['Cargo en destino', 'Destination charge'],
  ['Cargo en origen', 'Origin charge'],
  ['Cargos de destino', 'Destination charges'],
  ['Cargos de origen', 'Origin charges'],
  ['Catálogo para selects', 'Catalog for selects'],
  [
    'Compare opciones por ruta y convierta la elegida en una tarifa final.',
    'Compare route options and convert the selected one into a final rate.',
  ],
  [
    'Compare rutas y elija la opción comercial.',
    'Compare routes and choose the commercial option.',
  ],
  [
    'Complete catálogos, rutas, montos y vigencia.',
    'Complete catalogs, routes, amounts and validity.',
  ],
  [
    'Complete los datos pendientes, apruebe el lote y continúe hacia la decisión comercial.',
    'Complete pending data, approve the batch and continue to the commercial decision.',
  ],
  [
    'Complete únicamente los datos señalados y apruebe las filas listas. No se vuelve a ejecutar la extracción.',
    'Complete only the indicated data and approve ready rows. Extraction will not run again.',
  ],
  ['Condiciones, alcance o evidencia del costo...', 'Conditions, scope or cost evidence...'],
  ['Conexión activada', 'Connection activated'],
  ['Conexión con errores', 'Connection with errors'],
  ['Conexión desactivada', 'Connection deactivated'],
  ['Conexión guardada', 'Connection saved'],
  ['Conexión saludable', 'Healthy connection'],
  [
    'Conexión, identificador externo y nombre son obligatorios.',
    'Connection, external identifier and name are required.',
  ],
  [
    'Confirme qué recibió DataExtraction y atienda errores o resultados por revisar.',
    'Confirm what DataExtraction received and address errors or results requiring review.',
  ],
  [
    'Construya y revise tarifas FCL con costo, venta, utilidad y margen en una sola vista.',
    'Build and review FCL rates with cost, sale, profit and margin in one view.',
  ],
  [
    'Consulte correos, PDF, imágenes y archivos importados.',
    'Browse emails, PDFs, images and imported files.',
  ],
  [
    'Consulte el asistente de inteligencia artificial.',
    'Use the artificial intelligence assistant.',
  ],
  ['Consulte los scopes disponibles.', 'Browse available scopes.'],
  ['Consulte y gestione las tarifas finales.', 'Browse and manage final rates.'],
  ['Contenedor sin coincidencia', 'Container not matched'],
  ['Contraseña actualizada', 'Password updated'],
  ['Contraseña requerida', 'Password required'],
  ['Controle sesiones y dispositivos activos.', 'Control active sessions and devices.'],
  ['Convertida en tarifa', 'Converted into a rate'],
  ['Corregir y aprobar', 'Correct and approve'],
  ['Correo enviado a reproceso', 'Email sent for reprocessing'],
  ['Correos y archivos', 'Emails and files'],
  ['Costo activado', 'Cost activated'],
  ['Costo actualizado', 'Cost updated'],
  ['Costo agente', 'Agent cost'],
  ['Costo creado', 'Cost created'],
  ['Costo de agente', 'Agent cost'],
  ['Costo de la vía', 'Route cost'],
  ['Costo del flete', 'Freight cost'],
  ['Costo eliminado', 'Cost deleted'],
  ['Costo inactivado', 'Cost deactivated'],
  ['Costo opcional', 'Optional cost'],
  ['Costo y venta marítima', 'Ocean cost and sale'],
  ['Costo y venta marítima.', 'Ocean cost and sale.'],
  ['Costos de agente', 'Agent costs'],
  ['Costos de destino', 'Destination costs'],
  ['Creando revisión', 'Creating review'],
  ['Creando revisión en Pricing', 'Creating review in Pricing'],
  ['Crear revisión', 'Create review'],
  ['Crear tarifa final', 'Create final rate'],
  ['Cuenta de correo', 'Email account'],
  ['Datos incompletos', 'Incomplete data'],
  ['Debe estar entre 1 y 3600 segundos.', 'Must be between 1 and 3600 seconds.'],
  ['Decisión comercial', 'Commercial decision'],
  ['Decisión tarifaria', 'Rate decision'],
  ['Decisión → cotización final', 'Decision → final quotation'],
  ['Detalle de tarifa importada', 'Imported rate details'],
  ['Detalle del correo de tarifas', 'Rate email details'],
  ['Editar tarifa', 'Edit rate'],
  [
    'Ejecute una prueba para ver el contenido, modelo elegido, tokens, costo y duración.',
    'Run a test to see the content, selected model, tokens, cost and duration.',
  ],
  ['El asistente no pudo responder la consulta.', 'The assistant could not answer the request.'],
  [
    'El enrutamiento ya puede utilizarse desde el Playground y las integraciones.',
    'Routing can now be used from the Playground and integrations.',
  ],
  ['El flete es obligatorio.', 'Freight is required.'],
  [
    'El lote continúa creándose. Cuando termine aparecerá el botón “Ver en Pricing”.',
    'The batch is still being created. When it finishes, the “View in Pricing” button will appear.',
  ],
  [
    'El margen actual es inferior al 12% y debe revisarlo una persona autorizada.',
    'The current margin is below 12% and must be reviewed by an authorized person.',
  ],
  [
    'El modelo ya está disponible para asignarlo a perfiles.',
    'The model is now available to assign to profiles.',
  ],
  ['El máximo de tokens debe ser mayor que cero.', 'Maximum tokens must be greater than zero.'],
  [
    'El POE quedó validado contra Config y la importación ya puede aprobarse.',
    'The POE was validated against Config and the import can now be approved.',
  ],
  ['El proveedor no respondió correctamente.', 'The provider did not respond correctly.'],
  ['Eliminar importaciones', 'Delete imports'],
  ['Eliminar tarifas', 'Delete rates'],
  ['En cola', 'Queued'],
  [
    'Escriba el mensaje o los textos que desea procesar.',
    'Enter the message or text you want to process.',
  ],
  ['Escriba la solicitud que desea probar', 'Enter the request you want to test'],
  [
    'Escriba una consulta para el asistente general de Dhole.',
    'Enter a request for Dhole’s general assistant.',
  ],
  ['La tarifa fue actualizada.', 'The rate was updated.'],
  ['Modelo activado', 'Model activated'],
  ['Modelo desactivado', 'Model deactivated'],
  ['Modelo guardado', 'Model saved'],
  ['Modelo requerido', 'Model required'],
  ['Naviera sin coincidencia', 'Carrier not matched'],
  ['No se pudo cambiar la contraseña.', 'Could not change the password.'],
  ['No se pudo cargar el análisis de IA.', 'Could not load the AI analysis.'],
  ['No se pudo cargar el contenido del archivo.', 'Could not load the file content.'],
  [
    'No se pudo cargar el dashboard para toma de decisiones.',
    'Could not load the decision dashboard.',
  ],
  ['No se pudo cargar el detalle de la ejecución.', 'Could not load the execution details.'],
  [
    'No se pudo cargar el detalle de la tarifa importada.',
    'Could not load the imported rate details.',
  ],
  ['No se pudo cargar el detalle del correo.', 'Could not load the email details.'],
  ['No se pudo cargar el detalle del usuario.', 'Could not load the user details.'],
  ['No se pudo cargar el lote para revisión.', 'Could not load the review batch.'],
  ['No se pudo cargar el modelo.', 'Could not load the model.'],
  ['No se pudo cargar el panel de Storage.', 'Could not load the Storage panel.'],
  ['No se pudo cargar el perfil.', 'Could not load the profile.'],
  ['No se pudo cargar la bandeja de correos.', 'Could not load the email inbox.'],
  ['No se pudo cargar la conexión.', 'Could not load the connection.'],
  [
    'No se pudo cargar la consola de inteligencia artificial.',
    'Could not load the artificial intelligence console.',
  ],
  ['No se pudo cargar la plantilla.', 'Could not load the template.'],
  [
    'No se pudo cargar la tarifa importada seleccionada.',
    'Could not load the selected imported rate.',
  ],
  ['No se pudo completar el rechazo.', 'Could not complete the rejection.'],
  ['No se pudo completar la acción.', 'Could not complete the action.'],
  ['No se pudo crear el rol.', 'Could not create the role.'],
  ['No se pudo crear la revisión en Pricing.', 'Could not create the review in Pricing.'],
  ['No se pudo descargar el adjunto.', 'Could not download the attachment.'],
  ['No se pudo descargar el archivo.', 'Could not download the file.'],
  ['No se pudo ejecutar la prueba de IA.', 'Could not run the AI test.'],
  ['No se pudo eliminar el archivo.', 'Could not delete the file.'],
  ['No se pudo eliminar el registro.', 'Could not delete the record.'],
  ['No se pudo guardar el modelo de IA.', 'Could not save the AI model.'],
  ['No se pudo guardar el perfil de IA.', 'Could not save the AI profile.'],
  ['No se pudo guardar el rol.', 'Could not save the role.'],
  ['No se pudo guardar el usuario.', 'Could not save the user.'],
  ['No se pudo guardar la conexión de IA.', 'Could not save the AI connection.'],
  ['No se pudo guardar la plantilla de prompt.', 'Could not save the prompt template.'],
  [
    'No se pudo obtener una respuesta del asistente.',
    'Could not get a response from the assistant.',
  ],
  [
    'No se pudo preparar la creación de la tarifa final.',
    'Could not prepare creation of the final rate.',
  ],
  ['No se pudo preparar la pantalla de revisión.', 'Could not prepare the review screen.'],
  ['No se pudo probar la conexión.', 'Could not test the connection.'],
  ['No se pudo refrescar el token.', 'Could not refresh the token.'],
  ['No se pudo reprocesar el correo.', 'Could not reprocess the email.'],
  [
    'No tiene permiso para guardar este catálogo.',
    'You do not have permission to save this catalog.',
  ],
  ['No tiene permiso para guardar este item.', 'You do not have permission to save this item.'],
  ['No tiene permiso para guardar este rol.', 'You do not have permission to save this role.'],
  ['No tiene permiso para guardar este usuario.', 'You do not have permission to save this user.'],
  ['Nombre y URL base son obligatorios.', 'Name and base URL are required.'],
  ['Nombre, key o descripción', 'Name, key or description'],
  ['Nombre, key o enrutamiento', 'Name, key or routing'],
  ['Nombre, proveedor o URL', 'Name, provider or URL'],
  ['Nueva conexión', 'New connection'],
  ['Nueva conexión de IA', 'New AI connection'],
  ['Nueva plantilla de prompt', 'New prompt template'],
  ['Nuevo perfil', 'New profile'],
  ['Nuevo perfil de IA', 'New AI profile'],
  [
    'Opcional: instrucciones adicionales para esta prueba',
    'Optional: additional instructions for this test',
  ],
  ['Organice permisos por rol.', 'Organize permissions by role.'],
  [
    'Origen, documentación, seguro y adicionales.',
    'Origin, documentation, insurance and additional charges.',
  ],
  [
    'Origen, puerto de salida y destino para decisiones y tarifas FCL.',
    'Origin, exit port and destination for FCL decisions and rates.',
  ],
  ['Pendiente de aprobación', 'Pending approval'],
  ['Pendiente de revisión', 'Pending review'],
  ['Pendientes de autorización', 'Pending authorization'],
  ['Perfil activado', 'Profile activated'],
  ['Perfil desactivado', 'Profile deactivated'],
  ['Perfil guardado', 'Profile saved'],
  [
    'Perfil que usa DataExtraction al leer PDF, Excel o CSV.',
    'Profile used by DataExtraction when reading PDF, Excel or CSV.',
  ],
  ['Perfil requerido', 'Profile required'],
  ['Perfil, modelo, proveedor o estado', 'Profile, model, provider or status'],
  ['Perfiles de extracción', 'Extraction profiles'],
  [
    'Permita ventanas emergentes para generar la cotización rápida.',
    'Allow pop-ups to generate the quick quotation.',
  ],
  ['POD sin coincidencia', 'POD not matched'],
  ['POE sin coincidencia', 'POE not matched'],
  ['POE · Puerto de entrada', 'POE · Entry port'],
  ['POE, POD y transporte interno', 'POE, POD and inland transport'],
  ['POE, POD y transporte interno.', 'POE, POD and inland transport.'],
  ['POL sin coincidencia', 'POL not matched'],
  ['POL · Puerto de origen', 'POL · Origin port'],
  ['Por asignar', 'To be assigned'],
  ['por asignar', 'to be assigned'],
  ['Por revisar', 'Needs review'],
  [
    'Prioriza este modelo en perfiles configurados con LocalFirst.',
    'Prioritizes this model in profiles configured with LocalFirst.',
  ],
  ['Probar conexión', 'Test connection'],
  ['Procesando con AI', 'Processing with AI'],
  [
    'Puertos, contenedores, navieras, incoterms y catálogos usados por Pricing.',
    'Ports, containers, carriers, incoterms and catalogs used by Pricing.',
  ],
  [
    'Puertos, navieras, agentes, monedas y equipos.',
    'Ports, carriers, agents, currencies and equipment.',
  ],
  ['Rechazada por el cliente', 'Rejected by the customer'],
  ['Rechazadas por el cliente', 'Rejected by the customer'],
  ['Rechazar importaciones', 'Reject imports'],
  ['Recibir y extraer', 'Receive and extract'],
  ['Registrar modelo', 'Register model'],
  ['Remitente sin nombre', 'Unnamed sender'],
  ['Requieren aprobación', 'Require approval'],
  ['Revisar correos y archivos', 'Review emails and files'],
  [
    'Revise acciones, cambios y ejecuciones del sistema.',
    'Review system actions, changes and executions.',
  ],
  ['Revise correos y archivos detectados.', 'Review detected emails and files.'],
  [
    'Revise el detalle del error antes de volver a ejecutar la extracción.',
    'Review the error details before running extraction again.',
  ],
  [
    'Revise salud y disponibilidad de todos los servicios.',
    'Review the health and availability of all services.',
  ],
  ['Revisión aplicada', 'Review applied'],
  ['Revisión creada', 'Review created'],
  ['Revisión en proceso', 'Review in progress'],
  ['Revisión guardada', 'Review saved'],
  ['Revisión pendiente', 'Review pending'],
  ['Revocar sesiones del usuario', 'Revoke user sessions'],
  ['Rol guardado correctamente.', 'Role saved successfully.'],
  ['Scopes asignados al rol', 'Scopes assigned to the role'],
  ['Scopes revocados del rol', 'Scopes revoked from the role'],
  [
    'Se crearon nuevos trabajos de extracción. La bandeja se actualizará automáticamente.',
    'New extraction jobs were created. The inbox will update automatically.',
  ],
  [
    'Selecciona todos los registros visibles en esta página.',
    'Selects all records visible on this page.',
  ],
  ['Seleccione al menos una capacidad del modelo.', 'Select at least one model capability.'],
  ['Seleccione el agente.', 'Select the agent.'],
  ['Seleccione el contenedor.', 'Select the container.'],
  ['Seleccione el perfil.', 'Select the profile.'],
  ['Seleccione el POD.', 'Select the POD.'],
  ['Seleccione el POE.', 'Select the POE.'],
  ['Seleccione el POL.', 'Select the POL.'],
]

function flatten(
  tree: MessageTree,
  prefix = '',
  result = new Map<string, string>(),
): Map<string, string> {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') result.set(path, value)
    else if (value && typeof value === 'object') flatten(value as MessageTree, path, result)
  }
  return result
}

const esMessages = flatten(es as MessageTree)
const enMessages = flatten(en as MessageTree)
const esToEn = new Map<string, string>()
const enToEs = new Map<string, string>()

for (const [key, spanish] of esMessages) {
  const english = enMessages.get(key)
  if (!english) continue
  esToEn.set(spanish, english)
  enToEs.set(english, spanish)
}

for (const [spanish, english] of legacyPairs) {
  esToEn.set(spanish, english)
  enToEs.set(english, spanish)
}

function preserveWhitespace(source: string, translated: string): string {
  const leading = source.match(/^\s*/)?.[0] ?? ''
  const trailing = source.match(/\s*$/)?.[0] ?? ''
  return `${leading}${translated}${trailing}`
}

function translateDynamic(value: string, locale: LocaleCode): string | null {
  const rules: Array<
    [RegExp, (match: RegExpMatchArray) => string, (match: RegExpMatchArray) => string]
  > = [
    [/^(\d+(?:[.,]\d+)?)% confianza$/, (m) => `${m[1]}% confianza`, (m) => `${m[1]}% confidence`],
    [/^(\d+) disponibles$/, (m) => `${m[1]} disponibles`, (m) => `${m[1]} available`],
    [/^Aprobar \((\d+)\)$/, (m) => `Aprobar (${m[1]})`, (m) => `Approve (${m[1]})`],
    [/^Rechazar \((\d+)\)$/, (m) => `Rechazar (${m[1]})`, (m) => `Reject (${m[1]})`],
    [
      /^Aprobar listas \((\d+)\)$/,
      (m) => `Aprobar listas (${m[1]})`,
      (m) => `Approve ready (${m[1]})`,
    ],
    [
      /^Por contenedor × (.+)$/,
      (m) => `Por contenedor × ${m[1]}`,
      (m) => `Per container × ${m[1]}`,
    ],
    [/^Perfil activo: (.+)$/, (m) => `Perfil activo: ${m[1]}`, (m) => `Active profile: ${m[1]}`],
    [
      /^Página (\d+) de (\d+)$/,
      (m) => `Página ${m[1]} de ${m[2]}`,
      (m) => `Page ${m[1]} of ${m[2]}`,
    ],
  ]

  for (const [pattern, spanish, english] of rules) {
    const match = value.match(pattern)
    if (match) return locale === 'es' ? spanish(match) : english(match)
  }

  return null
}

export function translateUiText(source: string, locale: LocaleCode): string {
  const trimmed = source.trim()
  if (!trimmed) return source

  const direct = locale === 'es' ? enToEs.get(trimmed) : esToEn.get(trimmed)
  if (direct) return preserveWhitespace(source, direct)

  const dynamic = translateDynamic(trimmed, locale)
  return dynamic ? preserveWhitespace(source, dynamic) : source
}

export function createUiTextBridge(getLocale: () => LocaleCode) {
  const textStates = new WeakMap<Text, TextState>()
  const attributeStates = new WeakMap<Element, Map<string, TextState>>()
  const translatableAttributes = ['placeholder', 'title', 'aria-label', 'alt']

  function shouldSkip(element: Element | null): boolean {
    if (!element) return false
    return Boolean(
      element.closest(
        'script, style, code, pre, [data-no-auto-translate], [contenteditable="true"]',
      ),
    )
  }

  function processText(node: Text) {
    if (shouldSkip(node.parentElement)) return

    const current = node.nodeValue ?? ''
    let state = textStates.get(node)

    if (!state || current !== state.applied) {
      state = { source: current, applied: current }
      textStates.set(node, state)
    }

    const translated = translateUiText(state.source, getLocale())
    if (translated !== current) node.nodeValue = translated
    state.applied = translated
  }

  function processAttributes(element: Element) {
    if (shouldSkip(element)) return

    let states = attributeStates.get(element)
    if (!states) {
      states = new Map<string, TextState>()
      attributeStates.set(element, states)
    }

    for (const attribute of translatableAttributes) {
      if (!element.hasAttribute(attribute)) continue
      const current = element.getAttribute(attribute) ?? ''
      let state = states.get(attribute)

      if (!state || current !== state.applied) {
        state = { source: current, applied: current }
        states.set(attribute, state)
      }

      const translated = translateUiText(state.source, getLocale())
      if (translated !== current) element.setAttribute(attribute, translated)
      state.applied = translated
    }
  }

  function process(root: Node) {
    if (root.nodeType === Node.TEXT_NODE) {
      processText(root as Text)
      return
    }

    if (
      !(root instanceof Element) &&
      !(root instanceof DocumentFragment) &&
      !(root instanceof Document)
    )
      return
    if (root instanceof Element) processAttributes(root)

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
    let current = walker.nextNode()
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) processText(current as Text)
      else processAttributes(current as Element)
      current = walker.nextNode()
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') process(mutation.target)
      if (mutation.type === 'attributes') processAttributes(mutation.target as Element)
      for (const node of mutation.addedNodes) process(node)
    }
  })

  return {
    start(root: Node = document.body) {
      process(root)
      observer.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: translatableAttributes,
      })
    },
    refresh(root: Node = document.body) {
      process(root)
    },
    stop() {
      observer.disconnect()
    },
  }
}
