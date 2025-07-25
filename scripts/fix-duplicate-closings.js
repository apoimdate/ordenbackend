const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');

console.log('Fixing duplicate closings in route files');

function fixDuplicateClosings(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Fix duplicate }); after return statements
  content = content.replace(/}\);\s*\n\s*}\);/g, '});');
  
  // Fix duplicate closing braces in error handling
  content = content.replace(/statusCode: 404 \}\}/g, 'statusCode: 404 }');
  
  // Fix duplicate closing braces after return statements
  content = content.replace(/data: item\s*\n\s*\}\);\s*\n\s*\}\);/g, 'data: item\n      });');
  
  // Fix extra closing braces in catch blocks
  content = content.replace(/throw error;\s*\n\s*\}\s*\n\s*\}\);/g, 'throw error;\n    }');
  
  // Fix missing closing braces for if statements
  content = content.replace(/statusCode: 404 \}\}\n\s*return reply\.send/g, 'statusCode: 404 }});\n      }\n      \n      return reply.send');
  
  // Fix closing for pagination objects
  content = content.replace(/pages: 0\s*\}\s*\n\s*\}\s*\n\s*\}\);/g, 'pages: 0\n        }\n      });\n    }');
  
  // Fix missing closing braces in route definitions
  content = content.replace(/\}\);\s*\n\s*\n/g, '  });\n\n');
  
  // Fix extra closing at end of file
  content = content.replace(/\}\s*\n\s*\}\s*\n\s*$/, '}\n');
  
  // Ensure missing closing braces after if blocks
  const lines = content.split('\n');
  let fixed = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('statusCode: 404 }}') && 
        i + 1 < lines.length && 
        lines[i + 1].trim().startsWith('return reply.send')) {
      lines[i] = lines[i].replace('}}', '}});');
      lines.splice(i + 1, 0, '      }');
      lines.splice(i + 2, 0, '      ');
      fixed = true;
    }
  }
  
  if (fixed) {
    content = lines.join('\n');
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
  if (fixDuplicateClosings(filePath)) {
    console.log(`Fixed: ${file}`);
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} route files with duplicate closing issues`);