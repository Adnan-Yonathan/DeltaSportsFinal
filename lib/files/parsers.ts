/**
 * File parsing utilities for model file uploads
 * Supports CSV, Excel, PDF, and TXT files
 */

import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export type FileType = 'csv' | 'xlsx' | 'pdf' | 'txt'

export interface ParsedFileResult {
  success: boolean
  data?: any
  error?: string
  preview?: string
  rowCount?: number
  columnCount?: number
}

/**
 * Parse CSV file to JSON array
 */
export async function parseCSV(buffer: Buffer): Promise<ParsedFileResult> {
  try {
    const text = buffer.toString('utf-8')

    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      transformHeader: (header) => header.trim(),
    })

    if (result.errors.length > 0) {
      return {
        success: false,
        error: `CSV parsing errors: ${result.errors.map(e => e.message).join(', ')}`,
      }
    }

    const data = result.data as Array<Record<string, any>>
    const preview = generateTablePreview(data)

    return {
      success: true,
      data,
      preview,
      rowCount: data.length,
      columnCount: result.meta.fields?.length || 0,
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to parse CSV: ${error.message}`,
    }
  }
}

/**
 * Parse Excel file (XLSX) to JSON array
 */
export async function parseExcel(buffer: Buffer): Promise<ParsedFileResult> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    // Use first sheet
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return {
        success: false,
        error: 'Excel file has no sheets',
      }
    }

    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, {
      defval: null,
      blankrows: false,
    }) as Array<Record<string, any>>

    if (data.length === 0) {
      return {
        success: false,
        error: 'Excel sheet is empty',
      }
    }

    const preview = generateTablePreview(data)
    const columnCount = Object.keys(data[0] || {}).length

    return {
      success: true,
      data,
      preview,
      rowCount: data.length,
      columnCount,
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to parse Excel: ${error.message}`,
    }
  }
}

/**
 * Parse PDF file to extract text content
 */
export async function parsePDF(buffer: Buffer): Promise<ParsedFileResult> {
  try {
    // Dynamic import for pdf-parse (server-side only)
    const pdfParseModule: any = await import('pdf-parse')
    const pdfParse = pdfParseModule.default || pdfParseModule
    const data = await pdfParse(buffer)

    const text = data.text.trim()
    if (!text) {
      return {
        success: false,
        error: 'PDF contains no extractable text',
      }
    }

    // Create a preview (first 500 characters)
    const preview = text.length > 500
      ? text.substring(0, 500) + '...'
      : text

    return {
      success: true,
      data: {
        text,
        pages: data.numpages,
        info: data.info,
      },
      preview,
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to parse PDF: ${error.message}`,
    }
  }
}

/**
 * Parse plain text file
 */
export async function parseText(buffer: Buffer): Promise<ParsedFileResult> {
  try {
    const text = buffer.toString('utf-8').trim()

    if (!text) {
      return {
        success: false,
        error: 'Text file is empty',
      }
    }

    // Create a preview (first 500 characters)
    const preview = text.length > 500
      ? text.substring(0, 500) + '...'
      : text

    const lineCount = text.split('\n').length

    return {
      success: true,
      data: { text, lineCount },
      preview,
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to parse text file: ${error.message}`,
    }
  }
}

/**
 * Generate markdown table preview from data array
 */
function generateTablePreview(data: Array<Record<string, any>>, maxRows = 5): string {
  if (!data || data.length === 0) return 'No data'

  const headers = Object.keys(data[0])
  const previewRows = data.slice(0, maxRows)

  // Create markdown table
  let markdown = '| ' + headers.join(' | ') + ' |\n'
  markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n'

  for (const row of previewRows) {
    const values = headers.map(h => {
      const val = row[h]
      if (val === null || val === undefined) return ''
      if (typeof val === 'number') return val.toFixed(2)
      return String(val)
    })
    markdown += '| ' + values.join(' | ') + ' |\n'
  }

  if (data.length > maxRows) {
    markdown += `\n*Showing ${maxRows} of ${data.length} rows*`
  }

  return markdown
}

/**
 * Main parser function that routes to appropriate parser based on file type
 */
export async function parseFile(
  buffer: Buffer,
  fileType: FileType
): Promise<ParsedFileResult> {
  switch (fileType) {
    case 'csv':
      return parseCSV(buffer)
    case 'xlsx':
      return parseExcel(buffer)
    case 'pdf':
      return parsePDF(buffer)
    case 'txt':
      return parseText(buffer)
    default:
      return {
        success: false,
        error: `Unsupported file type: ${fileType}`,
      }
  }
}

/**
 * Validate file before parsing
 */
export function validateFile(
  file: File,
  maxSizeBytes = 10 * 1024 * 1024 // 10MB default
): { valid: boolean; error?: string; fileType?: FileType } {
  // Check file size
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeBytes / 1024 / 1024}MB limit`,
    }
  }

  // Check file type
  const extension = file.name.split('.').pop()?.toLowerCase()
  let fileType: FileType | undefined

  switch (extension) {
    case 'csv':
      fileType = 'csv'
      break
    case 'xlsx':
    case 'xls':
      fileType = 'xlsx'
      break
    case 'pdf':
      fileType = 'pdf'
      break
    case 'txt':
      fileType = 'txt'
      break
    default:
      return {
        valid: false,
        error: 'Unsupported file type. Please upload CSV, XLSX, PDF, or TXT files.',
      }
  }

  return { valid: true, fileType }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Get file type icon/emoji
 */
export function getFileTypeIcon(fileType: FileType): string {
  switch (fileType) {
    case 'csv':
      return '📊'
    case 'xlsx':
      return '📈'
    case 'pdf':
      return '📄'
    case 'txt':
      return '📝'
    default:
      return '📁'
  }
}
