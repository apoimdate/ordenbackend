const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');

// Find all route files
const routeFiles = fs.readdirSync(routesDir)
  .filter(file => file.endsWith('.routes.ts'))
  .map(file => path.join(routesDir, file));

console.log(`Found ${routeFiles.length} route files to clean`);

function cleanRouteFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Remove duplicate closing patterns
  // Pattern: }  }); }); → }  });
  content = content.replace(/\}\s*\}\);\s*\}\);/g, '}\n  });');
  
  // Pattern: throw error;    } }); }); → throw error; } });
  content = content.replace(/(throw error;)\s*\}\s*\}\);\s*\}\);/g, '$1\n    }\n  });');
  
  // Pattern: } }); → }
  content = content.replace(/\}\s*\}\);/g, '}');
  
  // Fix error blocks that have broken syntax
  // Pattern: message: error.message    } → message: error.message }
  content = content.replace(/(message:\s*[^\n]+)\s+\}/g, '$1 }');
  
  // Fix patterns where error blocks are followed by incorrect syntax
  // Pattern: statusCode: 404    } → statusCode: 404 }
  content = content.replace(/(statusCode:\s*\d+)\s+\}/g, '$1 }');
  
  // Remove duplicate closing braces and parentheses at end of handlers
  content = content.replace(/\}\s*\)\);\s*\}/g, '}\n        });\n      }');
  
  // Fix patterns where there's extra code after error blocks
  content = content.replace(/(\s*error:\s*\{[^}]+\})\s*\}\s*\)\);\s*\}\);/g, '$1\n        }\n      });\n    }');
  
  // Fix closing patterns for catch blocks
  content = content.replace(/(throw error;)\s*\}\s*\}\);\s*\}\);/g, '$1\n    }\n  });');
  
  // Clean up extra closing braces at the end of the file
  content = content.replace(/\}\s*\}\s*\}\s*$/, '}\n');
  
  // Fix patterns where error block is malformed
  content = content.replace(/(error:\s*\{[^}]+message:\s*[^}]+)\s*\}\s*\);\s*$/gm, '$1\n          }\n        }\n      });');
  
  // Fix patterns where there are disconnected code blocks
  content = content.replace(/\}\);\s*\}\s*return reply/g, '}\n\n      return reply');
  
  // Fix specific pattern in user.routes.ts and similar files
  content = content.replace(/(message:\s*error\.message)\s*\}\s*\}\);\s*throw error;\s*\}\s*\}\);\s*\}\);/g, 
    '$1\n          }\n        });\n      }\n\n      throw error;\n    }\n  });');
    
  // Remove standalone closing braces and parentheses
  content = content.replace(/^\s*\}\);\s*$/gm, '');
  
  // Ensure proper function ending
  if (!content.trim().endsWith('}')) {
    content = content.trim() + '\n}';
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