#!/usr/bin/env python3

import os
import re
import glob

def fix_duplicate_imports():
    """Fix duplicate imports in all files"""
    all_files = glob.glob('src/**/*.ts', recursive=True)
    
    for file_path in all_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        
        # Fix duplicate FastifyRequest imports
        content = re.sub(
            r'import\s*{\s*([^}]*?)\s*,\s*FastifyRequest\s*,\s*FastifyRequest\s*,\s*FastifyReply\s*}\s*from\s*[\'"]fastify[\'"]',
            r'import { \1, FastifyRequest, FastifyReply } from \'fastify\'',
            content
        )
        
        # Fix any other duplicate imports
        content = re.sub(
            r'import\s*{\s*([^}]*?)\s*,\s*(\w+)\s*,\s*\2\s*([^}]*?)}\s*from',
            r'import { \1, \2 \3} from',
            content
        )
        
        if content != original:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✓ Fixed duplicate imports in: {file_path}")

def fix_missing_types():
    """Add missing type definitions"""
    
    # Fix cache import
    cache_files = ['src/services/product.service.ts', 'src/services/order.service.ts', 
                   'src/services/shipping.service.ts', 'src/services/analytics.service.ts',
                   'src/services/category.service.ts', 'src/services/seller.service.ts',
                   'src/services/cart.service.ts']
    
    for file_path in cache_files:
        if os.path.exists(file_path):
            with open(file_path, 'r') as f:
                content = f.read()
            
            # Fix cache import
            if 'from \'./../utils/cache\'' in content:
                content = content.replace('from \'./../utils/cache\'', 'from \'../utils/cache\'')
            
            # If cache is used but not imported
            if 'cache.' in content and 'import.*cache' not in content:
                # Add import after other imports
                lines = content.split('\n')
                import_added = False
                for i, line in enumerate(lines):
                    if line.startswith('import') and not import_added:
                        continue
                    elif not line.startswith('import') and not import_added and i > 0:
                        lines.insert(i, "import { cache } from '../utils/cache';")
                        import_added = True
                        break
                content = '\n'.join(lines)
            
            with open(file_path, 'w') as f:
                f.write(content)
            print(f"✓ Fixed cache imports in: {file_path}")

def fix_unused_variables():
    """Prefix unused variables with underscore"""
    all_files = glob.glob('src/**/*.ts', recursive=True)
    
    common_patterns = [
        # Unused error variables in catch blocks
        (r'catch\s*\(\s*error\s*\)\s*{\s*logger', r'catch (_error) { logger'),
        (r'catch\s*\(\s*err\s*\)\s*{\s*logger', r'catch (_err) { logger'),
        (r'catch\s*\(\s*e\s*\)\s*{\s*logger', r'catch (_e) { logger'),
        # Unused in empty catches
        (r'catch\s*\(\s*error\s*\)\s*{\s*}', r'catch (_error) {}'),
        (r'catch\s*\(\s*err\s*\)\s*{\s*}', r'catch (_err) {}'),
        # Unused function parameters
        (r',\s*dateRange\s*\)\s*{\s*//.*dateRange not used', r', _dateRange) { //'),
        (r'async\s+\w+\(([^,)]+),\s*([^,)]+)\)\s*{\s*//.*\2 not used', lambda m: f'async {m.group(0).split("(")[0]}({m.group(1)}, _{m.group(2)}) {{ //'),
    ]
    
    for file_path in all_files:
        with open(file_path, 'r') as f:
            content = f.read()
        
        original = content
        
        for pattern, replacement in common_patterns:
            content = re.sub(pattern, replacement, content)
        
        if content != original:
            with open(file_path, 'w') as f:
                f.write(content)
            print(f"✓ Fixed unused variables in: {file_path}")

def fix_prisma_types():
    """Fix Prisma type mismatches"""
    
    # User service specific fixes
    user_service = 'src/services/user.service.ts'
    if os.path.exists(user_service):
        with open(user_service, 'r') as f:
            content = f.read()
        
        # Fix postalCode/zipCode in address creation
        content = re.sub(
            r'(await this\.prisma\.address\.create\(\{[^}]*?)(postalCode:\s*[^,\n]+,)([^}]*?\})',
            lambda m: f'{m.group(1)}{m.group(2)}\n          zipCode: data.postalCode,{m.group(3)}',
            content,
            flags=re.DOTALL
        )
        
        # Fix account deletion status field
        content = re.sub(
            r'status:\s*[\'"]PENDING[\'"]\s*,\s*//.*not in schema',
            r'// status: \'PENDING\', // not in schema',
            content
        )
        
        # Fix format field in data export
        content = re.sub(
            r'format:\s*data\.format\s*\|\|\s*[\'"]JSON[\'"],',
            r'// format: data.format || \'JSON\',',
            content
        )
        
        with open(user_service, 'w') as f:
            f.write(content)
        print(f"✓ Fixed Prisma types in: {user_service}")
    
    # Support service specific fixes  
    support_service = 'src/services/support.service.ts'
    if os.path.exists(support_service):
        with open(support_service, 'r') as f:
            content = f.read()
        
        # Fix resolvedAt field
        content = re.sub(
            r'resolvedAt:\s*true\s*,',
            r'// resolvedAt: true,',
            content
        )
        
        # Fix dateRange unused parameter
        content = re.sub(
            r'async getSupportAnalytics\(dateRange\?\: \{ startDate: Date; endDate: Date \}\)',
            r'async getSupportAnalytics(_dateRange?: { startDate: Date; endDate: Date })',
            content
        )
        
        with open(support_service, 'w') as f:
            f.write(content)
        print(f"✓ Fixed Prisma types in: {support_service}")

def fix_route_specific_issues():
    """Fix remaining issues in route files"""
    
    # Auth routes
    auth_routes = 'src/routes/auth.routes.ts'
    if os.path.exists(auth_routes):
        with open(auth_routes, 'r') as f:
            content = f.read()
        
        # Ensure handlers after middleware have proper signatures
        patterns = [
            (r'(emailReputationMiddleware,\s*)async\s*\(\s*\)\s*=>', r'\1async (request: FastifyRequest, reply: FastifyReply) =>'),
            (r'(ipReputationMiddleware,\s*)async\s*\(\s*\)\s*=>', r'\1async (request: FastifyRequest, reply: FastifyReply) =>'),
            (r'(fraudDetectionMiddleware,\s*)async\s*\(\s*\)\s*=>', r'\1async (request: FastifyRequest, reply: FastifyReply) =>'),
            (r'(authenticate,\s*)async\s*\(\s*\)\s*=>', r'\1async (request: FastifyRequest, reply: FastifyReply) =>'),
        ]
        
        for pattern, replacement in patterns:
            content = re.sub(pattern, replacement, content)
        
        with open(auth_routes, 'w') as f:
            f.write(content)
        print(f"✓ Fixed specific issues in: {auth_routes}")
    
    # Other route files that might still have issues
    route_files = glob.glob('src/routes/*.ts')
    for route_file in route_files:
        with open(route_file, 'r') as f:
            content = f.read()
        
        original = content
        
        # Fix any remaining async () => patterns
        if 'request.' in content or 'reply.' in content:
            content = re.sub(
                r'async\s*\(\s*\)\s*=>\s*{',
                r'async (request: FastifyRequest, reply: FastifyReply) => {',
                content
            )
        
        if content != original:
            with open(route_file, 'w') as f:
                f.write(content)
            print(f"✓ Fixed remaining issues in: {route_file}")

# Run all fixes
print("Comprehensive fix for all remaining TypeScript errors...\n")

print("1. Fixing duplicate imports...")
fix_duplicate_imports()

print("\n2. Fixing missing type imports...")
fix_missing_types()

print("\n3. Fixing unused variables...")
fix_unused_variables()

print("\n4. Fixing Prisma type mismatches...")
fix_prisma_types()

print("\n5. Fixing route-specific issues...")
fix_route_specific_issues()

print("\n✅ All fixes applied!")