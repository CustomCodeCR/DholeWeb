import { fetchClient } from '@/core/api/fetchConfig'
import { toQueryString } from '@/core/api/queryString'
import { unwrapListResponse } from '@/core/api/apiResponse'
import type {
  ContentCollectionDto,
  ContentRedirectDto,
  MarketingCampaignDto,
  MarketingFormDto,
  MarketingLeadDto,
  MarketingSubmissionDto,
  MeetingRequestDto,
  MeetingTypeDto,
  PlacementDto,
  SiteDto,
} from '@/core/interfaces/marketing'

function query(path: string, values?: Record<string, unknown>) {
  return path + (values ? toQueryString(values) : '')
}

async function getList<T>(path: string): Promise<T[]> {
  return unwrapListResponse<T>(await fetchClient<unknown>(path, { method: 'GET' }))
}

export const MarketingService = {
  getForms(siteKey = 'main') {
    return getList<MarketingFormDto>(query('/api/content/forms/', { siteKey }))
  },

  getSubmissions() {
    return getList<MarketingSubmissionDto>('/api/content/submissions/')
  },

  getLeads(siteKey = 'main') {
    return getList<MarketingLeadDto>(query('/api/content/leads/', { siteKey }))
  },

  getMeetingTypes(siteKey = 'main') {
    return getList<MeetingTypeDto>(query('/api/content/meetings/types', { siteKey }))
  },

  getMeetingRequests(values?: { fromUtc?: string; toUtc?: string; status?: string }) {
    return getList<MeetingRequestDto>(query('/api/content/meetings/requests', values as Record<string, unknown>))
  },

  getCampaigns(siteKey = 'main') {
    return getList<MarketingCampaignDto>(query('/api/content/campaigns/', { siteKey }))
  },

  getPlacements(siteKey = 'main') {
    return getList<PlacementDto>(query('/api/content/placements/', { siteKey }))
  },

  getCollections(siteKey = 'main') {
    return getList<ContentCollectionDto>(query('/api/content/collections/', { siteKey }))
  },

  getRedirects(siteKey = 'main') {
    return getList<ContentRedirectDto>(query('/api/content/redirects/', { siteKey }))
  },

  getSites() {
    return getList<SiteDto>('/api/content/sites/')
  },
}
