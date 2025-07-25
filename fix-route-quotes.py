#!/usr/bin/env python3
import os
import re

def fix_escaped_quotes(file_path):
    """Fix escaped quotes in TypeScript files"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace \' with '
        fixed_content = content.replace("\\'", "'")
        
        # Only write if changes were made
        if fixed_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(fixed_content)
            print(f"Fixed: {file_path}")
            return True
        return False
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    routes_dir = './src/routes'
    fixed_count = 0
    
    # Fix all route files
    for filename in os.listdir(routes_dir):
        if filename.endswith('.routes.ts'):
            file_path = os.path.join(routes_dir, filename)
            if fix_escaped_quotes(file_path):
                fixed_count += 1
    
    # Also check repository files
    repo_dir = './src/repositories'
    for filename in os.listdir(repo_dir):
        if filename.endswith('.repository.ts'):
            file_path = os.path.join(repo_dir, filename)
            if fix_escaped_quotes(file_path):
                fixed_count += 1
    
    print(f"\nTotal files fixed: {fixed_count}")

if __name__ == "__main__":
    main()