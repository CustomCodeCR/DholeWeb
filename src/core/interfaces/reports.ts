export type ReportFormat = 'pdf' | 'xlsx' | 'csv'
export type ReportPageSize = 'A4' | 'LETTER' | 'LEGAL'
export type ReportOrientation = 'Portrait' | 'Landscape'

export interface ReportsHealthDto {
  service: string
  status: string
  database: string
  timestamp: string
}

export interface ReportTemplateListDto {
  id: string
  name: string
  description?: string | null
  pageSize: ReportPageSize | string
  orientation: ReportOrientation | string
  hasPreviewPdf: boolean
  previewGeneratedAtUtc: string
  isActive: boolean
  createdAtUtc: string
  updatedAtUtc?: string | null
}

export interface ReportTemplateDto extends ReportTemplateListDto {
  htmlContent: string
  designerJson: string
}

export interface BrowseReportTemplatesQuery {
  pageNumber?: number
  pageSize?: number
  search?: string
  isActive?: boolean
}

export interface SaveReportTemplateRequest {
  name: string
  description?: string | null
  htmlContent: string
  designerJson: string
  pageSize: ReportPageSize
  orientation: ReportOrientation
}

export interface GenerateReportRequest {
  format: ReportFormat
  dataJson: string
  fileName?: string | null
  sheetName?: string | null
}

export type ReportBlockType =
  | 'heading'
  | 'text'
  | 'variable'
  | 'table'
  | 'image'
  | 'divider'
  | 'spacer'

export interface ReportTableColumn {
  field: string
  label: string
}

export interface ReportDesignerBlock {
  id: string
  type: ReportBlockType
  content: string
  variable: string
  collection: string
  columns: ReportTableColumn[]
  align: 'left' | 'center' | 'right'
  fontSize: number
  fontWeight: 'normal' | 'bold'
  color: string
  backgroundColor: string
  padding: number
  height: number
  imageUrl: string
}

export type ReportDesignerMode = 'visual' | 'html'

export interface ReportDesignerDocument {
  version: 1 | 2
  mode?: ReportDesignerMode
  blocks: ReportDesignerBlock[]
}
