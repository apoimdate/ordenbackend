const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');

console.log('Fixing schema syntax in route files');

function fixSchemaSyntax(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Fix missing closing braces in querystring schema
  content = content.replace(/search: { type: 'string' }\n\n    \},/g, 
    "search: { type: 'string' }\n        }\n      }\n    },");
  
  // Fix missing closing braces in body schema
  content = content.replace(/description: { type: 'string', maxLength: 1000 }\n\n    \},/g, 
    "description: { type: 'string', maxLength: 1000 }\n        }\n      }\n    },");
  
  // Fix missing closing braces in params schema
  content = content.replace(/id: { type: 'string' }\n        \}\n      \}\n    \},/g, 
    "id: { type: 'string' }\n        }\n      }\n    },");
  
  // Fix schema with multiple sections
  content = content.replace(/\}\n      \}\n    \},\n\s*body: {/g, 
    "}\n      }\n    },\n      body: {");
  
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
  if (fixSchemaSyntax(filePath)) {
    console.log(`Fixed: ${file}`);
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} route files with schema syntax fixes`);