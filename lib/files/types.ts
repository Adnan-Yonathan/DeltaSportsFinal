/**
 * Type definitions for model file uploads
 */

import { FileType } from './parsers'

export interface ModelFileMetadata {
  id: string
  fileName: string
  fileType: FileType
  fileSize: number
  storagePath: string
  uploadedAt: string
}

export interface ModelFileRow {
  id: string
  model_id: string
  user_id: string
  file_name: string
  file_type: FileType
  file_size: number
  storage_path: string
  parsed_data: any
  created_at: string
}

export interface ModelFileInsert {
  model_id: string
  user_id: string
  file_name: string
  file_type: FileType
  file_size: number
  storage_path: string
  parsed_data?: any
}

export interface UploadedFile {
  file: File
  id: string
  preview?: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  parsedData?: any
}
