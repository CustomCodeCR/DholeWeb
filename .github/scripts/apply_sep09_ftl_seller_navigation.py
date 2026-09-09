from pathlib import Path


def replace_once(path: str, anchor: str, replacement: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if replacement in text:
        return
    if anchor not in text:
        raise RuntimeError(f"Anchor not found in {path}: {anchor[:80]!r}")
    file.write_text(text.replace(anchor, replacement, 1), encoding="utf-8")


def patch_router() -> None:
    path = "src/core/router/index.ts"
    file = Path(path)
    text = file.read_text(encoding="utf-8")

    if "path: 'pricing/ftl-tariffs'" not in text:
        anchor = "        {\n          path: 'pricing/costs',"
        route = """        {
          path: 'pricing/ftl-tariffs',
          name: 'pricing-ftl-tariffs',
          component: () => import('@/modules/pricing/views/PricingFtlTariffsView.vue'),
          meta: {
            tabTitle: 'Tarifas FTL',
            closable: true,
            requiredScope: VIEW_SCOPES.pricingCosts,
          },
        },
"""
        if anchor not in text:
            raise RuntimeError("Pricing costs route anchor not found")
        text = text.replace(anchor, route + anchor, 1)

    if "path: 'pricing/seller-visibility'" not in text:
        anchor = "        {\n          path: 'pricing/costs',"
        route = """        {
          path: 'pricing/seller-visibility',
          name: 'pricing-seller-visibility',
          component: () => import('@/modules/pricing/views/PricingSellerVisibilityView.vue'),
          meta: {
            tabTitle: 'Visibilidad comercial',
            closable: true,
            requiredScope: VIEW_SCOPES.pricingSellerAssignment,
          },
        },
"""
        if anchor not in text:
            raise RuntimeError("Pricing costs route anchor not found for seller visibility")
        text = text.replace(anchor, route + anchor, 1)

    file.write_text(text, encoding="utf-8")


def patch_sidebar() -> None:
    path = "src/core/composables/useSidebarItems.ts"
    file = Path(path)
    text = file.read_text(encoding="utf-8")

    import_end = "} from 'lucide-vue-next'"
    if "  Truck,\n" not in text:
        if import_end not in text:
            raise RuntimeError("Lucide import anchor not found")
        text = text.replace(import_end, "  Truck,\n" + import_end, 1)

    costs_anchor = """          {
            labelKey: 'sidebar.costs',
            icon: CircleDollarSign,
            to: '/pricing/costs',
"""

    if "to: '/pricing/ftl-tariffs'" not in text:
        item = """          {
            labelKey: 'Tarifas FTL',
            icon: Truck,
            to: '/pricing/ftl-tariffs',
            name: 'pricing-ftl-tariffs',
            requiredScope: VIEW_SCOPES.pricingCosts,
          },
"""
        if costs_anchor not in text:
            raise RuntimeError("Pricing costs sidebar anchor not found")
        text = text.replace(costs_anchor, item + costs_anchor, 1)

    if "to: '/pricing/seller-visibility'" not in text:
        item = """          {
            labelKey: 'Visibilidad comercial',
            icon: Users,
            to: '/pricing/seller-visibility',
            name: 'pricing-seller-visibility',
            requiredScope: VIEW_SCOPES.pricingSellerAssignment,
          },
"""
        if costs_anchor not in text:
            raise RuntimeError("Pricing costs sidebar anchor not found for seller visibility")
        text = text.replace(costs_anchor, item + costs_anchor, 1)

    file.write_text(text, encoding="utf-8")


def patch_scopes() -> None:
    path = "src/core/auth/scopes.ts"
    file = Path(path)
    text = file.read_text(encoding="utf-8")

    if "sellerAssignments:" not in text:
        anchor = "  rates: {\n"
        block = """  sellerAssignments: {
    manage: 'pricing.seller.assignment.manage',
  },

"""
        if anchor not in text:
            raise RuntimeError("Pricing rates scope anchor not found")
        text = text.replace(anchor, block + anchor, 1)

    if "pricingSellerAssignment:" not in text:
        anchor = "  pricingRateTerms: PRICING_SCOPES.rateTerms.view,\n"
        line = "  pricingSellerAssignment: PRICING_SCOPES.sellerAssignments.manage,\n"
        if anchor not in text:
            raise RuntimeError("VIEW_SCOPES pricingRateTerms anchor not found")
        text = text.replace(anchor, anchor + line, 1)

    file.write_text(text, encoding="utf-8")


patch_router()
patch_sidebar()
patch_scopes()
print("Applied direct FTL and seller-assignment navigation/scopes.")
