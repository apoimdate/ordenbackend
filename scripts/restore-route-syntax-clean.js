const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');

console.log('Restoring proper route syntax');

function restoreRouteSyntax(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Fix error object closing - should end with }
  content = content.replace(/statusCode: 404\s*\}\);\s*\n\s*\}\);\s*\n/g, 'statusCode: 404 }\n      });\n    }\n  });\n');
  
  // Fix duplicate closing after pagination objects
  content = content.replace(/pages: 0\s*\n\s*\}\);\s*\n\s*\n\s*\}/g, 'pages: 0\n        }\n      });\n    }');
  
  // Fix improper closing in catch blocks
  content = content.replace(/throw error;\s*\n\s*\}\);\s*\n\s*\n/g, 'throw error;\n    }\n  });\n\n');
  
  // Fix params schema closing
  content = content.replace(/id: \{ type: 'string' \}\s*\n\s*\}\s*\n\s*\},/g, "id: { type: 'string' }\n        }\n      }\n    },");
  
  // Fix schema structure
  content = content.replace(/\}\s*\n\s*\}\s*\n\s*\},\s*\n\s*body:/g, '}\n      }\n    },\n      body:');
  
  // Remove extra closing braces and parentheses
  content = content.replace(/\}\);\s*\n\s*\}\);\s*\n\s*\n/g, '  });\n\n');
  
  // Fix error object format
  content = content.replace(/statusCode: 404\s*\}\);/g, 'statusCode: 404 }');
  
  // Remove extra closing at the end of routes
  content = content.replace(/\}\);\s*\n\s*\n\s*\n\s*\}/g, '  });\n\n}');
  
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
  if (restoreRouteSyntax(filePath)) {
    console.log(`Fixed: ${file}`);
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} route files with proper syntax`);