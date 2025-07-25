#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all route files
const routeFiles = glob.sync('src/routes/**/*.routes.ts');

console.log(`Found ${routeFiles.length} route files to fix`);

let totalFixed = 0;

routeFiles.forEach(file => {
  console.log(`Processing ${file}...`);
  let content = fs.readFileSync(file, 'utf8');
  const originalContent = content;
  let fixCount = 0;
  
  // Fix the extra closing braces that were added
  // Pattern 1: Fix double closing braces and spaces
  content = content.replace(/\s*\}\s*\}\s*\);/g, '    }\n  });');
  
  // Pattern 2: Fix auth.routes.ts specific issues with extra closing braces
  content = content.replace(/\}\s*\}\s*\}\s*\);\s*$/gm, '    }\n  });');
  
  // Pattern 3: Remove standalone closing braces that don't belong
  content = content.replace(/^\s*\}\s*$/gm, (match, offset) => {
    // Check if this is a valid closing brace by looking at context
    const before = content.substring(Math.max(0, offset - 100), offset);
    if (before.includes('} catch') || before.includes('} else') || before.includes('throw error;')) {
      return match; // Keep valid closing braces
    }
    fixCount++;
    return ''; // Remove invalid ones
  });
  
  // Pattern 4: Fix the "handler:" syntax - it should be inside the options object
  content = content.replace(/\},\s*\n\s*handler:\s*async/g, ',\n    handler: async');
  
  // Pattern 5: Remove "No newline at end of file" strings
  content = content.replace(/\n?\s*No newline at end of file/g, '');
  
  // Pattern 6: Fix extra whitespace at the end of handler functions
  content = content.replace(/\s*\}\s*\n\s*\}\);/g, '    }\n  });');
  
  // Pattern 7: Clean up multiple empty lines
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // Pattern 8: Fix misplaced handler property
  if (file.includes('auth.routes.ts')) {
    // Special handling for auth.routes.ts
    content = content.replace(/\}\s*,\s*\n\s*handler:/g, ',\n    handler:');
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`  Fixed ${file}`);
    totalFixed++;
  }
});

console.log(`\nTotal files fixed: ${totalFixed}`);