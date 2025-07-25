#!/usr/bin/env python3
import os
import re

def fix_imports(file_path):
    """Fix various import issues in TypeScript files"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Fix cache import duplication
        content = re.sub(
            r"import { cache } from '../utils/cache';\s*import { cache } from '../utils/cache';",
            "import { cache } from '../utils/cache';",
            content
        )
        
        # Fix repository import issues
        content = re.sub(
            r'import { cache } from \'../utils/cache\';\n} from "../repositories"; // TODO: Fix repository imports',
            '} from "../repositories"; // TODO: Fix repository imports\nimport { cache } from \'../utils/cache\';',
            content
        )
        
        # Fix malformed imports with missing commas
        content = re.sub(
            r'import { ([^,}]+) ([^,}]+) } from',
            r'import { \1, \2 } from',
            content
        )
        
        # Fix cart service import
        content = re.sub(
            r"import { FastifyInstance FastifyRequest }",
            "import { FastifyInstance, FastifyRequest }",
            content
        )
        
        # Only write if changes were made
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Fixed: {file_path}")
            return True
        return False
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    fixed_count = 0
    
    # Fix service files
    services_dir = './src/services'
    for filename in os.listdir(services_dir):
        if filename.endswith('.service.ts'):
            file_path = os.path.join(services_dir, filename)
            if fix_imports(file_path):
                fixed_count += 1
    
    # Fix route files
    routes_dir = './src/routes'
    for filename in os.listdir(routes_dir):
        if filename.endswith('.routes.ts'):
            file_path = os.path.join(routes_dir, filename)
            if fix_imports(file_path):
                fixed_count += 1
    
    print(f"\nTotal files fixed: {fixed_count}")

if __name__ == "__main__":
    main()