# Consola administrativa de IA

## Acceso

La consola está disponible en:

```text
/ai
```

El elemento de navegación aparece cuando el usuario posee al menos un scope `ai.*` de consulta/ejecución o cuando pertenece al rol `SuperUsuario`.

Cada acción adicional se controla con su scope correspondiente del grupo `ai.*`.
Para un administrador completo, asigne todos los scopes siguientes al rol o usuario:

```text
ai.connection.create
ai.connection.view
ai.connection.update
ai.connection.delete
ai.connection.set-active
ai.connection.test
ai.connection.discover-models

ai.model.create
ai.model.view
ai.model.update
ai.model.delete
ai.model.set-active

ai.profile.create
ai.profile.view
ai.profile.update
ai.profile.delete
ai.profile.set-active
ai.profile.configure-models

ai.prompt-template.create
ai.prompt-template.view
ai.prompt-template.update
ai.prompt-template.delete
ai.prompt-template.set-active

ai.execution.view
ai.execution.execute
ai.execution.cancel
```

## URL del servicio

La consola usa el API REST de `DholeAIService` a través de `DholeApiGateway`:

```env
VITE_API_URL=http://localhost:5200
```

Cuando el navegador se ejecuta desde otra máquina, cambie `localhost` por la IP o dominio donde corre el gateway:

```env
VITE_API_URL=http://192.168.1.193:5200
VITE_AI_URL=http://192.168.1.193:5206
```

Flujo de red:

```text
DholeWeb -> http://<gateway>:5200/api/ai/* -> http://localhost:5206/api/ai/*
```

Después de cambiar variables de Vite, reinicie el servidor de desarrollo.

## Flujo recomendado

1. Crear una conexión para Ollama, OpenAI o Gemini.
2. Probar la conexión.
3. Descubrir y registrar los modelos disponibles.
4. Crear una plantilla de prompt, cuando sea reutilizable.
5. Crear un perfil y asignarle modelos por prioridad y fallback.
6. Ejecutar pruebas desde Playground usando la `profileKey`.
7. Revisar duración, tokens, costo, proveedor elegido e intentos de fallback en Historial.

## Integración futura

Los consumidores internos no deben depender de un modelo o proveedor específico. Deben invocar una `profileKey` por gRPC o mediante una tarea en background. El perfil conserva en un solo lugar:

- enrutamiento;
- prioridades;
- fallback;
- temperatura y límite de tokens;
- formato de respuesta;
- plantilla y esquema JSON;
- modelos activos.

Así, la consola REST administra y prueba la configuración, mientras gRPC y los workers reutilizan la misma capa de aplicación del servicio.
