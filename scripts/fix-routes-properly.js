const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');

console.log('Fixing route files properly');

function fixRouteFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Fix the most common issues first
  
  // 1. Fix missing closing braces in schemas
  content = content.replace(/properties: \{\s*id: \{ type: 'string' \}\s*\}\s*\n\s*\},/g, 
    "properties: {\n          id: { type: 'string' }\n        }\n      }\n    },");
  
  // 2. Fix PUT route schemas - the body should be inside schema
  content = content.replace(/\}\s*\n\s*\}\s*\n\s*\},\s*\n\s*body: \{/g, 
    "}\n      }\n    },\n      body: {");
  
  // 3. Fix missing closing for error objects
  content = content.replace(/statusCode: 404 \}\s*\n\s*\n/g, 
    "statusCode: 404 }\n      });\n    }\n  });\n\n");
  
  // 4. Fix duplicate closing at pagination
  content = content.replace(/pages: (\d+)\s*\}\);\s*\n\s*\n\s*\}/g, 
    "pages: $1\n        }\n      });\n    }");
  
  // 5. Fix missing closing braces after if (!item)
  content = content.replace(/statusCode: 404 \}\}\);\s*\n\s*\}\s*\n/g, 
    "statusCode: 404 }});\n      }\n");
  
  // 6. Remove extra closing braces and parentheses
  content = content.replace(/\}\);\s*\n\s*\}\);\s*\n/g, '  });\n');
  
  // 7. Fix closing for catch blocks
  content = content.replace(/throw error;\s*\n\s*\}\);\s*\n/g, 
    "throw error;\n    }\n  });\n");
  
  // 8. Ensure proper file ending
  if (!content.endsWith('\n')) {
    content += '\n';
  }
  
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
  if (fixRouteFile(filePath)) {
    console.log(`Fixed: ${file}`);
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} route files`);