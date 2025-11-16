'use client'

import { useCallback, useState } from 'react'
import { Upload, X, FileIcon, Loader2 } from 'lucide-react'
import { formatFileSize, getFileTypeIcon } from '@/lib/files/parsers'

interface UploadedFileInfo {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  preview?: string
  error?: string
}

interface FileUploadZoneProps {
  modelId?: string
  maxFiles?: number
  onFilesChange?: (files: UploadedFileInfo[]) => void
  existingFiles?: UploadedFileInfo[]
}

export function FileUploadZone({
  modelId,
  maxFiles = 5,
  onFilesChange,
  existingFiles = [],
}: FileUploadZoneProps) {
  const [files, setFiles] = useState<UploadedFileInfo[]>(existingFiles)
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)

      const droppedFiles = Array.from(e.dataTransfer.files)
      handleFiles(droppedFiles)
    },
    [files, maxFiles]
  )

  const handleFiles = async (newFiles: File[]) => {
    if (files.length + newFiles.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`)
      return
    }

    const fileInfos: UploadedFileInfo[] = newFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: 'pending' as const,
    }))

    const updatedFiles = [...files, ...fileInfos]
    setFiles(updatedFiles)
    onFilesChange?.(updatedFiles)

    // If modelId exists, upload files immediately
    if (modelId) {
      for (const fileInfo of fileInfos) {
        await uploadFile(fileInfo)
      }
    }
  }

  const uploadFile = async (fileInfo: UploadedFileInfo) => {
    if (!modelId) return

    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileInfo.id ? { ...f, status: 'uploading' } : f
      )
    )

    try {
      const formData = new FormData()
      formData.append('file', fileInfo.file)
      formData.append('modelId', modelId)

      const response = await fetch('/api/models/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const result = await response.json()

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileInfo.id
            ? { ...f, status: 'success', preview: result.file.preview }
            : f
        )
      )
    } catch (error: any) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileInfo.id
            ? { ...f, status: 'error', error: error.message }
            : f
        )
      )
    }
  }

  const removeFile = async (fileId: string) => {
    const fileToRemove = files.find((f) => f.id === fileId)
    if (!fileToRemove) return

    // If file was successfully uploaded, delete from server
    if (fileToRemove.status === 'success' && modelId) {
      try {
        await fetch(`/api/models/upload?fileId=${fileId}`, {
          method: 'DELETE',
        })
      } catch (error) {
        console.error('Failed to delete file:', error)
      }
    }

    const updatedFiles = files.filter((f) => f.id !== fileId)
    setFiles(updatedFiles)
    onFilesChange?.(updatedFiles)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    handleFiles(selectedFiles)
    e.target.value = '' // Reset input
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
              : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
          }
          ${files.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onClick={() => {
          if (files.length < maxFiles) {
            document.getElementById('file-input')?.click()
          }
        }}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {isDragging ? 'Drop files here' : 'Drop files or click to upload'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          CSV, Excel, PDF, or TXT files (max {maxFiles} files, 10MB each)
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {files.length} / {maxFiles} files uploaded
        </p>
        <input
          id="file-input"
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.pdf,.txt"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((fileInfo) => (
            <div
              key={fileInfo.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <span className="text-2xl flex-shrink-0">
                  {getFileTypeIcon(fileInfo.file.name.split('.').pop() as any)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {fileInfo.file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(fileInfo.file.size)}
                    {fileInfo.status === 'uploading' && ' - Uploading...'}
                    {fileInfo.status === 'success' && ' - ✓ Uploaded'}
                    {fileInfo.status === 'error' && ` - Error: ${fileInfo.error}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {fileInfo.status === 'uploading' && (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                )}
                {fileInfo.status === 'success' && (
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                )}
                {fileInfo.status === 'error' && (
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                )}
                <button
                  onClick={() => removeFile(fileInfo.id)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  disabled={fileInfo.status === 'uploading'}
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
