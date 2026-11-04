# Versionamiento de Dhole Web

La versión oficial se define en `package.json`, en formato `MAJOR.MINOR.PATCH`. El primer registro formal es **1.0.0**; no se deducen ni inventan versiones anteriores.

- **MAJOR**: cambio incompatible de contratos, migraciones obligatorias o ruptura de compatibilidad. Ejemplo: 1.8.4 → 2.0.0.
- **MINOR**: funcionalidades nuevas compatibles con la versión actual. Ejemplo: 1.8.4 → 1.9.0.
- **PATCH**: correcciones compatibles o mantenimiento sin nuevas funciones incompatibles. Ejemplo: 1.8.4 → 1.8.5.

## Cómo publicar una nueva versión

1. Elegir el tipo de cambio de mayor impacto incluido en la publicación.
2. Ejecutar uno de estos comandos desde la raíz del repositorio:

```bash
pnpm run version:patch "Corrige el cálculo del costo por contenedor"
pnpm run version:minor "Agrega seguimiento de compromisos en CRM"
pnpm run version:major "Introduce un contrato de API incompatible"
```

3. Verificar con `pnpm run version:check` y `pnpm run test:versioning`.
4. Revisar y confirmar juntos los tres archivos actualizados: `package.json`, `package-lock.json` y `CHANGELOG.md`.
5. Integrar en `develop`, probar en staging y promover **el mismo número** a `master`. No incrementarlo dos veces por el mismo cambio.
6. Tras validar la publicación en producción, crear una etiqueta anotada para ese commit: `git tag -a v1.0.0 -m "Dhole Web v1.0.0"` y `git push origin v1.0.0` (ajustar a la versión que corresponda). Las etiquetas se crean una sola vez y nunca se mueven.

No es necesario incrementar `MAJOR.MINOR.PATCH` en cada compilación o reintento de deploy. El identificador de commit se imprime por separado para distinguir compilaciones y se inyecta desde el workflow.

La versión y su registro de cambios **no se modifican de forma silenciosa en el servidor**. La validación se ejecuta antes de compilar y evita publicar archivos de versión inconsistentes.

## Trazabilidad

- `package.json`: fuente de verdad de la versión.
- `package-lock.json`: debe coincidir con el paquete raíz.
- `CHANGELOG.md`: historial de versiones y notas reales del cambio.
- `/version.json`: metadatos públicos de la compilación (versión, canal, SHA y fecha).
- Menú lateral y Configuración: versión instalada y metadatos de la compilación.
- `master`: despliegue production; `develop`: despliegue staging.

Este mecanismo versiona **DholeWeb**; las APIs/microservicios conservan sus ciclos de versión y requieren una política adicional si se desea una versión única de toda la plataforma.
