# Pantalla de revisión de tarifas

- Ruta: `/pricing/imports/review/:batchId`.
- Permite corregir catálogos, montos, vigencia, días y mercancía sin reprocesar el correo.
- `Guardar revisión` persiste cambios en Pricing.
- `Guardar y aprobar` aplica la revisión y aprueba la fila.
- Todos los cambios se registran mediante el outbox de auditoría de Pricing.
