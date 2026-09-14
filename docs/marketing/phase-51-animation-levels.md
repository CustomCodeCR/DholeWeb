# FASE 51 — Niveles simples de animación

## Objetivo

Simplificar la configuración de movimiento para Mercadeo sin exponer valores técnicos ni una colección de sliders.

FASE 51 se presenta debajo del Animation Picker de FASE 50 y no reemplaza la selección del tipo de animación.

## Movimiento

Se muestran cuatro opciones humanas:

- **Ninguno** → distancia 0;
- **Suave** → distancia 16;
- **Normal** → distancia 32;
- **Dinámico** → distancia 64.

`Normal` utiliza el valor central por defecto de ContentService (`distance = 32`). Los demás niveles son valores discretos dentro del rango validado por el backend (`0–160`).

## Velocidad

La configuración opcional de velocidad ofrece únicamente:

- **Lenta** → 900 ms;
- **Normal** → 600 ms;
- **Rápida** → 400 ms.

`Normal` conserva el valor por defecto de ContentService (`duration = 600`). Todos los valores están dentro del rango validado por el backend (`0–3000`).

## Persistencia

Los cambios usan la operación `edit` de Page Builder con `animationJson`.

Si el bloque ya tiene una configuración de animación, se preservan el preset y todas las demás propiedades y únicamente se modifica `distance` o `duration`. Si todavía no existe una configuración, se crea con `preset = none` y ContentService completa los defaults restantes.

## Interfaz

- Se reutiliza `DhButton`.
- No se muestran números técnicos al usuario.
- No existen sliders ni inputs numéricos.
- Soporta español e inglés.
- El Animation Picker visual de FASE 50 permanece intacto.

## Fuera de alcance

FASE 51 no modifica la toolbar del editor ni implementa FASE 52.
