const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');

// Find all route files
const routeFiles = fs.readdirSync(routesDir)
  .filter(file => file.endsWith('.routes.ts'))
  .map(file => path.join(routesDir, file));

console.log(`Found ${routeFiles.length} route files to fix schema issues`);

function fixRouteSchemas(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Fix webhook.routes.ts specific issues where body schema is outside params schema
  content = content.replace(
    /(\s*params:\s*\{[^}]+\}\s*\}\s*)\n\s*\},\s*\n\s*(body:\s*\{)/g,
    '$1,\n      $2'
  );

  // Fix pattern where properties object is not closed
  content = content.replace(
    /(properties:\s*\{[^}]+description:\s*\{\s*type:\s*'string'[^}]*\})\n\n(\s*\},)/g,
    '$1\n        }\n      }$2'
  );

  // Fix missing closing braces in response objects
  content = content.replace(
    /(response:\s*\{[^}]+properties:\s*\{[^}]+\})\n\n(\s*\},)/g,
    '$1\n          }\n        }\n      }$2'
  );

  // Fix missing closing braces in array items
  content = content.replace(
    /(items:\s*\{[^}]+properties:\s*\{[^}]+\})\n\n(\s*\},)/g,
    '$1\n            }\n          }\n        }$2'
  );

  // Fix missing closing braces in nested response objects with numbered status codes
  content = content.replace(
    /(response:\s*\{[^}]+(?:200|201|204):\s*\{[^}]+properties:\s*\{[^}]+\})\n\n(\s*\},)/g,
    '$1\n            }\n          }\n        }\n      }$2'
  );

  // Fix schema objects that are missing closing braces before error blocks
  content = content.replace(
    /(properties:\s*\{[^}]+postalCode:\s*\{\s*type:\s*'string'\s*\})\n(\s*error:\s*\{)/g,
    '$1\n            }\n          }\n        }\n      }\n    }$2'
  );

  // Fix any remaining unclosed error blocks
  content = content.replace(
    /(error:\s*\{\s*code:[^}]+statusCode:\s*\d+\s*)\}/g,
    '$1}\n        }\n      });'
  );

  // Fix handlers that have missing closing braces
  content = content.replace(
    /(throw error;\s*)\}/g,
    '$1    }\n  });'
  );

  // Ensure proper closing for routes
  content = content.replace(
    /(\s*}\s*\)\s*;)\s*\n\s*\n\s*\/\*\*/g,
    '$1\n\n  /**'
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed schema issues in: ${path.basename(filePath)}`);
    return true;
  }
  
  return false;
}

let fixedCount = 0;
for (const file of routeFiles) {
  if (fixRouteSchemas(file)) {
    fixedCount++;
  }
}

console.log(`\nFixed schema issues in ${fixedCount} route files`);