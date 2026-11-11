# DholeWeb

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
pnpm install
```

### Compile and Hot-Reload for Development

```sh
pnpm dev
```

### Type-Check, Compile and Minify for Production

```sh
pnpm build
```

## Ubicaciones de visitas comerciales con Geoapify

Para habilitar el mapa y la búsqueda de direcciones, configurar `VITE_GEOAPIFY_API_KEY` en el entorno del build de DholeWeb (en los despliegues se lee desde el archivo protegido `DHOLE_ENV_FILE`). En Geoapify, restringir esta clave pública a los dominios de staging y producción mediante *HTTP referrer restrictions*. No almacenar credenciales privadas en el frontend ni en Git.

El mapa aparece únicamente si el tipo de actividad es **Visita** y permite buscar lugares y negocios, arrastrar, hacer zoom y seleccionar un punto. Al crear/editar se envía `locationText`, `locationLatitude` y `locationLongitude` a DholeCRMService 1.19.0; las actividades antiguas sin coordenadas siguen disponibles.
