const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');

console.log('Final route syntax fixes');

function fixFinalSyntax(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Fix missing closing braces after error objects
  content = content.replace(/statusCode: 404 \}\n\s*return reply\.send/g, 
    'statusCode: 404 }});\n      }\n      \n      return reply.send');
  
  // Fix extra }); in DELETE routes
  content = content.replace(/return reply\.status\(204\)\.send\(\);\s*\n\s*\}\);/g, 
    'return reply.status(204).send();');
  
  // Fix missing closing for route handlers
  content = content.replace(/throw error;\s*\n\s*\}\s*\n\s*\n/g, 
    'throw error;\n    }\n  });\n\n');
  
  // Fix missing closing for GET routes
  content = content.replace(/statusCode: 404\s*\}\);\s*\n\s*\n\s*\/\*\*/g, 
    'statusCode: 404 }\n      });\n    }\n  });\n\n  /**');
  
  // Fix closing braces at end of file
  content = content.replace(/\}\s*\n\s*\n\s*\}\s*\nNo newline at end of file/g, 
    '}\n  });\n}');
  
  // Ensure proper file ending
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
  if (fixFinalSyntax(filePath)) {
    console.log(`Fixed: ${file}`);
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} route files with final syntax fixes`);