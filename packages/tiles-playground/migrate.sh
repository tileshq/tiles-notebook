#!/bin/bash

# This script helps migrate files from the original Lexical playground to the Next.js app
# It copies the files, adds 'use client' to React components, and updates import paths

SOURCE_DIR="../packages/lexical-playground/src"
DEST_BASE_DIR="."

# Create necessary directories if they don't exist
mkdir -p components context hooks images/emoji images/icons nodes plugins themes ui utils shared public

# Function to add 'use client' directive to component files
add_use_client() {
  local file=$1
  if [[ $file == *.tsx || $file == *.jsx ]]; then
    # Check if file is not empty
    if [[ -s $file ]]; then
      # Add 'use client' directive at the top if it doesn't have it already
      if ! grep -q "'use client';" $file && ! grep -q '"use client";' $file; then
        echo "'use client';" > "${file}.tmp"
        echo "" >> "${file}.tmp"
        cat "$file" >> "${file}.tmp"
        mv "${file}.tmp" "$file"
      fi
    fi
  fi
}

# Function to update import paths
update_import_paths() {
  local file=$1
  
  # Update relative imports to absolute imports with @/ prefix
  if [[ $file == *.ts || $file == *.tsx || $file == *.js || $file == *.jsx ]]; then
    # Create a temporary file
    tmp_file="${file}.tmp"
    
    # Replace './context/', '../context/' etc. with '@/context/'
    sed 's/from \(["'"'"']\)\.\.\?\/context\//from \1@\/context\//g' "$file" > "$tmp_file"
    mv "$tmp_file" "$file"
    
    sed 's/from \(["'"'"']\)\.\.\?\/plugins\//from \1@\/plugins\//g' "$file" > "$tmp_file"
    mv "$tmp_file" "$file"
    
    sed 's/from \(["'"'"']\)\.\.\?\/nodes\//from \1@\/nodes\//g' "$file" > "$tmp_file"
    mv "$tmp_file" "$file"
    
    sed 's/from \(["'"'"']\)\.\.\?\/ui\//from \1@\/ui\//g' "$file" > "$tmp_file"
    mv "$tmp_file" "$file"
    
    sed 's/from \(["'"'"']\)\.\.\?\/utils\//from \1@\/utils\//g' "$file" > "$tmp_file"
    mv "$tmp_file" "$file"
    
    sed 's/from \(["'"'"']\)\.\.\?\/hooks\//from \1@\/hooks\//g' "$file" > "$tmp_file"
    mv "$tmp_file" "$file"
    
    sed 's/from \(["'"'"']\)\.\.\?\/themes\//from \1@\/themes\//g' "$file" > "$tmp_file"
    mv "$tmp_file" "$file"
    
    sed 's/from \(["'"'"']\)\.\.\?\/components\//from \1@\/components\//g' "$file" > "$tmp_file"
    mv "$tmp_file" "$file"
    
    # Update shared imports
    sed 's/from \(["'"'"']\)shared\//from \1@\/shared\//g' "$file" > "$tmp_file"
    mv "$tmp_file" "$file"
  fi
}

# Copy shared utilities
echo "Creating shared utilities..."
cp ../packages/shared/src/canUseDOM.ts $DEST_BASE_DIR/shared/
cp ../packages/shared/src/environment.ts $DEST_BASE_DIR/shared/
cp ../packages/shared/src/invariant.ts $DEST_BASE_DIR/shared/
cp $SOURCE_DIR/collaboration.ts $DEST_BASE_DIR/utils/

# Fix environment.ts import
sed 's/from '"'"'shared\/canUseDOM'"'"'/from '"'"'\.\/canUseDOM'"'"'/g' "$DEST_BASE_DIR/shared/environment.ts" > "${DEST_BASE_DIR}/shared/environment.ts.tmp"
mv "${DEST_BASE_DIR}/shared/environment.ts.tmp" "$DEST_BASE_DIR/shared/environment.ts"

# Copy and process context files
echo "Copying context files..."
cp -r $SOURCE_DIR/context/* $DEST_BASE_DIR/context/
find $DEST_BASE_DIR/context -type f -name "*.tsx" -o -name "*.jsx" | while read file; do
  add_use_client "$file"
  update_import_paths "$file"
done

# Copy and process hooks files
echo "Copying hooks files..."
cp -r $SOURCE_DIR/hooks/* $DEST_BASE_DIR/hooks/
find $DEST_BASE_DIR/hooks -type f -name "*.tsx" -o -name "*.jsx" | while read file; do
  add_use_client "$file"
  update_import_paths "$file"
done

# Copy and process nodes files
echo "Copying nodes files..."
cp -r $SOURCE_DIR/nodes/* $DEST_BASE_DIR/nodes/
find $DEST_BASE_DIR/nodes -type f \( -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" -o -name "*.js" \) | while read file; do
  if [[ $file == *.tsx || $file == *.jsx ]]; then
    add_use_client "$file"
  fi
  update_import_paths "$file"
done

# Copy and process plugins files
echo "Copying plugins files..."
cp -r $SOURCE_DIR/plugins/* $DEST_BASE_DIR/plugins/
find $DEST_BASE_DIR/plugins -type f \( -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" -o -name "*.js" \) | while read file; do
  if [[ $file == *.tsx || $file == *.jsx ]]; then
    add_use_client "$file"
  fi
  update_import_paths "$file"
done

# Copy and process themes files
echo "Copying themes files..."
cp -r $SOURCE_DIR/themes/* $DEST_BASE_DIR/themes/
find $DEST_BASE_DIR/themes -type f -name "*.ts" | while read file; do
  update_import_paths "$file"
done

# Copy and process ui files
echo "Copying ui files..."
cp -r $SOURCE_DIR/ui/* $DEST_BASE_DIR/ui/
find $DEST_BASE_DIR/ui -type f \( -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" -o -name "*.js" \) | while read file; do
  if [[ $file == *.tsx || $file == *.jsx ]]; then
    add_use_client "$file"
  fi
  update_import_paths "$file"
done

# Copy and process utils files
echo "Copying utils files..."
cp -r $SOURCE_DIR/utils/* $DEST_BASE_DIR/utils/
find $DEST_BASE_DIR/utils -type f \( -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" -o -name "*.js" \) | while read file; do
  if [[ $file == *.tsx || $file == *.jsx ]]; then
    add_use_client "$file"
  fi
  update_import_paths "$file"
done

# Copy and process Editor.tsx and Settings.tsx
echo "Copying Editor and Settings components..."
cp $SOURCE_DIR/Editor.tsx $DEST_BASE_DIR/components/
cp $SOURCE_DIR/Settings.tsx $DEST_BASE_DIR/components/
add_use_client "$DEST_BASE_DIR/components/Editor.tsx"
add_use_client "$DEST_BASE_DIR/components/Settings.tsx"
update_import_paths "$DEST_BASE_DIR/components/Editor.tsx"
update_import_paths "$DEST_BASE_DIR/components/Settings.tsx"

# Copy app settings
echo "Copying app settings..."
cp $SOURCE_DIR/appSettings.ts $DEST_BASE_DIR/utils/

# Copy images
echo "Copying images..."
cp -r $SOURCE_DIR/images/emoji/* $DEST_BASE_DIR/images/emoji/
cp -r $SOURCE_DIR/images/icons/* $DEST_BASE_DIR/images/icons/
cp -r $SOURCE_DIR/images/icon.png $DEST_BASE_DIR/public/icon.png

# Create stubs for window object in collaboration.ts
echo "Updating collaboration.ts for Next.js..."
sed 's/const url = new URL(window.location.href);/const getWebsocketEndpoint = (): string => {\n  if (typeof window !== "undefined") {\n    const url = new URL(window.location.href);\n    const params = new URLSearchParams(url.search);\n    return params.get("collabEndpoint") || "ws:\/\/localhost:1234";\n  }\n  return "ws:\/\/localhost:1234";\n};\n\nconst getWebsocketId = (): string => {\n  if (typeof window !== "undefined") {\n    const url = new URL(window.location.href);\n    const params = new URLSearchParams(url.search);\n    return params.get("collabId") || "0";\n  }\n  return "0";\n};\n\nconst WEBSOCKET_ENDPOINT = getWebsocketEndpoint();\nconst WEBSOCKET_SLUG = "playground";\nconst WEBSOCKET_ID = getWebsocketId();/g' "$DEST_BASE_DIR/utils/collaboration.ts" > "${DEST_BASE_DIR}/utils/collaboration.ts.tmp"
mv "${DEST_BASE_DIR}/utils/collaboration.ts.tmp" "$DEST_BASE_DIR/utils/collaboration.ts"

# Add 'use client' to collaboration.ts
echo "'use client';" > "${DEST_BASE_DIR}/utils/collaboration.ts.tmp"
echo "" >> "${DEST_BASE_DIR}/utils/collaboration.ts.tmp"
cat "$DEST_BASE_DIR/utils/collaboration.ts" >> "${DEST_BASE_DIR}/utils/collaboration.ts.tmp"
mv "${DEST_BASE_DIR}/utils/collaboration.ts.tmp" "$DEST_BASE_DIR/utils/collaboration.ts"

echo "Migration complete!"
echo "You'll need to run 'npm install' in the nextjs-lexical-full directory to install dependencies."
echo "Then run 'npm run dev' to start the development server."