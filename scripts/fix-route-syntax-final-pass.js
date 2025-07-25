const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');

console.log('Final pass to fix all route syntax issues');

function fixRouteSyntaxFinalPass(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Fix missing closing braces and extra closing
  content = content.replace(/}\n      }\n\n    }/g, '}\n      }\n    }');
  
  // Fix double closing for route handlers
  content = content.replace(/}\);\s*}\);/g, '});');
  
  // Fix extra closing braces at the end of error handling
  content = content.replace(/}\);\s*\n\s*}\);/g, '});');
  
  // Fix missing closing braces in GET routes
  content = content.replace(/data: item\n\s*}\n\s*} catch/g, 'data: item\n      });\n    } catch');
  
  // Fix missing closing braces in error handlers
  content = content.replace(/statusCode: 404 \}\s*\n\s*\n\s*\/\*\*/g, 'statusCode: 404 }\n      });\n    }\n  });\n\n  /**');
  
  // Fix extra closing braces after catch blocks
  content = content.replace(/throw error;\s*\n\s*}\);\s*\n/g, 'throw error;\n    }\n  });\n');
  
  // Fix improper schema closings in PUT routes
  content = content.replace(/}\n\s*}\n\s*},\n\s*body: {/g, '}\n      }\n    },\n      body: {');
  
  // Fix analytics route specific issues
  if (filePath.includes('analytics.routes.ts')) {
    // Fix the duplicate closing braces issue around line 86-87
    content = content.replace(/}\);\n\s*}\n\s*}\n\n\s*return reply\.send/g, '});\n      }\n\n      return reply.send');
  }
  
  // Fix extra closing at the end of POST/PUT routes
  content = content.replace(/}\);\s*\n\s*} catch/g, '});\n    } catch');
  
  // Fix missing closing for route definitions that end with });
  content = content.replace(/}\n\s*}\);/g, '  });\n');
  
  // Make sure file ends properly
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
  if (fixRouteSyntaxFinalPass(filePath)) {
    console.log(`Fixed: ${file}`);
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} route files in final pass`);