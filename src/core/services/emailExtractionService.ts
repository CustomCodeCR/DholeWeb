import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse, unwrapPagedResponse } from '@/core/api/apiResponse'
import type { PagedResponse } from '@/core/api/apiResponse'
import { toQueryString } from '@/core/api/queryString'
import { Endpoints } from '@/core/composables/endpoints'
import type {
  BrowseEmailAccountsQuery,
  BrowseEmailExtractionJobsQuery,
  BrowseEmailMessagesQuery,
  EmailAccountDto,
  EmailExtractionJobDto,
  EmailMessageDetailDto,
  EmailMessageDto,
  PricingImportEmailSourceDto,
  SendEmailExtractionToPricingResponse,
} from '@/core/interfaces/emailExtraction'

type AcceptedResponse = { id?: string; messageId?: string }

function withQuery(path: string, query?: Record<string, unknown>) {
  return path + (query ? toQueryString(query) : '')
}

export const EmailExtractionService = {
  async browseAccounts(
    query?: BrowseEmailAccountsQuery,
  ): Promise<PagedResponse<EmailAccountDto>> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.browseEmailAccounts,
      path: withQuery(Endpoints.browseEmailAccounts.path, query),
    })

    return unwrapPagedResponse<EmailAccountDto>(response)
  },

  async browseMessages(
    query?: BrowseEmailMessagesQuery,
  ): Promise<PagedResponse<EmailMessageDto>> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.browseEmailMessages,
      path: withQuery(Endpoints.browseEmailMessages.path, query),
    })

    return unwrapPagedResponse<EmailMessageDto>(response)
  },

  async getMessage(messageId: string): Promise<EmailMessageDetailDto> {
    const response = await callEndpoint<unknown>(Endpoints.getEmailMessage, {
      params: { messageId },
    })

    return unwrapApiResponse<EmailMessageDetailDto>(response as never)
  },

  async getPricingImportSource(pricingImportBatchId: string): Promise<PricingImportEmailSourceDto> {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: `/api/data-extraction/email/pricing-imports/${encodeURIComponent(pricingImportBatchId)}/source`,
      headers: { Accept: 'application/json' },
    })

    return unwrapApiResponse<PricingImportEmailSourceDto>(response as never)
  },

  async reprocessMessage(messageId: string): Promise<AcceptedResponse> {
    const response = await callEndpoint<unknown>(Endpoints.reprocessEmailMessage, {
      params: { messageId },
    })

    return unwrapApiResponse<AcceptedResponse>(response as never)
  },

  async sendExtractionToPricing(
    jobId: string,
  ): Promise<SendEmailExtractionToPricingResponse> {
    const response = await callEndpoint<unknown>(Endpoints.sendEmailExtractionToPricing, {
      params: { jobId },
    })

    return unwrapApiResponse<SendEmailExtractionToPricingResponse>(response as never)
  },

  async browseExtractionJobs(
    query?: BrowseEmailExtractionJobsQuery,
  ): Promise<PagedResponse<EmailExtractionJobDto>> {
    const response = await callEndpoint<unknown>({
      ...Endpoints.browseEmailExtractionJobs,
      path: withQuery(Endpoints.browseEmailExtractionJobs.path, query),
    })

    return unwrapPagedResponse<EmailExtractionJobDto>(response)
  },
}
