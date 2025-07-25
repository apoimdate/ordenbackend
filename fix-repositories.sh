#!/bin/bash

# Fix all repository files
for file in src/repositories/*.repository.ts; do
  if [ "$file" != "src/repositories/base.repository.ts" ]; then
    # Replace Omit<FindOptions, 'where'> with FindOptionsWithoutWhere
    sed -i "s/Omit<FindOptions, 'where'>/FindOptionsWithoutWhere/g" "$file"
    
    # Add import at the beginning of the file if not present
    if ! grep -q "FindOptionsWithoutWhere" "$file"; then
      # Add the import after the first line
      sed -i "2i import { FindOptionsWithoutWhere } from './base.repository';" "$file"
    fi
    
    # Remove the problematic spread operations
    sed -i 's/\.\.\.options?.where,//g' "$file"
    sed -i 's/\.\.\.options?.where//g' "$file"
    
    echo "Fixed: $file"
  fi
done

echo "All repository files have been fixed!"