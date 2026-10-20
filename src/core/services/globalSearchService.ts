import { VIEW_SCOPES } from '@/core/auth/scopes'
import { PricingService } from '@/core/services/pricingService'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapListResponse } from '@/core/api/apiResponse'
import type { RateDto } from '@/core/interfaces/pricing'
import { UsersService } from '@/core/services/usersService'
import { RolesService } from '@/core/services/rolesService'
import { ScopesService } from '@/core/services/scopesService'
import { CatalogGroupsService } from '@/core/services/catalogGroupsService'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { ReportsService } from '@/core/services/reportsService'
import { AgentService } from '@/core/services/agentService'

export interface GlobalSearchRecord {
  id: string
  title: string
  description: string
  category: string
  path: string
}

export interface GlobalSearchResponse {
  records: GlobalSearchRecord[]
  failedSources: number
}

type SearchSource = {
  scope: string
  run: () => Promise<GlobalSearchRecord[]>
}

const SEARCH_PAGE_SIZE = 15
const MAX_RESULTS = 70

function matchesQuery(query: string, ...values: (string | null | undefined)[]): boolean {
  const normalized = query.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return values.some((value) =>
    String(value ?? '').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(normalized),
  )
}

/**
 * Federated search reuses the browse filters already enforced by the service APIs.
 * Never query a resource without its corresponding view scope. API permissions
 * remain authoritative; client filtering is only a usability safeguard.
 */
export async function searchGlobalRecords(
  value: string,
  hasScope: (scope: string) => boolean,
): Promise<GlobalSearchResponse> {
  const query = value.trim().slice(0, 120)
  if (query.length < 2) return { records: [], failedSources: 0 }

  const page = { pageNumber: 1, pageSize: SEARCH_PAGE_SIZE, search: query }
  const hasSellerAccess = hasScope('pricing.rate-request.create')
  const hasPricingOperatorAccess = [
    'pricing.rate.create',
    'pricing.rate.update',
    'pricing.rate.delete',
    'pricing.rate.approve-low-margin',
    'pricing.rate.approve-freight',
    'pricing.import-fcl-rate.review',
    'pricing.import-fcl-rate.approve',
    'pricing.import-fcl-rate.reject',
    'pricing.import-fcl-rate.create-as-rate',
  ].some(hasScope)
  const restrictedSeller = hasSellerAccess && !hasPricingOperatorAccess
    && !hasScope('pricing.rate-request.view-all')
  const sources: SearchSource[] = [
    // Sellers do not have access to the generic /pricing/rates browse endpoint.
    // Their issued quotes must be searchable through the owner-scoped API.
    {
      scope: 'pricing.rate-request.create',
      run: async () => {
        const response = await callEndpoint<unknown>({
          method: 'GET',
          path: '/api/pricing/seller-rates',
          headers: { Accept: 'application/json' },
        })
        return unwrapListResponse<RateDto>(response)
          .filter((rate) => matchesQuery(query,
            rate.quoNumber, rate.idtraNumber, rate.rateCode,
            rate.clientName, rate.executiveName, rate.polName, rate.poeName, rate.podName))
          .slice(0, SEARCH_PAGE_SIZE)
          .map((rate) => ({
            id: `rate:${rate.id}`,
            title: rate.quoNumber || rate.rateCode,
            description: [rate.clientName, rate.polName, rate.poeName, rate.podName].filter(Boolean).join(' · '),
            category: rate.revisionPending ? 'Tarifa en modificación' : 'Tarifa / cotización',
            path: `/pricing/seller-rates/${encodeURIComponent(rate.id)}`,
          }))
      },
    },
    {
      scope: VIEW_SCOPES.pricingRates,
      run: async () => {
        const response = await PricingService.browseRates(page)
        return response.items.map((rate) => ({
          id: `rate:${rate.id}`,
          title: rate.rateCode || rate.rateName,
          description: [rate.clientName, rate.rateName, rate.polName, rate.podName].filter(Boolean).join(' · '),
          category: rate.rateType === 'Tariff' ? 'Tarifario' : 'Tarifa / cotización',
          path: `/pricing/rates/${encodeURIComponent(rate.id)}/wizard?mode=view`,
        }))
      },
    },
    {
      scope: VIEW_SCOPES.pricingCosts,
      run: async () => {
        const response = await PricingService.browseCosts(page)
        return response.items.map((cost) => ({
          id: `cost:${cost.id}`,
          title: cost.name,
          description: [cost.costDetailType, cost.carrierName, cost.agentName, cost.portName].filter(Boolean).join(' · '),
          category: 'Costo / recargo',
          path: `/pricing/costs?search=${encodeURIComponent(cost.name)}&recordId=${encodeURIComponent(cost.id)}`,
        }))
      },
    },
    {
      scope: VIEW_SCOPES.pricingImports,
      run: async () => {
        const response = await PricingService.browseImportRates(page)
        return response.items.map((rate) => ({
          id: `import:${rate.id}`,
          title: [rate.pol, rate.pod].filter(Boolean).join(' → ') || rate.id,
          description: [rate.carrier, rate.agent, rate.importProfileName, rate.commodity].filter(Boolean).join(' · '),
          category: 'Tarifa importada',
          path: `/pricing/imports?search=${encodeURIComponent(query)}&recordId=${encodeURIComponent(rate.id)}`,
        }))
      },
    },
    {
      scope: VIEW_SCOPES.users,
      run: async () => {
        const response = await UsersService.browsePaged(page)
        return response.items.map((user) => ({
          id: `user:${user.id}`,
          title: user.displayName || user.userName,
          description: [user.email, user.userName].filter(Boolean).join(' · '),
          category: 'Usuario',
          path: `/auth/users?search=${encodeURIComponent(query)}&recordId=${encodeURIComponent(user.id)}`,
        }))
      },
    },
    {
      scope: VIEW_SCOPES.roles,
      run: async () => {
        const response = await RolesService.browsePaged(page)
        return response.items.map((role) => ({
          id: `role:${role.id}`,
          title: role.name,
          description: role.description ?? '',
          category: 'Rol',
          path: `/auth/roles?search=${encodeURIComponent(query)}&recordId=${encodeURIComponent(role.id)}`,
        }))
      },
    },
    {
      scope: VIEW_SCOPES.scopes,
      run: async () => {
        const scopes = await ScopesService.select()
        return scopes.filter((scope) => matchesQuery(query, scope.code, scope.name))
          .slice(0, SEARCH_PAGE_SIZE).map((scope) => ({
            id: `scope:${scope.id}`,
            title: scope.code,
            description: scope.name,
            category: 'Permiso',
            path: `/auth/scopes?search=${encodeURIComponent(scope.code)}`,
          }))
      },
    },
    {
      scope: VIEW_SCOPES.catalogs,
      run: async () => {
        const response = await CatalogGroupsService.browsePaged(page)
        return response.items.map((group) => ({
          id: `group:${group.id}`,
          title: group.name,
          description: [group.code, group.slug, group.description].filter(Boolean).join(' · '),
          category: 'Catálogo',
          path: `/config/catalogs?search=${encodeURIComponent(group.slug)}&recordId=${encodeURIComponent(group.id)}`,
        }))
      },
    },
    {
      scope: VIEW_SCOPES.catalogs,
      run: async () => {
        const response = await CatalogItemsService.browsePaged(page)
        return response.items.map((item) => ({
          id: `catalog-item:${item.id}`,
          title: item.name,
          description: [item.code, item.value, item.catalogGroupSlug].filter(Boolean).join(' · '),
          category: 'Ítem de catálogo',
          path: `/config/catalogs?search=${encodeURIComponent(item.catalogGroupSlug)}&recordId=${encodeURIComponent(item.catalogGroupId)}&itemId=${encodeURIComponent(item.id)}`,
        }))
      },
    },
    {
      scope: VIEW_SCOPES.reportsTemplates,
      run: async () => {
        const response = await ReportsService.browse(page)
        return response.items.map((report) => ({
          id: `report:${report.id}`,
          title: report.name,
          description: report.description ?? '',
          category: 'Plantilla de reporte',
          path: `/reports/templates/${encodeURIComponent(report.id)}`,
        }))
      },
    },
    {
      scope: VIEW_SCOPES.agentExecutions,
      run: async () => {
        // Agent currently exposes a recent-executions list without a server-side text filter.
        const executions = await AgentService.browseExecutions(100)
        return executions.filter((execution) =>
          matchesQuery(query, execution.id, execution.correlationId, execution.status, execution.errorCode),
        ).slice(0, SEARCH_PAGE_SIZE).map((execution) => ({
          id: `execution:${execution.id}`,
          title: execution.id,
          description: [execution.status, execution.errorCode, execution.correlationId].filter(Boolean).join(' · '),
          category: 'Ejecución de agente (recientes)',
          path: `/agents/executions/${encodeURIComponent(execution.id)}`,
        }))
      },
    },
    {
      scope: VIEW_SCOPES.agentDefinitions,
      run: async () => {
        const definitions = await AgentService.browseDefinitions()
        return definitions.filter((definition) =>
          matchesQuery(query, definition.name, definition.code, definition.description),
        ).slice(0, SEARCH_PAGE_SIZE).map((definition) => ({
          id: `agent-definition:${definition.id}`,
          title: definition.name,
          description: [definition.code, definition.description].filter(Boolean).join(' · '),
          category: 'Definición de agente',
          path: '/agents/advanced',
        }))
      },
    },
    {
      scope: VIEW_SCOPES.agentDefinitions,
      run: async () => {
        const profiles = await AgentService.profiles.browse()
        return profiles.filter((profile) =>
          matchesQuery(query, profile.name, profile.description),
        ).slice(0, SEARCH_PAGE_SIZE).map((profile) => ({
          id: `agent-profile:${profile.id}`,
          title: profile.name,
          description: profile.description ?? '',
          category: 'Perfil de agente',
          path: `/agents/profiles/${encodeURIComponent(profile.id)}`,
        }))
      },
    },
  ]

  const permitted = sources.filter((source) => hasScope(source.scope)
    && !(restrictedSeller && source.scope === VIEW_SCOPES.pricingRates))
  const settled = await Promise.allSettled(permitted.map((source) => source.run()))
  let failedSources = 0
  const records: GlobalSearchRecord[] = []
  for (const result of settled) {
    if (result.status === 'rejected') {
      failedSources++
      continue
    }
    records.push(...result.value)
  }

  const seen = new Set<string>()
  const queryLower = query.toLocaleLowerCase()
  const ranked = records
    .filter((record) => {
      if (seen.has(record.id)) return false
      seen.add(record.id)
      return true
    })
    .sort((a, b) => {
      const rank = (record: GlobalSearchRecord) => {
        const name = record.title.toLocaleLowerCase()
        return name === queryLower ? 0 : name.startsWith(queryLower) ? 1 : name.includes(queryLower) ? 2 : 3
      }
      return rank(a) - rank(b)
    })

  return { records: ranked.slice(0, MAX_RESULTS), failedSources }
}
