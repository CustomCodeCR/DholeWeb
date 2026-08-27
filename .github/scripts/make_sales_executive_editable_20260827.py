from pathlib import Path

path = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = path.read_text(encoding='utf-8-sig')


def replace_once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {count}')
    text = text.replace(old, new, 1)


# El ejecutivo comercial NO es el usuario autenticado: debe ser un dato editable de la cotización.
text = text.replace("import { useAuthStore } from '@/core/stores/authStore'\n", '')
text = text.replace(
    "const authStore = useAuthStore()\nconst executiveName = computed(() => authStore.userDisplayName || authStore.email || 'Usuario')\n",
    '',
)

replace_once(
    "  clientName: '',\n  pickupAddress: '',\n",
    "  clientName: '',\n  executiveName: '',\n  pickupAddress: '',\n",
    'form executive name',
)

replace_once(
    '<DhInput :model-value="executiveName" label="Ejecutivo" disabled />',
    '<DhInput v-model="form.executiveName" label="Ejecutivo de venta" placeholder="Escriba el nombre del ejecutivo" />',
    'editable executive input',
)

# Mantener el dato al resetear el wizard como un campo normal y vacío.
reset_anchor = "    clientName: '',\n"
if text.count(reset_anchor) > 1:
    # El primer clientName corresponde al objeto inicial; ya fue modificado arriba.
    # En cualquier bloque de reset posterior que aún no tenga executiveName, agréguelo.
    parts = text.splitlines(keepends=True)
    output = []
    for index, line in enumerate(parts):
        output.append(line)
        if line.strip() == "clientName: '',":
            next_line = parts[index + 1] if index + 1 < len(parts) else ''
            if next_line.strip() != "executiveName: '',":
                indent = line[:len(line) - len(line.lstrip())]
                output.append(f"{indent}executiveName: '',\n")
    text = ''.join(output)

if 'useAuthStore' in text or 'const executiveName = computed' in text:
    raise SystemExit('Current-user executive binding is still present')
if 'v-model="form.executiveName"' not in text:
    raise SystemExit('Editable executive input was not created')

path.write_text(text, encoding='utf-8')
