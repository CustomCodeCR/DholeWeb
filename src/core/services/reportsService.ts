import { callEndpoint } from '@/core/api/callEndpoint'
import { fetchBlobClient } from '@/core/api/fetchBlobClient'
import { unwrapApiResponse, unwrapPagedResponse, type PagedResponse } from '@/core/api/apiResponse'
import { toQueryString } from '@/core/api/queryString'
import { ReportsEndpoints } from '@/core/composables/endpoints'
import type {
  BrowseReportTemplatesQuery,
  GenerateReportRequest,
  ReportTemplateDto,
  ReportTemplateListDto,
  SaveReportTemplateRequest,
} from '@/core/interfaces/reports'

function withQuery<TQuery extends object>(path: string, query?: TQuery) {
  return path + (query ? toQueryString(query as Record<string, unknown>) : '')
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const ReportsService = {
  async browse(query?: BrowseReportTemplatesQuery): Promise<PagedResponse<ReportTemplateListDto>> {
    const response = await callEndpoint<unknown>({
      ...ReportsEndpoints.browseTemplates,
      path: withQuery(ReportsEndpoints.browseTemplates.path, query),
    })
    return unwrapPagedResponse<ReportTemplateListDto>(response)
  },

  async get(templateId: string): Promise<ReportTemplateDto> {
    const response = await callEndpoint<unknown>(ReportsEndpoints.getTemplate, {
      params: { templateId },
    })
    return unwrapApiResponse<ReportTemplateDto>(response as never)
  },

  async create(payload: SaveReportTemplateRequest): Promise<string> {
    const response = await callEndpoint<unknown, SaveReportTemplateRequest>(
      ReportsEndpoints.createTemplate,
      { body: payload },
    )
    return unwrapApiResponse<string>(response as never)
  },

  update(templateId: string, payload: SaveReportTemplateRequest): Promise<Record<string, never>> {
    return callEndpoint<Record<string, never>, SaveReportTemplateRequest>(
      ReportsEndpoints.updateTemplate,
      { params: { templateId }, body: payload },
    )
  },

  delete(templateId: string): Promise<Record<string, never>> {
    return callEndpoint<Record<string, never>>(ReportsEndpoints.deleteTemplate, {
      params: { templateId },
    })
  },

  async getPreview(templateId: string): Promise<Blob> {
    const path = ReportsEndpoints.previewTemplate.path.replace('{{templateId}}', templateId)
    return fetchBlobClient(path, { method: 'GET', headers: { Accept: 'application/pdf' } })
  },

  async openPreview(templateId: string) {
    const blob = await this.getPreview(templateId)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  },

  async generate(templateId: string, payload: GenerateReportRequest): Promise<void> {
    const path = ReportsEndpoints.generateReport.path.replace('{{templateId}}', templateId)
    const blob = await fetchBlobClient(path, {
      method: 'POST',
      headers: { Accept: '*/*', 'Content-Type': 'application/json' },
      body: payload,
    })
    const requestedName = payload.fileName?.trim() || 'reporte'
    const extension = `.${payload.format}`
    downloadBlob(blob, requestedName.toLowerCase().endsWith(extension) ? requestedName : requestedName + extension)
  },
}
