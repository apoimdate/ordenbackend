const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');

console.log('Final comprehensive route fixes');

function fixAllRoutes(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Fix PUT route schema structure - move body inside schema
  content = content.replace(/\}\s*\n\s*\}\s*\n\s*\},\s*\n\s*body: \{/g, 
    "}\n      },\n      body: {");
  
  // Add newline if one is missing
  content = content.replace(/\}\n      \}\n    \},\n      body: \{/g, 
    "}\n      },\n      body: {");
  
  // Ensure file ends with newline
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
  if (fixAllRoutes(filePath)) {
    console.log(`Fixed: ${file}`);
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} route files`);