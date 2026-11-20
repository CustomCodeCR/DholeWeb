# Incoterms® 2020 — control P1–P9 de Pricing (fase 1, develop)

**Release:** DH-20261120-INCOTERMS-WIZARD-367 · **Web/System:** 1.108.0 · **PricingService:** 1.26.9, sin cambios.
**Estado:** cambios propuestos en rama intermedia; CI, merge y staging pendientes. Este archivo NO certifica aprobación ni despliegue.

## Flujo funcional que debe mantenerse

| Paso | Función | Verificación |
|---|---|---|
| P1 | Modalidad | Marítimo, aéreo, terrestre y multimodal según catálogo. |
| P2 | Tipo de embarque | FCL, LCL, FTL, LTL o aéreo compatible; conserva selección al volver. |
| P3 | Ruta/cliente/Incoterm/contenedor | POL, múltiples POE, POD, cliente CRM, operación Import/Export manual o automática, equipo y cantidad; EXW recolectas y FCA bodega. |
| P4 | Datos de carga | Descripción, bultos, dimensiones/peso, fechas, condiciones y respaldo; no borra contexto. |
| P5 | Selección de tarifa | Alternativas por POE, naviera y fuente; importe y equipo correcto. |
| P6 | Proveedor y transporte | Agente, naviera, flete, moneda, inland Merchant/Carrier y opción; memoria por alternativa. |
| P7 | Líneas de costos y venta | Mostrar Recolecta, Origen, Flete, Destino, Entrega y Seguro; consultar CostIds aplicables a POL/POE/POD, agente, naviera, servicios, modo, Incoterm, condiciones y cliente CRM. Editar precios permitidos, alternar opcionales y crear manuales con base de cobro. |
| P8 | Vista previa | Revisar por subQUO líneas, totales, IVA, margen, servicios, ruta e inclusiones antes de guardar. |
| P9 | Tarifa persistida | Ver datos de la QUO guardada y PDF generado desde las **líneas realmente persistidas**, no catálogo activo. |

## Modificaciones de esta fase

- [x] El Incoterm deja de ser un filtro destructivo de los bloques de P7; siempre aparecen cinco secciones de precio más el bloque de seguro, aun si no tienen cargos.
- [x] La carga P6→P7 exige consulta exitosa y coherente con el contexto de ruta/proveedor/cliente.
- [x] Los costes con selección múltiple de POL/POE/POD/agentes/navieras se comprueban usando los arrays del API; el identificador histórico singular es secundario.
- [x] Cambio de Incoterm mantiene direcciones EXW, recolectas y bodega FCA del borrador para recuperarlas si se vuelve a seleccionar el término.
- [x] P6↔P7 conserva ediciones de importes y estado de inclusión si el contexto de costos no cambia.
- [x] CIF/CIP advierten documentar seguro contratado y evitar duplicar la prima.
- [x] Cobertura de pruebas unitarias/de regresión añadida; ejecución pendiente.

## Validación manual obligatoria en staging

- [ ] Abrir wizard nuevo y existente sin errores de runtime de Vite, y recorrer P1–P9.
- [ ] FCL China → Caldera: escoger ONE, consultar opcionales por naviera y POE, comparar precios/cantidades con los registros reales.
- [ ] Cambiar Caldera ↔ Moín con un costo que tenga ambos POE en `poes[]`; se muestra en ambos cuando el resto del contexto coincide.
- [ ] Contrastar cargos y bases `PerContainer`, `PerShipment`, `PerDocument`, `PerTruck` con las cantidades reales.
- [ ] P6 Merchant → P7, regresar a P6 y P7: conservar selección, precio y CostId; repetir para Carrier y múltiples navieras.
- [ ] EXW: capturar más de una recolecta, cambiar Incoterm y regresar a EXW sin perder puntos.
- [ ] FCA: seleccionar bodega, cambiar a FOB y regresar a FCA sin perder bodega.
- [ ] CIF y CIP: comprobar que los seis bloques permiten cotizar un servicio contratado y que seguro/flete pagado por terceros no se factura dos veces.
- [ ] Verificar CRM preferencial con ruta, naviera, servicio e Incoterm coincidentes.
- [ ] P7→P8→guardar→P9: comparar **cada línea**, CostId, costo, venta, divisa, unidad y cantidad; luego comparar con PDF y vista reabierta.
- [ ] Revisar cálculo de IVA por POD, rentabilidad, distintas monedas, varias unidades y multi-POE/subQUO.
- [ ] Fallar expresamente la consulta de costos: no debe avanzar a P7 ni perder las líneas editadas.

## Pendientes fuera de esta fase

1. Persistir en PricingService `namedPlace`, `operationTypeSource`, rol comercial, responsables de cada cargo y estado de servicio, compatibles con históricos.
2. Validar/documentar formalmente los campos requeridos para los 11 Incoterms, incluidas evidencias de cobertura CIF/CIP, descarga DPU y despacho DDP.
3. Permitir exclusión de cualquier costo con motivo/auditoría y garantizar que el sincronizador del backend no lo reinserte.
4. Incorporar al PDF completo Incoterm con lugar, responsabilidades, seguros y los seis bloques, asegurando igualdad con RateDetails persistidos.
5. Verificar y automatizar smoke autenticado por modalidad/cliente/POE, CI semántico y versionado central.

**Política:** cambios de esta fase solo a `develop` tras CI. No promover a `master` ni desplegar producción sin nueva autorización.
