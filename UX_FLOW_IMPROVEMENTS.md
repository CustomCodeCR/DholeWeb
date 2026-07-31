# Mejoras de UX del flujo de Pricing

## Flujo principal

El frontend presenta el proceso en cuatro pasos consistentes:

1. Bandeja de correos: recepción, extracción y errores.
2. Revisión de importaciones: corrección de datos y aprobación.
3. Selección de alternativa: comparación y decisión comercial.
4. Tarifas oficiales: consulta y gestión de tarifas finales.

## Cambios principales

- El menú lateral coloca la operación de Pricing antes de configuración y seguridad.
- Las opciones de Pricing están numeradas según el orden real de trabajo.
- El dashboard separa la operación diaria de las herramientas administrativas.
- Las pantallas principales muestran una guía de progreso reutilizable.
- La bandeja indica explícitamente la siguiente acción pendiente.
- Las acciones dejaron de depender de iconos sin texto.
- La revisión de importaciones incluye filtros rápidos por estado y resumen de pendientes.
- La revisión por lote muestra progreso, datos faltantes y aprobación masiva de filas completas.
- El formulario de revisión está dividido en clasificación, ruta, valores y vigencia.
- Los botones para guardar y aprobar permanecen visibles al final del drawer.

## Validación

- `vue-tsc --noEmit`: correcto.
- `vite build`: correcto.
