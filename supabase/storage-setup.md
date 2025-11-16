# Supabase Storage Setup for Model Files

## Bucket: `model-files`

### Setup Instructions

1. Go to Supabase Dashboard → Storage
2. Create new bucket: `model-files`
3. Set as **Private** (RLS enabled)
4. Configuration:
   - Max file size: 10MB
   - Allowed MIME types:
     - `text/csv`
     - `application/vnd.ms-excel`
     - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
     - `application/pdf`
     - `text/plain`

### Storage Policies

Run these policies in Supabase SQL Editor:

```sql
-- Allow users to upload files to their own folder
CREATE POLICY "Users can upload own model files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'model-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own files
CREATE POLICY "Users can read own model files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'model-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete own model files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'model-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### Path Structure

Files are stored with the following path pattern:
```
{userId}/{modelId}/{timestamp}-{filename}
```

Example:
```
550e8400-e29b-41d4-a716-446655440000/
  └── abc123-model-id/
      ├── 1700000000000-player-stats.csv
      ├── 1700000001000-team-data.xlsx
      └── 1700000002000-analysis.pdf
```

### File Size Limits

- Individual file: 10MB max
- Total per model: 50MB max (5 files × 10MB)
- Supported formats: CSV, XLSX, PDF, TXT

### Access Pattern

1. User uploads file via `/api/models/upload`
2. API validates file type and size
3. File stored in `model-files/{userId}/{modelId}/{timestamp}-{filename}`
4. Metadata stored in `model_files` table
5. File parsed and `parsed_data` stored in database
6. User can download/view file via signed URL
