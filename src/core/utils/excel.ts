export interface ExcelColumn {
  key: string
  label: string
}

export interface ExcelSheet {
  name: string
  columns: ExcelColumn[]
  rows: Record<string, unknown>[]
}

export interface ExcelWorkbookOptions {
  fileName: string
  sheets: ExcelSheet[]
}

type ZipFile = { name: string; content: string }

const encoder = new TextEncoder()
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g
const INVALID_SHEET_CHARS = /[\\/*?:[\]]/g

function escapeXml(value: string) {
  return value
    .replace(INVALID_XML_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function stringifyCellValue(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  if (Array.isArray(value)) return value.map(stringifyCellValue).join(', ')

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function excelColumnName(index: number) {
  let value = index + 1
  let result = ''
  while (value > 0) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

function cellXml(reference: string, value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${reference}" t="n"><v>${value}</v></c>`
  }
  if (typeof value === 'boolean') {
    return `<c r="${reference}" t="b"><v>${value ? 1 : 0}</v></c>`
  }

  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(stringifyCellValue(value))}</t></is></c>`
}

function sanitizeSheetName(value: string, fallback: string) {
  const sanitized = value.replace(INVALID_SHEET_CHARS, ' ').replace(/\s+/g, ' ').trim()
  return (sanitized || fallback).slice(0, 31)
}

function uniqueSheetNames(sheets: ExcelSheet[]) {
  const used = new Set<string>()
  return sheets.map((sheet, index) => {
    const base = sanitizeSheetName(sheet.name, `Hoja ${index + 1}`)
    let name = base
    let suffix = 2
    while (used.has(name.toLowerCase())) {
      const ending = ` ${suffix++}`
      name = `${base.slice(0, Math.max(1, 31 - ending.length))}${ending}`
    }
    used.add(name.toLowerCase())
    return { ...sheet, name }
  })
}

function sheetXml(sheet: ExcelSheet) {
  const rows = [
    sheet.columns.map((column) => column.label),
    ...sheet.rows.map((row) => sheet.columns.map((column) => row[column.key])),
  ]

  const rowXml = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => cellXml(`${excelColumnName(columnIndex)}${rowIndex + 1}`, value))
        .join('')
      return `<row r="${rowIndex + 1}">${cells}</row>`
    })
    .join('')

  const widths = sheet.columns
    .map((column, index) => {
      const contentLengths = sheet.rows
        .slice(0, 200)
        .map((row) => stringifyCellValue(row[column.key]).length)
      const width = Math.min(60, Math.max(10, column.label.length, ...contentLengths) + 2)
      return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${widths}</cols>
  <sheetData>${rowXml}</sheetData>
</worksheet>`
}

function workbookFiles(sheets: ExcelSheet[]): ZipFile[] {
  const normalized = uniqueSheetNames(sheets)
  const sheetContentTypes = normalized
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('')
  const workbookSheets = normalized
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join('')
  const relationships = normalized
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join('')

  const files: ZipFile[] = [
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheetContentTypes}
</Types>`,
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${workbookSheets}</sheets>
</workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`,
    },
  ]

  normalized.forEach((sheet, index) => {
    files.push({ name: `xl/worksheets/sheet${index + 1}.xml`, content: sheetXml(sheet) })
  })
  return files
}

let crcTable: Uint32Array | null = null

function getCrcTable() {
  if (crcTable) return crcTable
  crcTable = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    crcTable[index] = value >>> 0
  }
  return crcTable
}

function crc32(bytes: Uint8Array) {
  const table = getCrcTable()
  let crc = 0xffffffff
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function set16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function set32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true)
}

function concatBytes(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function createZip(files: ZipFile[]) {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let localOffset = 0

  for (const file of files) {
    const name = encoder.encode(file.name)
    const data = encoder.encode(file.content)
    const crc = crc32(data)

    const local = new Uint8Array(30)
    const localView = new DataView(local.buffer)
    set32(localView, 0, 0x04034b50)
    set16(localView, 4, 20)
    set16(localView, 6, 0x0800)
    set32(localView, 14, crc)
    set32(localView, 18, data.length)
    set32(localView, 22, data.length)
    set16(localView, 26, name.length)
    localParts.push(local, name, data)

    const central = new Uint8Array(46)
    const centralView = new DataView(central.buffer)
    set32(centralView, 0, 0x02014b50)
    set16(centralView, 4, 20)
    set16(centralView, 6, 20)
    set16(centralView, 8, 0x0800)
    set32(centralView, 16, crc)
    set32(centralView, 20, data.length)
    set32(centralView, 24, data.length)
    set16(centralView, 28, name.length)
    set32(centralView, 42, localOffset)
    centralParts.push(central, name)

    localOffset += local.length + name.length + data.length
  }

  const local = concatBytes(localParts)
  const central = concatBytes(centralParts)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  set32(endView, 0, 0x06054b50)
  set16(endView, 8, files.length)
  set16(endView, 10, files.length)
  set32(endView, 12, central.length)
  set32(endView, 16, local.length)
  return concatBytes([local, central, end])
}

function sanitizeFileName(value: string) {
  const sanitized = value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').replace(/\s+/g, ' ').trim()
  const base = sanitized || 'dhole-export'
  return base.toLowerCase().endsWith('.xlsx') ? base : `${base}.xlsx`
}

export function downloadExcelWorkbook(options: ExcelWorkbookOptions) {
  const sheets = options.sheets.filter((sheet) => sheet.columns.length > 0)
  if (!sheets.length) return false

  const payload = createZip(workbookFiles(sheets))
  const blobBytes = Uint8Array.from(payload)
  const blob = new Blob([blobBytes.buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = sanitizeFileName(options.fileName)
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
  return true
}

function isVisibleTable(table: HTMLTableElement) {
  if (table.dataset.excelExport === 'false') return false
  const style = window.getComputedStyle(table)
  return style.display !== 'none' && style.visibility !== 'hidden' && table.getClientRects().length > 0
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function cellDisplayValue(cell: HTMLTableCellElement | undefined) {
  if (!cell) return ''
  const control = cell.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    'input:not([type="hidden"]), select, textarea',
  )
  if (control instanceof HTMLSelectElement) {
    return normalizeText(control.selectedOptions[0]?.textContent || control.value)
  }
  if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
    return normalizeText(control.value || cell.textContent)
  }
  return normalizeText(cell.textContent)
}

function tableTitle(table: HTMLTableElement, pageTitle: string, index: number) {
  const explicit = table.dataset.excelSheet || table.getAttribute('aria-label')
  if (explicit) return explicit

  let current: HTMLElement | null = table.parentElement
  while (current) {
    const heading = current.querySelector<HTMLElement>(':scope > h2, :scope > h3, :scope > h4')
    const title = normalizeText(heading?.textContent)
    if (title) return title
    current = current.parentElement
  }
  return `${pageTitle} ${index + 1}`
}

export function excelSheetsFromVisibleTables(pageTitle: string) {
  const tables = Array.from(document.querySelectorAll<HTMLTableElement>('table')).filter(isVisibleTable)

  return tables.flatMap<ExcelSheet>((table, tableIndex) => {
    const head = table.tHead
    const headerRow = (head ? head.rows[head.rows.length - 1] : undefined) ?? table.rows[0]
    if (!headerRow) return []

    const exportIndexes = Array.from(headerRow.cells)
      .map((cell, index) => ({
        index,
        label: normalizeText(cell.textContent) || `Columna ${index + 1}`,
      }))
      .filter(({ label }) => !/^(acciones?|actions?)$/i.test(label))
    if (!exportIndexes.length) return []

    const bodyRows = table.tBodies.length
      ? Array.from(table.tBodies).flatMap((body) => Array.from(body.rows))
      : Array.from(table.rows).slice(headerRow.rowIndex + 1)

    const rows = bodyRows.flatMap<Record<string, unknown>>((row) => {
      if (row.cells.length === 1 && (row.cells[0]?.colSpan ?? 0) > 1) return []

      const record: Record<string, unknown> = {}
      let hasValue = false
      exportIndexes.forEach(({ index }, exportIndex) => {
        const value = cellDisplayValue(row.cells[index])
        record[`column_${exportIndex}`] = value
        if (value) hasValue = true
      })
      return hasValue ? [record] : []
    })

    return [
      {
        name: tableTitle(table, pageTitle, tableIndex),
        columns: exportIndexes.map(({ label }, exportIndex) => ({
          key: `column_${exportIndex}`,
          label,
        })),
        rows,
      },
    ]
  })
}

export function hasVisibleExcelTables() {
  return Array.from(document.querySelectorAll<HTMLTableElement>('table')).some(isVisibleTable)
}

export function downloadVisibleTablesAsExcel(pageTitle: string) {
  const sheets = excelSheetsFromVisibleTables(pageTitle)
  if (!sheets.length) return false
  const date = new Date().toISOString().slice(0, 10)
  return downloadExcelWorkbook({ fileName: `${pageTitle}-${date}.xlsx`, sheets })
}
