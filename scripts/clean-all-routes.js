const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');

// Find all route files
const routeFiles = fs.readdirSync(routesDir)
  .filter(file => file.endsWith('.routes.ts'))
  .map(file => path.join(routesDir, file));

console.log(`Cleaning ${routeFiles.length} route files`);

function cleanRouteFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Fix schema objects that have misplaced closing braces
  content = content.replace(/\}\s*\}\s*\},/g, '}\n      }\n    },');
  
  // Fix handler functions that have missing closing braces
  content = content.replace(/(throw error;\s*)\}/g, '$1\n    }\n  });');
  
  // Fix error objects that aren't properly closed
  content = content.replace(
    /(error:\s*\{[^}]+message:\s*[^}]+)\s*\}\s*\);/g,
    '$1\n          }\n        });\n      }'
  );
  
  // Fix response status send patterns that are broken
  content = content.replace(
    /(return reply\.status\(\d+\)\.send\([^)]+)\)\s*\}/g,
    '$1);\n    }'
  );
  
  // Clean up double closing patterns
  content = content.replace(/\}\s*\}\s*catch/g, '}\n    } catch');
  
  // Fix missing closing brace before catch
  content = content.replace(/;\s*catch/g, ';\n    } catch');
  
  // Ensure proper function endings
  content = content.replace(/\}\s*\)\s*$/gm, '}\n  });');
  
  // Clean up end of file
  content = content.trim();
  if (!content.endsWith('}')) {
    content += '\n}';
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Cleaned: ${path.basename(filePath)}`);
    return true;
  }
  
  return false;
}

let fixedCount = 0;
for (const file of routeFiles) {
  if (cleanRouteFile(file)) {
    fixedCount++;
  }
}

console.log(`\nCleaned ${fixedCount} route files`);