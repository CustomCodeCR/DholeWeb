# FASE 53 — Preview Desktop / Tablet / Mobile

## Objetivo

Permitir que Mercadeo cambie el tamaño de la vista previa sin salir del editor visual.

## Implementación

La vista previa viva de FASE 52 ahora reutiliza el componente oficial `DhDevicePreview`.

La barra ofrece tres opciones:

- Desktop;
- Tablet;
- Mobile.

Los anchos de referencia son:

- Desktop: 1280 px;
- Tablet: 768 px;
- Mobile: 390 px.

El cambio ocurre dentro de la misma zona central del editor y no abre rutas, ventanas ni páginas externas.

## Adaptación visual

El renderer vivo utiliza el dispositivo seleccionado para adaptar los bloques principales:

- Hero de dos columnas pasa a una columna en Mobile;
- Servicios reduce columnas en Tablet y usa una columna en Mobile;
- Galería usa una columna en Mobile;
- espaciados y tamaño del título Hero se compactan en Mobile.

Se conserva el preview inmediato de FASE 52 para texto, imagen, diseño, color, espaciado y animación.

## Design System

No se creó un selector paralelo. Se utiliza `DhDevicePreview`, que ya integra los iconos y botones Dhole para Desktop, Tablet y Mobile.

## Fuera de alcance

FASE 53 no modifica el comportamiento de scroll independiente de Bloques, Canvas y Propiedades. Ese trabajo corresponde a FASE 54.
