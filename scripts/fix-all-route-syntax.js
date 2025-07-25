const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');

console.log('Comprehensive route syntax fixes');

function fixAllRouteSyntax(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Fix analytics.routes.ts specific issues
  if (filePath.includes('analytics.routes.ts')) {
    // Fix missing closing braces in error objects
    content = content.replace(/statusCode: 404 \} \}\n/g, 'statusCode: 404 }});\n      }\n');
    content = content.replace(/statusCode: 404 \}\s*\}\);/g, 'statusCode: 404 }\n      });\n    }');
  }
  
  // Fix PUT route schema structure - the body should be inside schema
  content = content.replace(/\}\n    \},\n\s*body: \{/g, '},\n      body: {');
  
  // Fix missing closing braces at end of route handlers
  content = content.replace(/\}\n  \}\);\n\n  \/\*\*/g, '  });\n\n  /**');
  
  // Fix missing closing for all routes
  content = content.replace(/\n\}\n$/g, '\n}\n');
  
  // Ensure all DELETE routes are properly closed
  content = content.replace(/throw error;\n    \}\n\s*\}\);\n\n\}/g, 'throw error;\n    }\n  });\n\n}');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  
  return false;
}

// Get all route files
const routeFiles = fs.readdirSync(routesDir)
  .filter(file => file.endsWith('.routes.ts'));

let fixedCount = 0;
for (const file of routeFiles) {
  const filePath = path.join(routesDir, file);
  if (fixAllRouteSyntax(filePath)) {
    console.log(`Fixed: ${file}`);
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} route files with comprehensive syntax fixes`);