# Changelog

## [1.3.1] - 2026-11-06

- Elimina la traducción por IA, su botón, eventos y dependencias de contenido.
- Completa traducciones ES/EN en navegación, dashboards, reportes y solicitudes de Pricing; formatos de fechas según idioma activo.
- Corrige responsive en celulares: barra de navegación, pestañas, formularios, tablas, modales y drawers; evita que el resumen fijo tape las acciones.
- Incorpora pruebas de regresión de idioma y diseño móvil en CI.

## [1.3.0] - 2026-11-05

- Convierte «Otras pestañas» en un panel integrado que no cubre el contenido y mejora accesibilidad, idiomas y cierre de pestañas.
- Muestra versiones verificadas por health o identificadas como registradas en el manifiesto, sin confundirlas con versiones desplegadas.
- Añade pruebas de regresión del overflow y de lectura segura de versiones.

## [1.2.4] - 2026-11-05

- Alinea el versionamiento SemVer de Dhole Web y su bundle con el release global.
- Mantiene deploy automático a staging y producción en todo push sin cancelar los pendientes.

## [1.2.3] - 2026-11-05

- Asegurar que el botón Asignar IDTRA aparezca en Pantalla 9 para tarifas aceptadas sin identificador válido, incluyendo marcadores heredados como Pendiente.
- Separar la visibilidad del botón de los permisos: si faltan permisos, mostrarlo deshabilitado con explicación en lugar de ocultarlo.
- Validar en CI que el botón esté presente en el JavaScript final generado por Vite, además de comprobar la fuente.

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

