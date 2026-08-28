from pathlib import Path

router = Path('src/core/router/index.ts')
text = router.read_text()
marker = """        {\n          path: 'pricing/imports/review/:batchId',\n"""
route = """        {\n          path: 'pricing/news',\n          name: 'pricing-logistics-news',\n          component: () => import('@/modules/pricing/views/PricingLogisticsNewsView.vue'),\n          meta: {\n            tabTitle: 'Noticias logísticas',\n            closable: true,\n            requiredScope: VIEW_SCOPES.pricingImports,\n          },\n        },\n"""
if "name: 'pricing-logistics-news'" not in text:
    if marker not in text:
        raise SystemExit('Pricing review route marker not found')
    text = text.replace(marker, route + marker, 1)
    router.write_text(text)

layout = Path('src/shared/components/layouts/MainLayout.vue')
text = layout.read_text()
if '  Newspaper,' not in text:
    text = text.replace('  Mail,\n  ReceiptText,', '  Mail,\n  Newspaper,\n  ReceiptText,', 1)

menu_marker = """    children.push({ label: t('sidebar.importedRates'), path: '/pricing/imports', icon: FileText })\n"""
menu_item = """    children.push({ label: 'Noticias logísticas', path: '/pricing/news', icon: Newspaper })\n"""
if "path: '/pricing/news'" not in text:
    if menu_marker not in text:
        raise SystemExit('Pricing imported rates menu marker not found')
    text = text.replace(menu_marker, menu_marker + menu_item, 1)
layout.write_text(text)

warehouse = Path('src/modules/catalogs/components/CatalogItemFormDrawer.vue')
text = warehouse.read_text()
text = text.replace(
    "if (!file.type.startsWith('image/')) {",
    "if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {",
    1,
)
text = text.replace('file.size > 8 * 1024 * 1024', 'file.size > 5 * 1024 * 1024', 1)
text = text.replace('no puede superar 8 MB', 'no puede superar 5 MB', 1)
warehouse.write_text(text)

print('Web logistics news route/menu and WHS image constraints updated')
