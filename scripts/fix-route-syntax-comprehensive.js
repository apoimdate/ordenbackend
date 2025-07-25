const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');

console.log('Fixing comprehensive route syntax issues');

function fixRouteFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Fix missing closing braces and parentheses
  content = content.replace(/error: { code: 'NOT_FOUND', message: '[^']+', statusCode: 404 \n/g, 
    (match) => match.replace(' \n', ' }}\n'));
  
  // Fix missing closing braces in return statements
  content = content.replace(/data: item\n\n    \}/g, 'data: item\n      });\n    }');
  
  // Fix missing closing parentheses for handler functions
  content = content.replace(/userId: \(request as any\)\.user!\.userId\n\n/g, 
    'userId: (request as any).user!.userId\n      });\n');
  
  // Fix missing closing braces for properties objects
  content = content.replace(/properties: \{\n          ([^}]+)\n\n    \}/g, 
    'properties: {\n          $1\n        }\n      }\n    }');
  
  // Fix missing closing braces after pagination objects
  content = content.replace(/pages: ([^\n]+)    \}/g, 'pages: $1\n        }\n      });');
  
  // Fix missing closing braces for error objects
  content = content.replace(/statusCode: 404 \}/g, 'statusCode: 404 }');
  content = content.replace(/statusCode: 404 \n/g, 'statusCode: 404 }}\n');
  
  // Fix double closing braces for catch blocks
  content = content.replace(/\}    \}\n/g, '    });\n  });\n');
  
  // Fix missing closing for schema objects
  content = content.replace(/\}\n        \}\n      \}\n    \}, async/g, '}\n        }\n      }\n    }\n  }, async');
  
  // Fix handler function structure - ensure proper closing
  content = content.replace(/\n    \}\n    \} catch/g, '\n      });\n    } catch');
  
  // Fix route definition endings
  content = content.replace(/\}\n  \}\n  \}\);/g, '    }\n  });\n');
  
  // Ensure all routes have proper endings
  content = content.replace(/throw error;\n    \}\n  \}\n  \}\);/g, 'throw error;\n    }\n  });\n');
  
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

console.log(`\nFixed ${fixedCount} route files with comprehensive syntax fixes`);