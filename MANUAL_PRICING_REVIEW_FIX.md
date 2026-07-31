# Revisión de correos en Pricing

Los correos con extracción utilizable en estado `NeedsReview` muestran ahora dos acciones distintas:

- `Revisar en Pricing`: reutiliza las filas ya extraídas y crea una importación pendiente para editar, asignar catálogos, aprobar o rechazar.
- `Volver a extraer`: descarta el resultado actual y ejecuta de nuevo la extracción.

El Web espera brevemente la creación del lote y lo abre automáticamente. Si Pricing tarda más, el detalle muestra `Creando revisión...` y luego `Ver revisión`.
