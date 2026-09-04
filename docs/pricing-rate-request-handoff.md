# Solicitud de tarifa: división Ventas / Pricing

- Ventas completa las pantallas 0, 1, 2, 3 y 4.
- La solicitud se envía a Pricing al finalizar la pantalla 4.
- Pricing retoma la solicitud directamente en la pantalla 5 y completa las pantallas 5, 6, 7 y 8.
- Al retomar la solicitud, Pricing no puede regresar a las pantallas 0 a 4.
- La información capturada por Ventas, incluida la carga de la pantalla 4 y sus soportes, viaja en el payload de la solicitud.
