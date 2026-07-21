# Asistente IA

- Ruta: `/ai/assistant`.
- Única integración de IA visible en DholeWeb.
- Usa el perfil fijo `assistant`.
- Requiere el scope `ai.execution.execute`.
- Envía el historial reciente al endpoint `/api/ai/executions/chat` mediante el API Gateway.
- Conserva localmente los últimos mensajes y permite limpiar la conversación.
- Pricing no contiene análisis, recomendaciones, tareas automáticas ni endpoints de IA.
