# DH-405 — Auditoría Apertura Manual vs Especificación Operations v1.2

Fuente: `DholeOperations_Especificacion_v1.2_Aperturas_Origen_Multinaviera(6).md`, principalmente §§3.2, 5.3, 5.5, 5.6, 5.7, 6, 33 y 28.

## Completado / visible en la captura

| Requisito | Estado | Implementación |
| --- | --- | --- |
| Cuenta CRM obligatoria para validar | Parcial | Selector reutilizado desde Pricing; leads requieren conversión antes de guardar en Operations |
| Ejecutivo comercial responsable de CRM | UI reforzada | `pricing-client-options`, detalle de cuenta y etiquetas CRM; jamás el creador. Falta E2E con una cuenta real sin asignación |
| Modalidad/tipo de embarque/Incoterm | UI reforzada | Marítimo, aéreo y terrestre con selección visual; Multimodal no disponible en nuevas aperturas **por decisión posterior del usuario**. Históricos conservados |
| Ruta POL/POE/POD y países | Visible | Catálogos Config/Pricing, país ISO derivado; evitar forzar POE terrestre en validación posterior |
| PO/referencia y procedencia | Visible | Cliente, proveedor, agente, oficina de origen |
| Carga, cantidad de bultos y tipo | Visible | Descripción, bultos y empaques |
| Peso y volumen | Visible | KG/LB, CBM/CFT con conversiones exactas y valor original preservado en openingData |
| FCL/FTL equipos múltiples | Visible | Colección de equipos, tipos de Pricing y cantidades |
| IMO, estibable y sobrepeso | UI reforzada | Botones accesibles, IMO requiere clase y UN; sobrepeso exige observaciones para validar |
| Redestino/anticipado | UI reforzada | Botones excluyentes en muellaje de destino |
| WHS para FCA LCL/LTL | Visible | Catálogo WHS y campo obligatorio para validación |
| ETD/ETA, consolidado | Visible | ETD/ETA editables; referencia de consolidado opcional |
| Documentos | Visible | Storage por referencia, OC, Packing List, Invoice y MSDS, sin documentos binarios en PostgreSQL |
| Guardado de borrador parcial | Conservado | `completionStatus`, `missingFields`, `openingData`; sin crear ni alterar QUO |
| Contactos operativos CRM | UI reforzada | Solo contactos activos con `isOperationsContact` y email válido; selección múltiple por ID |

## Brechas que siguen abiertas (no declarar como implementadas)

1. **Divisiones CRM.** La especificación exige referencia real a una división configurada, no texto libre. El formulario conserva `crmDivisionId` histórico en modo lectura, sin permitir capturar valores arbitrarios; debe validarse el contrato real de divisiones antes de construir un selector.
2. **Procedimientos específicos por cuenta.** Deben consultarse/mostrarse desde CRM en el Resumen. No hay contrato inspeccionado que confirme esta consulta; no fabricar endpoint.
3. **Contactos y notificaciones.** La selección y persistencia como referencias en `openingData` NO equivale a registrar preferencias/destinatarios formales en Operations ni envíos por Notifications. El backend debe verificar vigencia al enviar.
4. **Servicios/recolecta, naviera/agente/merchant.** La pantalla Servicios se retiró por decisión posterior del usuario. La especificación los requiere cuando aplican; deben poder completarse en validación/Coordinación Origen con referencias SRM/Pricing y revisión comercial separada. No reintroducir una pantalla de servicios durante la apertura.
5. **Estados de completitud.** Deben existir por campo `CONFIRMADO`, `PENDIENTE_PERMITIDO`, `PENDIENTE_BLOQUEANTE`, `NO_APLICA` y su evaluación por backend según modalidad. `missingFields` de frontend no sustituye el motor de validación.
6. **Condiciones EXW/pickup.** Falta revisar captura contextual de datos de recolecta (dirección/contacto/ventana) en Origen cuando corresponda.
7. **Autorización y asignación.** Validación dual, equipos, pools, permisos y paso Origen requieren UAT autenticada en DholeOperationsService; no se infiere de estos cambios visuales.
8. **Identidad IDTRA.** El documento v1.2 usa `IDTRA-00000-000000`, mientras una definición posterior del usuario exige `IDTRA12345`; conservar la implementación vigente hasta definir reconciliación formal, sin cambiar el contador en este release.

## Criterios de aceptación del release UX

- El selector muestra tres modalidades para una apertura nueva, sin Multimodal; los expedientes históricos no pierden datos.
- Tras elegir una cuenta, el ejecutivo se muestra con el nombre real que CRM devuelve o un estado explícito de falta de asignación/etiqueta; un cambio rápido de cuenta no conserva resultados obsoletos.
- Contactos solo del cliente actual, activos, operativos y con correo; los IDs seleccionados se guardan sin envío automático.
- Condiciones y muellaje tienen estado accesible `aria-pressed` y confirmación visual. Redestino/anticipado se excluyen mutuamente.
- Borradores parciales, Equipment, CABYS, documentos, rutas, fechas, reglas incoterms y API REST existente siguen funcionales.
- CI, manifest y SemVer en Web/System; integrar a develop, staging y luego a master según autorización explícita. No desplegar producción como consecuencia de esta revisión.
