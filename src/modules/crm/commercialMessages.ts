export const commercialMessages = {
  es: {
    crmDescription: 'Gestión de clientes, prospectos, oportunidades, actividades y seguimiento comercial.',
    integrationPending: 'La interfaz CRM está preparada, pero la integración completa todavía no está habilitada.',
    crmPending: 'El servicio CRM ya dispone del esquema inicial. Faltan desplegar las APIs comerciales, habilitar su ruta por API Gateway y asignar permisos de CRM antes de operar registros.',
    crmPermissions: 'El usuario todavía no dispone de permisos CRM. Solicite que se asignen desde Auth.',
    crmScopeNote: 'Los accesos y las operaciones están sujetos a los permisos de Auth y a las validaciones del backend.',
  },
  en: {
    crmDescription: 'Manage customers, prospects, opportunities, activities and commercial follow-ups.',
    integrationPending: 'The CRM interface is ready, but full backend integration is not enabled yet.',
    crmPending: 'The CRM service has its initial database schema. Commercial APIs, API Gateway routing and CRM permissions must be deployed before records can be managed.',
    crmPermissions: 'This user has not been granted CRM scopes yet. Request access in Auth.',
    crmScopeNote: 'Access and operations require Auth permissions and server-side authorization.',
  },
} as const
