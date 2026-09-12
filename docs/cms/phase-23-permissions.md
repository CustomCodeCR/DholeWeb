# FASE 23 — Permisos de Mercadeo

DholeWeb registra los 14 scopes granulares de Mercadeo definidos por FASE 23 y conserva todos los scopes CMS históricos.

La entrada principal de Mercadeo continúa usando `cms.view` porque el rol `Mercadeo` creado por Auth recibe los scopes `cms.*`, incluido el scope base. Los permisos granulares quedan disponibles para controles de acciones y para roles personalizados sin cambiar el contrato legacy.

ContentService es la autoridad final de autorización y acepta los scopes específicos de FASE 23 con compatibilidad hacia los scopes históricos correspondientes.
