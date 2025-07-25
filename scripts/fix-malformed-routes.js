const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');

// Find all route files
const routeFiles = fs.readdirSync(routesDir)
  .filter(file => file.endsWith('.routes.ts'))
  .map(file => path.join(routesDir, file));

console.log(`Found ${routeFiles.length} route files to fix`);

function fixRouteFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Pattern to find malformed route handlers
  // Looking for patterns like:
  // fastify.get('/', {
  //   schema: { ... }
  //
  // }, async (request: any, reply: any) => {
  
  // Fix pattern where handler is outside the options object
  content = content.replace(
    /(\s*fastify\.(get|post|put|patch|delete)(?:<[^>]+>)?\s*\(\s*'[^']+'\s*,\s*\{[^}]+)\n\n\s*\}\s*,\s*(async\s*\([^)]+\)\s*=>\s*\{)/g,
    (match, routeStart, method, handler) => {
      // Check if there's a preHandler in the options
      if (routeStart.includes('preHandler')) {
        // Add comma after preHandler array and then the handler
        return routeStart.replace(/(\])\s*$/, '$1,') + '\n    handler: ' + handler;
      } else {
        // Add handler property at the end of options
        return routeStart + ',\n    handler: ' + handler;
      }
    }
  );

  // Fix closing braces - ensure route options object is closed properly
  content = content.replace(
    /(handler:\s*async\s*\([^)]+\)\s*=>\s*\{[\s\S]*?\}\s*)\}\s*\)\s*;/g,
    (match, handlerContent) => {
      // Count opening and closing braces in handler
      const handlerBraces = (handlerContent.match(/\{/g) || []).length - (handlerContent.match(/\}/g) || []).length;
      
      if (handlerBraces === 1) {
        // Handler is missing a closing brace
        return handlerContent + '}\n  });\n';
      } else {
        return handlerContent + '\n  });\n';
      }
    }
  );

  // Fix schema objects that are missing closing braces
  content = content.replace(
    /(\s*schema:\s*\{[^}]*properties:\s*\{[^}]+)\n\n\s*\},/g,
    '$1\n        }\n      }\n    },'
  );

  // Fix query string schemas
  content = content.replace(
    /(\s*querystring:\s*\{[^}]*properties:\s*\{[^}]+)\n\n\s*\},/g,
    '$1\n        }\n      },'
  );

  // Fix body schemas
  content = content.replace(
    /(\s*body:\s*\{[^}]*properties:\s*\{[^}]+)\n\n\s*\},/g,
    '$1\n        }\n      },'
  );

  // Fix params schemas
  content = content.replace(
    /(\s*params:\s*\{[^}]*properties:\s*\{[^}]+)\n\n\s*\},/g,
    '$1\n        }\n      },'
  );

  // Fix response schemas
  content = content.replace(
    /(\s*response:\s*\{[^}]*properties:\s*\{[^}]+)\n\n\s*\},/g,
    '$1\n          }\n        }\n      },'
  );

  // Fix array response schemas
  content = content.replace(
    /(\s*response:\s*\{[^}]*items:\s*\{[^}]*properties:\s*\{[^}]+)\n\n\s*\},/g,
    '$1\n            }\n          }\n        }\n      },'
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${path.basename(filePath)}`);
    return true;
  }
  
  return false;
}

let fixedCount = 0;
for (const file of routeFiles) {
  if (fixRouteFile(file)) {
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} route files`);