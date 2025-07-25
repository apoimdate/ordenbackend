#!/usr/bin/env python3

import os
import re
import glob

def fix_file(file_path):
    """Fix various TypeScript errors in a file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Fix unterminated string literals (quotes at end of import statements)
    content = re.sub(r'from "([^"]+)";', r'from "\1";', content)
    content = re.sub(r"from '([^']+)';", r"from '\1';", content)
    
    # Fix _request/_reply parameter issues
    # Find function parameters with underscore but used without underscore
    content = re.sub(
        r'async \(_request: FastifyRequest, _reply: FastifyReply\) =>',
        r'async (request: FastifyRequest, reply: FastifyReply) =>',
        content
    )
    
    # Fix similar patterns in function definitions
    content = re.sub(
        r'function\s+\w+\([^)]*_request:\s*FastifyRequest[^)]*_reply:\s*FastifyReply[^)]*\)',
        lambda m: m.group(0).replace('_request', 'request').replace('_reply', 'reply'),
        content
    )
    
    # Fix imports that have wrong relative paths
    # Fix ../../repositories to ../repositories for service files
    if '/services/' in file_path:
        content = re.sub(r'from "../../repositories', r'from "../repositories', content)
        content = re.sub(r"from '../../repositories", r"from '../repositories", content)
    
    # Fix imports that are missing proper extensions or paths
    # Fix logger imports
    content = re.sub(r'from ["\']\./../utils/logger["\']', r"from '../utils/logger'", content)
    content = re.sub(r'from ["\']\./../utils/([^"\']+)["\']', r"from '../utils/\1'", content)
    
    # Fix config imports with proper paths
    content = re.sub(r'from ["\']\.\./(config/[^"\']+)["\']', r"from '../\1'", content)
    
    # Fix TypeScript type issues
    # Fix 'any' type usage where we can infer better types
    # This is more complex and would need careful analysis
    
    # Fix unused variables by adding underscore prefix
    # Find common patterns of unused variables
    unused_patterns = [
        (r'catch\s*\(\s*error\s*\)\s*{\s*}', r'catch (_error) {}'),
        (r'catch\s*\(\s*err\s*\)\s*{\s*}', r'catch (_err) {}'),
        (r'\.then\s*\(\s*result\s*\)\s*{\s*}', r'.then(_result) {}'),
    ]
    
    for pattern, replacement in unused_patterns:
        content = re.sub(pattern, replacement, content)
    
    # Write back if changed
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

# Process all TypeScript files
fixed_count = 0
for ts_file in glob.glob('src/**/*.ts', recursive=True):
    if fix_file(ts_file):
        print(f"✓ Fixed {ts_file}")
        fixed_count += 1

print(f"\n✅ Fixed {fixed_count} files!")