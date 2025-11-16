# Custom GPT-Style Model Creation - Implementation Complete

## Overview

The custom model creation system has been upgraded from conversation-based to manual, form-based creation similar to ChatGPT's custom GPTs. Users can now:

- Create models manually with a form-based wizard
- Add custom instructions (system prompts) that guide AI behavior
- Upload data files (CSV, Excel, PDF, TXT) for context
- Manage models through a dedicated dashboard

## What Was Implemented

### ✅ Core Features Completed

1. **Database Schema**
   - Added `description`, `instructions`, and `file_metadata` columns to `custom_models` table
   - Created `model_files` table for file storage metadata
   - Migration file: `supabase/migrations/20251116_add_model_files_and_instructions.sql`

2. **File Upload Infrastructure**
   - File parsing utilities for CSV, Excel, PDF, and TXT files
   - Upload API endpoint: `/api/models/upload` (POST/DELETE)
   - Support for up to 5 files per model, 10MB each
   - Automatic parsing and preview generation
   - Files: `lib/files/parsers.ts`, `lib/files/types.ts`

3. **Model Creation UI**
   - Manual creation page: `/models/new`
   - Form fields:
     - Model name (required)
     - Description (optional)
     - Custom instructions (optional)
     - Model type (Prediction/Research)
     - Sport, market, and configuration settings
     - File upload zone (drag-and-drop)
   - File: `app/models/new/page.tsx`

4. **Model Management Dashboard**
   - Dashboard page: `/models`
   - Features:
     - Grid view of all models
     - Search and filter (All/Prediction/Research)
     - Model cards with description, instructions preview, file count
     - Create Model and View All buttons
   - File: `app/models/page.tsx`

5. **Navigation Updates**
   - Added "Create" button in sidebar → links to `/models/new`
   - Added "View All" button → links to `/models` dashboard
   - File: `components/ModernSidebar.tsx`

6. **AI Integration with Custom Instructions & Files**
   - Model runner now loads and injects:
     - Custom instructions into system prompt
     - Uploaded file data into user message
   - CSV/Excel files: Formatted as tables with previews
   - PDF/TXT files: Included as text context
   - File: `lib/models/model-runner.ts`

## How It Works

### Creating a Model

1. User clicks "Create" in sidebar or navigates to `/models/new`
2. Fills out form:
   ```
   Model Name: "NBA Pace Model"
   Description: "Analyzes teams based on pace-adjusted efficiency"
   Instructions: "Focus on pace metrics, prioritize last 10 games..."
   Sport: NBA
   Market: Totals
   Confidence: 90%
   ```
3. Submits form → Model created in database
4. Optionally uploads files:
   - `team_stats.csv` → Parsed as JSON array
   - `analysis.pdf` → Text extracted
5. Files stored in Supabase Storage at:
   ```
   model-files/{userId}/{modelId}/{timestamp}-{filename}
   ```

### Using a Model with Custom Instructions & Files

When a user runs the model in chat:

1. **Model Loading**
   ```typescript
   const model = await getCustomModel(modelId)
   ```

2. **File Loading** (automatic)
   ```typescript
   const files = await supabase
     .from('model_files')
     .select('*')
     .eq('model_id', modelId)
   ```

3. **AI Prompt Construction**
   ```
   System Message:
   "You are DELTA's advanced statistical engine...

   ## Custom Model Instructions:
   {model.instructions}

   Apply these instructions when analyzing data..."

   User Message:
   "Projection request:
   {model config, stats, breakdown}

   ## Uploaded Reference Data:

   ### File: team_stats.csv (csv)
   Columns: team, pace, offensive_rating, defensive_rating
   Sample data (first 10 rows):
   [...]

   Use this uploaded data as additional context..."
   ```

4. **Result Generation**
   - GPT-5 analyzes with custom instructions
   - References uploaded file data
   - Returns projection with confidence intervals

## File Structure

```
DeltaSportsFinal/
├── app/
│   ├── api/
│   │   └── models/
│   │       └── upload/
│   │           └── route.ts              # File upload API
│   └── models/
│       ├── page.tsx                      # Dashboard
│       └── new/
│           └── page.tsx                  # Creation form
├── components/
│   ├── ModernSidebar.tsx                 # Updated with Create/View All buttons
│   └── models/
│       └── FileUploadZone.tsx            # Drag-drop file upload
├── lib/
│   ├── files/
│   │   ├── parsers.ts                    # File parsing utilities
│   │   └── types.ts                      # File type definitions
│   ├── models/
│   │   └── model-runner.ts               # Updated with instructions/files injection
│   └── supabase/
│       └── types.ts                      # Updated database types
└── supabase/
    ├── migrations/
    │   └── 20251116_add_model_files_and_instructions.sql
    └── storage-setup.md                  # Storage bucket documentation
```

## Database Schema

### custom_models (Updated)
```sql
id UUID PRIMARY KEY
user_id UUID
model_name TEXT
description TEXT                    -- NEW
instructions TEXT                   -- NEW
file_metadata JSONB                 -- NEW
sport_key TEXT
market_type TEXT
target_metric TEXT
confidence_level NUMERIC
config JSONB
model_type TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### model_files (New)
```sql
id UUID PRIMARY KEY
model_id UUID REFERENCES custom_models(id)
user_id UUID
file_name TEXT
file_type TEXT ('csv'|'xlsx'|'pdf'|'txt')
file_size INTEGER
storage_path TEXT
parsed_data JSONB
created_at TIMESTAMPTZ
```

## Supabase Storage

### Bucket: `model-files`
- **Access**: Private (RLS enabled)
- **Max file size**: 10MB
- **Allowed types**: CSV, XLSX, PDF, TXT
- **Path structure**: `{userId}/{modelId}/{timestamp}-{filename}`

### RLS Policies
```sql
-- Users can upload to their own folder
CREATE POLICY "Users can upload own model files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'model-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can read their own files
CREATE POLICY "Users can read own model files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'model-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

## API Endpoints

### POST `/api/models/upload`
Upload a file to a model

**Request**:
```typescript
FormData {
  file: File
  modelId: string
}
```

**Response**:
```json
{
  "success": true,
  "file": {
    "id": "uuid",
    "fileName": "team_stats.csv",
    "fileType": "csv",
    "fileSize": 12345,
    "preview": "| team | pace | ... |\n| --- | --- | ... |",
    "rowCount": 30,
    "columnCount": 5
  }
}
```

### DELETE `/api/models/upload?fileId={uuid}`
Delete an uploaded file

**Response**:
```json
{
  "success": true
}
```

## Usage Example

### 1. Create Model via UI

Navigate to `/models/new`:

```typescript
// Form Data
{
  modelName: "NBA Pace Model",
  description: "Predicts totals using pace-adjusted metrics",
  instructions: `
    When analyzing teams:
    1. Prioritize pace-adjusted offensive/defensive ratings
    2. Weight recent games (last 10) more heavily
    3. Consider home/away splits
    4. Factor in back-to-back situations
  `,
  sportKey: "basketball_nba",
  marketType: "totals",
  targetMetric: "total_points",
  confidenceLevel: 0.90
}
```

Upload file: `nba_advanced_stats.csv`

### 2. Run Model in Chat

```
User: "Apply my NBA Pace Model to Lakers vs Celtics"

DELTA: *loads model + files*
- Custom instructions: "Prioritize pace-adjusted metrics..."
- Uploaded data: nba_advanced_stats.csv (30 teams)

*Generates projection using custom logic*

Result:
- Point Estimate: 226.5 total points
- Range: 220.3 - 232.7 (90% confidence)
- Key Drivers: Lakers pace (101.2), Celtics defense (107.8 rating)
- Analysis: "Based on your custom pace model and uploaded stats..."
```

## Key Differences from Conversation-Based Creation

| Feature | Old (Conversation) | New (Manual) |
|---------|-------------------|--------------|
| Creation Method | Chat with AI | Form wizard |
| Instructions | Implicit in chat | Explicit custom field |
| Data Upload | None | CSV, Excel, PDF, TXT |
| UI/UX | Q&A in chat | Visual form |
| Editing | Recreate via chat | Edit page (future) |
| Management | Sidebar list only | Full dashboard |
| File Context | None | Injected into AI prompts |
| Discovery | Ask "create model" | Navigate to /models/new |

## Migration Notes

### Existing Models
- **Backward compatible**: Conversation-created models continue to work
- **No breaking changes**: Models without instructions/files use default behavior
- **Gradual migration**: Users can upgrade models by editing them (future feature)

### Running the Migration

1. **Apply Database Migration**
   ```bash
   # In Supabase dashboard, run:
   supabase/migrations/20251116_add_model_files_and_instructions.sql
   ```

2. **Create Storage Bucket**
   - Go to Supabase Dashboard → Storage
   - Create bucket: `model-files` (Private)
   - Apply RLS policies from `supabase/storage-setup.md`

3. **Install Dependencies**
   ```bash
   npm install papaparse xlsx pdf-parse
   npm install --save-dev @types/papaparse @types/pdf-parse
   ```

4. **Deploy**
   ```bash
   npm run build
   npm run start
   ```

## Testing Checklist

- [ ] Create new model via `/models/new`
- [ ] Upload CSV file (verify parsing)
- [ ] Upload Excel file (verify parsing)
- [ ] Upload PDF file (verify text extraction)
- [ ] Upload TXT file
- [ ] Delete uploaded file
- [ ] View models in `/models` dashboard
- [ ] Search and filter models
- [ ] Run model in chat without files (verify backward compatibility)
- [ ] Run model in chat with custom instructions
- [ ] Run model in chat with uploaded files
- [ ] Verify AI uses custom instructions in response
- [ ] Verify AI references uploaded file data
- [ ] Click "Create" button in sidebar
- [ ] Click "View All" button in sidebar

## Future Enhancements (Optional)

### Model Templates
Pre-built templates users can start from:
```typescript
const templates = {
  "NBA Pace Model": {
    instructions: "...",
    suggestedFiles: ["team_stats.csv"],
    config: {...}
  },
  "Pinnacle Line Comparison": {...},
  "Player Props Analyzer": {...}
}
```

### Edit Model Page
`/models/[id]/edit` - Allow users to:
- Update instructions
- Add/remove files
- Modify configuration
- Preserve existing data

### Migration Tool
`/models/import` - Convert conversation-created models:
- List old models
- One-click upgrade
- Add instructions/files retroactively

## Support

If you encounter issues:

1. Check browser console for errors
2. Verify Supabase storage bucket is created
3. Ensure RLS policies are applied
4. Check file size limits (10MB max)
5. Verify supported file types (CSV, XLSX, PDF, TXT only)

## Summary

The custom model creation system now offers ChatGPT-style flexibility:

✅ **Manual creation** with form-based wizard
✅ **Custom instructions** to guide AI behavior
✅ **File uploads** for context and data
✅ **Dashboard** for model management
✅ **Backward compatible** with existing models
✅ **AI integration** automatically injects instructions and files

Users can create sophisticated, personalized models with their own data and analysis approach, making the platform significantly more powerful and customizable.
