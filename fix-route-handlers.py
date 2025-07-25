#!/usr/bin/env python3

import os
import re
import glob

def fix_route_files_comprehensive():
    """Fix all route handler issues comprehensively"""
    route_files = glob.glob('src/routes/*.ts')
    
    for route_file in route_files:
        print(f"\nProcessing {route_file}...")
        with open(route_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Step 1: Ensure imports
        if 'FastifyRequest' not in content or 'FastifyReply' not in content:
            # Check if fastify is already imported
            if 'from \'fastify\'' in content:
                # Add to existing import
                content = re.sub(
                    r'import\s*{\s*([^}]+)\s*}\s*from\s*[\'"]fastify[\'"]',
                    lambda m: f'import {{ {m.group(1)}, FastifyRequest, FastifyReply }} from \'fastify\'',
                    content,
                    count=1
                )
            else:
                # Add new import
                content = 'import { FastifyRequest, FastifyReply } from \'fastify\';\n' + content
        
        # Step 2: Fix all route handler patterns
        # Pattern 1: Routes with middleware arrays
        content = re.sub(
            r'(\.(get|post|put|patch|delete)\s*\([^,]+,\s*\[[^\]]+\],\s*)async\s*\(\s*\)\s*=>',
            r'\1async (request: FastifyRequest, reply: FastifyReply) =>',
            content
        )
        
        # Pattern 2: Routes without middleware
        content = re.sub(
            r'(\.(get|post|put|patch|delete)\s*\([^,)]+,\s*)async\s*\(\s*\)\s*=>',
            r'\1async (request: FastifyRequest, reply: FastifyReply) =>',
            content
        )
        
        # Pattern 3: Routes with object schemas
        content = re.sub(
            r'(\.(get|post|put|patch|delete)\s*\({[^}]+},\s*)async\s*\(\s*\)\s*=>',
            r'\1async (request: FastifyRequest, reply: FastifyReply) =>',
            content
        )
        
        # Pattern 4: Fix incorrectly typed handlers
        content = re.sub(
            r'async\s*\(\s*req\s*:\s*\w+\s*,\s*res\s*:\s*\w+\s*\)',
            r'async (request: FastifyRequest, reply: FastifyReply)',
            content
        )
        
        # Pattern 5: Fix untyped handlers
        content = re.sub(
            r'async\s*\(\s*request\s*,\s*reply\s*\)\s*=>',
            r'async (request: FastifyRequest, reply: FastifyReply) =>',
            content
        )
        
        # Step 3: Special patterns for auth middleware
        # Fix handlers after authenticate middleware
        content = re.sub(
            r'(authenticate,\s*)async\s*\(\s*\)\s*=>',
            r'\1async (request: FastifyRequest, reply: FastifyReply) =>',
            content
        )
        
        # Fix handlers after requireRole
        content = re.sub(
            r'(requireRole\([^)]+\),\s*)async\s*\(\s*\)\s*=>',
            r'\1async (request: FastifyRequest, reply: FastifyReply) =>',
            content
        )
        
        # Fix handlers after requirePermission
        content = re.sub(
            r'(requirePermission\([^)]+\),\s*)async\s*\(\s*\)\s*=>',
            r'\1async (request: FastifyRequest, reply: FastifyReply) =>',
            content
        )
        
        # Step 4: Fix any remaining patterns
        # Look for lines that use request or reply but don't have them as parameters
        lines = content.split('\n')
        for i in range(len(lines)):
            line = lines[i]
            # If line contains request. or reply. but the previous lines don't define them
            if ('request.' in line or 'reply.' in line) and i > 0:
                # Check if this is inside a handler
                prev_lines = '\n'.join(lines[max(0, i-5):i])
                if 'async () =>' in prev_lines or 'async()=>' in prev_lines:
                    # Find and fix the handler definition
                    for j in range(max(0, i-5), i):
                        if 'async () =>' in lines[j] or 'async()=>' in lines[j]:
                            lines[j] = lines[j].replace('async () =>', 'async (request: FastifyRequest, reply: FastifyReply) =>')
                            lines[j] = lines[j].replace('async()=>', 'async (request: FastifyRequest, reply: FastifyReply) =>')
                            break
        
        content = '\n'.join(lines)
        
        # Write back if changed
        if content != original_content:
            with open(route_file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✓ Fixed {route_file}")
            
            # Count fixes
            request_fixes = original_content.count('request.') - content.count('Cannot find name \'request\'')
            reply_fixes = original_content.count('reply.') - content.count('Cannot find name \'reply\'')
            print(f"  Fixed ~{request_fixes} request references, ~{reply_fixes} reply references")

def fix_specific_route_issues():
    """Fix specific known issues in certain route files"""
    
    # Auth routes
    auth_file = 'src/routes/auth.routes.ts'
    if os.path.exists(auth_file):
        with open(auth_file, 'r') as f:
            content = f.read()
        
        # Ensure all handlers have proper signatures
        content = re.sub(
            r'app\.post\([^,]+,\s*async\s*\(request,\s*reply\)\s*=>',
            r'app.post(\1, async (request: FastifyRequest, reply: FastifyReply) =>',
            content
        )
        
        with open(auth_file, 'w') as f:
            f.write(content)
        print(f"✓ Fixed specific issues in {auth_file}")

# Run the fixes
print("Fixing route handler issues comprehensively...")
fix_route_files_comprehensive()
fix_specific_route_issues()
print("\n✅ Route handler fixes complete!")