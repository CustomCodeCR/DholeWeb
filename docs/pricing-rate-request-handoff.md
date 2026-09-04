# Solicitud de tarifa: división Ventas / Pricing

- Ventas completa las pantallas 0, 1, 2, 3 y 4.
- La solicitud se envía a Pricing al finalizar la pantalla 4.
- Ventas debe indicar modalidad, tipo de embarque, ruta, tipo de contenedor/equipo, Incoterm, servicios, carga y soportes.
- Ventas indica únicamente la fecha de carga lista; no define la vigencia comercial de la tarifa.
- Ventas no puede escoger Merchant o Naviera para el inland. Esa decisión corresponde a Pricing.
- Para FCL, Ventas sí puede indicar Anticipado o Redestino cuando aplique.
- Pricing retoma la solicitud directamente en la pantalla 5 y completa las pantallas 5, 6, 7 y 8.
- Al retomar la solicitud, Pricing no puede regresar a las pantallas 0 a 4.
- En pantalla 5 Pricing recibe un resumen con contenedor, Incoterm, carga lista y Anticipado/Redestino; allí define vigencia y Merchant/Naviera antes de continuar.
- La información capturada por Ventas, incluida la carga de la pantalla 4 y sus soportes, viaja en el payload de la solicitud.
- El handoff se valida mediante el build y despliegue de staging antes de promoverse a producción.
