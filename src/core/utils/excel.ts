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

type ZipFile = {
  name: string
  content: string
}

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
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }

  return result
}

function cellXml(reference: string, value: unknown, style = 0) {
  const styleAttribute = style > 0 ? ` s="${style}"` : ''

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${reference}"${styleAttribute} t="n"><v>${value}</v></c>`
  }

  if (typeof value === 'boolean') {
    return `<c r="${reference}"${styleAttribute} t="b"><v>${value ? 1 : 0}</v></c>`
  }

  const text = escapeXml(stringifyCellValue(value))
  return `<c r="${reference}"${styleAttribute} t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`
}

function sanitizeSheetName(value: string, fallback: string) {
  const sanitized = value.replace(INVALID_SHEET_CHARS, ' ').replace(/\s+/g, ' ').trim()
  return (sanitized || fallback).slice(0, 31)
}

function uniqueSheetNames(sheets: ExcelSheet[]) {
  const used = new Set<string>()

  return sheets.map((sheet, index) => {
    const base = sanitizeSheetName(sheet.name, `Hoja ${index + 1}`)
    let candidate = base
    let suffix = 2

    while (used.has(candidate.toLowerCase())) {
      const ending = ` ${suffix}`
      candidate = `${base.slice(0, Math.max(1, 31 - ending.length))}${ending}`
      suffix += 1
    }

    used.add(candidate.toLowerCase())
    return { ...sheet, name: candidate }
  })
}

function sheetXml(sheet: ExcelSheet) {
  const headerCells = sheet.columns
    .map((column, index) => cellXml(`${excelColumnName(index)}1`, column.label, 1))
    .join('')

  const dataRows = sheet.rows
    .map((row, rowIndex) => {
      const excelRow = rowIndex + 2
      const cells = sheet.columns
        .map((column, columnIndex) =>
          cellXml(`${excelColumnName(columnIndex)}${excelRow}`, row[column.key]),
        )
        .join('')
      return `<row r="${excelRow}">${cells}</row>`
    })
    .join('')

  const columnWidths = sheet.columns
    .map((column, index) => {
      const longest = Math.max(
        column.label.length,
        ...sheet.rows.slice(0, 200).map((row) => stringifyCellValue(row[column.key]).length),
      )
      const width = Math.min(60, Math.max(10, longest + 2))
      const columnNumber = index + 1
      return `<col min="${columnNumber}" max="${columnNumber}" width="${width}" customWidth="1"/>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${columnWidths}</cols>
  <sheetData><row r="1">${headerCells}</row>${dataRows}</sheetData>
</worksheet>`
}

function workbookFiles(sheets: ExcelSheet[]): ZipFile[] {
  const normalizedSheets = uniqueSheetNames(sheets)
  const sheetOverrides = normalizedSheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('')
  const workbookSheetNodes = normalizedSheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join('')
  const worksheetRelationships = normalizedSheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join('')
  const styleRelationshipId = normalizedSheets.length + 1

  const files: ZipFile[] = [
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
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
  <sheets>${workbookSheetNodes}</sheets>
</workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${worksheetRelationships}
  <Relationship Id="rId${styleRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/styles.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Aptos"/></font>
    <font><b/><sz val="11"/><name val="Aptos"/></font>
  </fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
</styleSheet>`,
    },
  ]

  normalizedSheets.forEach((sheet, index) => {
    files.push({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      content: sheetXml(sheet),
    })
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

  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true)
}

function concatBytes(parts: Uint8Array[]) {
  const totalLength = parts.reduce((total, part) => total + part.length, 0)
  const output = new Uint8Array(totalLength)
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
    const nameBytes = encoder.encode(file.name)
    const dataBytes = encoder.encode(file.content)
    const crc = crc32(dataBytes)

    const localHeader = new Uint8Array(30)
    const localView = new DataView(localHeader.buffer)
    writeUint32(localView, 0, 0x04034b50)
    writeUint16(localView, 4, 20)
    writeUint16(localView, 6, 0x0800)
    writeUint16(localView, 8, 0)
    writeUint16(localView, 10, 0)
    writeUint16(localView, 12, 0)
    writeUint32(localView, 14, crc)
    writeUint32(localView, 18, dataBytes.length)
    writeUint32(localView, 22, dataBytes.length)
    writeUint16(localView, 26, nameBytes.length)
    writeUint16(localView, 28, 0)

    localParts.push(localHeader, nameBytes, dataBytes)

    const centralHeader = new Uint8Array(46)
    const centralView = new DataView(centralHeader.buffer)
    writeUint32(centralView, 0, 0x02014b50)
    writeUint16(centralView, 4, 20)
    writeUint16(centralView, 6, 20)
    writeUint16(centralView, 8, 0x0800)
    writeUint16(centralView, 10, 0)
    writeUint16(centralView, 12, 0)
    writeUint16(centralView, 14, 0)
    writeUint32(centralView, 16, crc)
    writeUint32(centralView, 20, dataBytes.length)
    writeUint32(centralView, 24, dataBytes.length)
    writeUint16(centralView, 28, nameBytes.length)
    writeUint16(centralView, 30, 0)
    writeUint16(centralView, 32, 0)
    writeUint16(centralView, 34, 0)
    writeUint16(centralView, 36, 0)
    writeUint32(centralView, 38, 0)
    writeUint32(centralView, 42, localOffset)

    centralParts.push(centralHeader, nameBytes)
    localOffset += localHeader.length + nameBytes.length + dataBytes.length
  }

  const localBytes = concatBytes(localParts)
  const centralBytes = concatBytes(centralParts)
  const endOfCentralDirectory = new Uint8Array(22)
  const endView = new DataView(endOfCentralDirectory.buffer)
  writeUint32(endView, 0, 0x06054b50)
  writeUint16(endView, 4, 0)
  writeUint16(endView, 6, 0)
  writeUint16(endView, 8, files.length)
  writeUint16(endView, 10, files.length)
  writeUint32(endView, 12, centralBytes.length)
  writeUint32(endView, 16, localBytes.length)
  writeUint16(endView, 20, 0)

  return concatBytes([localBytes, centralBytes, endOfCentralDirectory])
}

function sanitizeFileName(value: string) {
  const sanitized = value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  const baseName = sanitized || 'dhole-export'
  return baseName.toLowerCase().endsWith('.xlsx') ? baseName : `${baseName}.xlsx`
}

export function downloadExcelWorkbook(options: ExcelWorkbookOptions) {
  const sheets = options.sheets.filter((sheet) => sheet.columns.length > 0)
  if (!sheets.length) return false

  const zip = createZip(workbookFiles(sheets))
  const payload = Uint8Array.from(zip)
  const blob = new Blob([payload.buffer], {
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

function visibleTable(table: HTMLTableElement) {
  if (table.dataset.excelExport === 'false') return false
  const style = window.getComputedStyle(table)
  return style.display !== 'none' && style.visibility !== 'hidden' && table.getClientRects().length > 0
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function cellDisplayValue(cell: HTMLTableCellElement) {
  const formControl = cell.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    'input:not([type="hidden"]), select, textarea',
  )

  if (formControl instanceof HTMLSelectElement) {
    return normalizeText(formControl.selectedOptions[0]?.textContent || formControl.value)
  }
  if (formControl instanceof HTMLInputElement || formControl instanceof HTMLTextAreaElement) {
    return normalizeText(formControl.value || cell.textContent)
  }

  return normalizeText(cell.textContent)
}

function tableTitle(table: HTMLTableElement, pageTitle: string, index: number) {
  const explicit = table.dataset.excelSheet || table.getAttribute('aria-label')
  if (explicit) return explicit

  const container = table.closest('section, article, [role="region"], main, div')
  const heading = container?.querySelector<HTMLElement>('h2, h3, h4')
  const headingText = normalizeText(heading?.textContent)
  return headingText || `${pageTitle} ${index + 1}`
}

export function excelSheetsFromVisibleTables(pageTitle: string) {
  const tables = Array.from(document.querySelectorAll<HTMLTableElement>('table')).filter(visibleTable)

  return tables.flatMap<ExcelSheet>((table, tableIndex) => {
    const headerRow = table.tHead?.rows[table.tHead.rows.length - 1] ?? table.rows[0]
    if (!headerRow) return []

    const headerCells = Array.from(headerRow.cells)
    const exportIndexes = headerCells
      .map((cell, index) => ({ index, label: normalizeText(cell.textContent) || `Columna ${index + 1}` }))
      .filter(({ label }) => !/^(acciones?|actions?)$/i.test(label))

    if (!exportIndexes.length) return []

    const bodyRows = table.tBodies.length
      ? Array.from(table.tBodies).flatMap((body) => Array.from(body.rows))
      : Array.from(table.rows).slice(headerRow.rowIndex + 1)

    const rows = bodyRows.flatMap<Record<string, unknown>>((row) => {
      if (row.cells.length === 1 && row.cells[0]?.colSpan > 1) return []

      const record: Record<string, unknown> = {}
      let hasValue = false
      exportIndexes.forEach(({ index }, exportIndex) => {
        const value = cellDisplayValue(row.cells[index]!)
        record[`column_${exportIndex}`] = value
        if (value) hasValue = true
      })
      return hasValue ? [record] : []
    })

    const columns = exportIndexes.map(({ label }, exportIndex) => ({
      key: `column_${exportIndex}`,
      label,
    }))

    return [
      {
        name: tableTitle(table, pageTitle, tableIndex),
        columns,
        rows,
      },
    ]
  })
}

export function hasVisibleExcelTables() {
  return Array.from(document.querySelectorAll<HTMLTableElement>('table')).some(visibleTable)
}

export function downloadVisibleTablesAsExcel(pageTitle: string) {
  const sheets = excelSheetsFromVisibleTables(pageTitle)
  if (!sheets.length) return false

  const date = new Date().toISOString().slice(0, 10)
  return downloadExcelWorkbook({
    fileName: `${pageTitle}-${date}.xlsx`,
    sheets,
  })
}
