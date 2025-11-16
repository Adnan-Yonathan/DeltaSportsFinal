/**
 * API endpoint for uploading model files
 * Handles CSV, Excel, PDF, and TXT files
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { parseFile, validateFile } from '@/lib/files/parsers'
import type { Database } from '@/lib/supabase/types'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES_PER_MODEL = 5

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const modelId = formData.get('modelId') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!modelId) {
      return NextResponse.json(
        { error: 'Model ID is required' },
        { status: 400 }
      )
    }

    // Verify model ownership
    const { data: model, error: modelError } = await supabase
      .from('custom_models')
      .select('id, user_id')
      .eq('id', modelId)
      .eq('user_id', user.id)
      .single()

    if (modelError || !model) {
      return NextResponse.json(
        { error: 'Model not found or access denied' },
        { status: 404 }
      )
    }

    // Check existing file count
    const { data: existingFiles, error: countError } = await supabase
      .from('model_files')
      .select('id')
      .eq('model_id', modelId)

    if (countError) {
      return NextResponse.json(
        { error: 'Failed to check existing files' },
        { status: 500 }
      )
    }

    if (existingFiles && existingFiles.length >= MAX_FILES_PER_MODEL) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_FILES_PER_MODEL} files per model` },
        { status: 400 }
      )
    }

    // Validate file
    const validation = validateFile(file, MAX_FILE_SIZE)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse file
    const parseResult = await parseFile(buffer, validation.fileType!)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: `Failed to parse file: ${parseResult.error}` },
        { status: 400 }
      )
    }

    // Upload to Supabase Storage
    const timestamp = Date.now()
    const storagePath = `${user.id}/${modelId}/${timestamp}-${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('model-files')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file to storage' },
        { status: 500 }
      )
    }

    // Store file metadata in database
    const { data: fileRecord, error: dbError } = await supabase
      .from('model_files')
      .insert({
        model_id: modelId,
        user_id: user.id,
        file_name: file.name,
        file_type: validation.fileType!,
        file_size: file.size,
        storage_path: storagePath,
        parsed_data: parseResult.data,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // Clean up uploaded file
      await supabase.storage.from('model-files').remove([storagePath])
      return NextResponse.json(
        { error: 'Failed to save file metadata' },
        { status: 500 }
      )
    }

    // Update model's file_metadata array
    const { data: currentModel } = await supabase
      .from('custom_models')
      .select('file_metadata')
      .eq('id', modelId)
      .single()

    const currentMetadata = (currentModel?.file_metadata as any[]) || []
    const newMetadata = [
      ...currentMetadata,
      {
        id: fileRecord.id,
        fileName: file.name,
        fileType: validation.fileType,
        fileSize: file.size,
        storagePath,
        uploadedAt: new Date().toISOString(),
      },
    ]

    await supabase
      .from('custom_models')
      .update({ file_metadata: newMetadata })
      .eq('id', modelId)

    // Return success with parsed preview
    return NextResponse.json({
      success: true,
      file: {
        id: fileRecord.id,
        fileName: file.name,
        fileType: validation.fileType,
        fileSize: file.size,
        preview: parseResult.preview,
        rowCount: parseResult.rowCount,
        columnCount: parseResult.columnCount,
      },
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE endpoint to remove a file
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const fileId = searchParams.get('fileId')

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      )
    }

    // Get file record
    const { data: fileRecord, error: fileError } = await supabase
      .from('model_files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single()

    if (fileError || !fileRecord) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      )
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('model-files')
      .remove([fileRecord.storage_path])

    if (storageError) {
      console.error('Storage deletion error:', storageError)
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('model_files')
      .delete()
      .eq('id', fileId)

    if (dbError) {
      return NextResponse.json(
        { error: 'Failed to delete file record' },
        { status: 500 }
      )
    }

    // Update model's file_metadata array
    const { data: currentModel } = await supabase
      .from('custom_models')
      .select('file_metadata')
      .eq('id', fileRecord.model_id)
      .single()

    if (currentModel) {
      const currentMetadata = (currentModel.file_metadata as any[]) || []
      const newMetadata = currentMetadata.filter((f: any) => f.id !== fileId)

      await supabase
        .from('custom_models')
        .update({ file_metadata: newMetadata })
        .eq('id', fileRecord.model_id)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
