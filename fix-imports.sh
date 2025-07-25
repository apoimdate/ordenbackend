#!/bin/bash

# Fix imports in all repository files
for file in src/repositories/*.repository.ts; do
  if [ "$file" != "src/repositories/base.repository.ts" ]; then
    # Remove any existing import of FindOptionsWithoutWhere
    sed -i '/import.*FindOptionsWithoutWhere/d' "$file"
    
    # Add the correct import after the first import statement
    # Find the line number of the first import
    first_import_line=$(grep -n "^import" "$file" | head -1 | cut -d: -f1)
    
    if [ ! -z "$first_import_line" ]; then
      # Insert the import after the first import
      sed -i "${first_import_line}a import { FindOptionsWithoutWhere } from './base.repository';" "$file"
    else
      # If no imports exist, add at the beginning
      sed -i "1i import { FindOptionsWithoutWhere } from './base.repository';" "$file"
    fi
    
    echo "Fixed import in: $file"
  fi
done

echo "All imports have been fixed!"