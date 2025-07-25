#!/usr/bin/env python3

import re
import os

def fix_error_handlers(file_path):
    """Fix error handlers that use _error but reference error in shorthand"""
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Fix pattern: } catch (_error) { logger.error({ error },
    pattern = r'} catch \(_error\) { logger\.error\({ error },'
    replacement = r'} catch (error) { logger.error({ error },'
    content = re.sub(pattern, replacement, content)
    
    # Also fix similar pattern in other places
    pattern2 = r'} catch \(_error\) \{\s*logger\.error\(\{ error \},'
    replacement2 = r'} catch (error) { logger.error({ error },'
    content = re.sub(pattern2, replacement2, content)
    
    with open(file_path, 'w') as f:
        f.write(content)
    
    print(f"Fixed error handlers in {file_path}")

# Fix app.ts
app_file = 'src/app.ts'
fix_error_handlers(app_file)

print("Error handler fixes completed")