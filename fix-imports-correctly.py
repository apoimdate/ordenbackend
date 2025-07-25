#!/usr/bin/env python3

import os
import re
import glob

# Define the base directory
base_dir = 'src'

# Define import patterns to replace
replacements = {
    # @config imports
    r'from\s+[\'"]@config/environment[\'"]': 'from \'../config/environment\'',
    r'from\s+[\'"]@config/database[\'"]': 'from \'../config/database\'',
    r'from\s+[\'"]@config/redis[\'"]': 'from \'../config/redis\'',
    r'from\s+[\'"]@config[\'"]': 'from \'../config\'',
    
    # @services imports
    r'from\s+[\'"]@services/([^\'\"]+)[\'"]': r"from '../services/\1'",
    
    # @middleware imports
    r'from\s+[\'"]@middleware/([^\'\"]+)[\'"]': r"from '../middleware/\1'",
    r'from\s+[\'"]@middleware[\'"]': 'from \'../middleware\'',
    
    # @routes imports
    r'from\s+[\'"]@routes/([^\'\"]+)[\'"]': r"from '../routes/\1'",
    
    # @repositories imports
    r'from\s+[\'"]@repositories/([^\'\"]+)[\'"]': r"from '../repositories/\1'",
    r'from\s+[\'"]@repositories[\'"]': 'from \'../repositories\'',
    
    # @utils imports
    r'from\s+[\'"]@utils/([^\'\"]+)[\'"]': r"from '../utils/\1'",
    
    # @integrations imports
    r'from\s+[\'"]@integrations/([^\'\"]+)[\'"]': r"from '../integrations/\1'",
    
    # @types imports
    r'from\s+[\'"]@types/([^\'\"]+)[\'"]': r"from '../types/\1'",
}

# Special case for files in subdirectories
def get_relative_path(file_path, target_dir):
    """Calculate the relative path from file to target directory"""
    file_dir = os.path.dirname(file_path)
    # Count how many directories up we need to go
    depth = len(file_dir.split('/')) - 1  # -1 because 'src' is the base
    
    if depth == 1:  # Files directly in src/
        return f'./{target_dir}'
    elif depth == 2:  # Files in src/something/
        return f'../{target_dir}'
    elif depth == 3:  # Files in src/something/something/
        return f'../../{target_dir}'
    else:
        return f'../{target_dir}'  # Default to one level up

# Process all TypeScript files
for ts_file in glob.glob('src/**/*.ts', recursive=True):
    print(f"Processing: {ts_file}")
    
    with open(ts_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Apply replacements
    for pattern, replacement in replacements.items():
        content = re.sub(pattern, replacement, content)
    
    # Special handling for different directory levels
    file_depth = len(ts_file.split('/')) - 1
    
    # Adjust paths based on file location
    if file_depth > 2:  # Files in subdirectories need more ../ 
        # Replace '../' with '../../' for deeper files
        content = re.sub(r"from '\.\./(config|services|middleware|routes|repositories|utils|integrations|types)", 
                        r"from '../../\1", content)
    
    # Fix broken import statements (missing quotes)
    content = re.sub(r'from\s+"\.\./(repositories)"([^;])', r'from "../\1"\2', content)
    content = re.sub(r'from\s+\'\.\./(repositories)\'([^;])', r"from '../\1'\2", content)
    
    # Fix auth.service.ts specific issues
    content = re.sub(r'import { (.+) } from "../repositories/(.+)";', r'import { \1 } from "../repositories/\2";', content)
    
    # Write back if changed
    if content != original_content:
        with open(ts_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✓ Fixed imports in {ts_file}")

print("\n✅ All imports fixed!")