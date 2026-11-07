# Changelog

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

- La revisión guardada no completa automáticamente una solicitud de modificación; el envío es una acción explícita y separada.
- Evita duplicar revisiones y requiere seleccionar un motivo con confirmación para cancelar modificaciones.
- Incluye cobertura de regresión para persistencia, cierre, cancelación y actualización del dashboard.


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

