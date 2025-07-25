const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');

// Find all route files
const routeFiles = fs.readdirSync(routesDir)
  .filter(file => file.endsWith('.routes.ts'))
  .map(file => path.join(routesDir, file));

console.log(`Found ${routeFiles.length} route files to restore`);

function restoreRouteFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // First, fix unclosed schema objects
  // Fix querystring/body/params that have incomplete closing braces
  content = content.replace(
    /(\s*(?:querystring|body|params):\s*\{\s*type:\s*'object'[^}]*properties:\s*\{[^}]+?)(\n\n\s*\},\s*async)/g,
    (match, schemaStart, asyncPart) => {
      // Count braces to ensure proper closure
      const openBraces = (schemaStart.match(/\{/g) || []).length;
      const closeBraces = (schemaStart.match(/\}/g) || []).length;
      const bracesToAdd = openBraces - closeBraces;
      
      let closing = schemaStart;
      for (let i = 0; i < bracesToAdd; i++) {
        closing += '\n        }';
      }
      
      return closing + '\n      }' + asyncPart;
    }
  );

  // Fix routes where handler is separated from options
  // Pattern: }, async (request... should be part of the route options
  content = content.replace(
    /(fastify\.(get|post|put|patch|delete)(?:<[^>]+>)?\s*\([^,]+,\s*\{[^}]+)\}\s*,\s*(async\s*\([^)]+\)\s*=>\s*\{)/g,
    (match, routeStart, method, handler) => {
      return routeStart + '}' + handler;
    }
  );

  // Ensure all route handlers end with proper closing
  // Look for patterns where the handler function ends but the route call isn't closed
  content = content.replace(
    /(fastify\.(get|post|put|patch|delete)(?:<[^>]+>)?\s*\([^)]+\)\s*\{[\s\S]*?\}\s*)\}\s*;?\s*$/gm,
    '$1});'
  );

  // Fix response schema objects
  content = content.replace(
    /(\s*response:\s*\{[^}]*(?:200|201|204):\s*\{[^}]*properties:\s*\{[^}]+?)(\n\s*},\s*preHandler)/g,
    (match, responseStart, preHandlerPart) => {
      const openBraces = (responseStart.match(/\{/g) || []).length;
      const closeBraces = (responseStart.match(/\}/g) || []).length;
      const bracesToAdd = openBraces - closeBraces;
      
      let closing = responseStart;
      for (let i = 0; i < bracesToAdd; i++) {
        closing += '\n          }';
      }
      
      return closing + '\n        }\n      }' + preHandlerPart;
    }
  );

  // Specific fix for the pattern in webhook/support/shipping routes
  // These have schema properties that aren't closed properly
  content = content.replace(
    /(\s*properties:\s*\{[^}]+id:\s*\{\s*type:\s*'string'\s*\})\n\n(\s*\},)/g,
    '$1\n        }\n      }\n$2'
  );

  // Fix handlers that are outside the route options
  content = content.replace(
    /(\]\s*)\n\s*\}\s*,\s*(async\s*\(request[^)]*\)\s*=>\s*\{)/g,
    '$1\n  }, $2'
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Restored: ${path.basename(filePath)}`);
    return true;
  }
  
  return false;
}

let fixedCount = 0;
for (const file of routeFiles) {
  if (restoreRouteFile(file)) {
    fixedCount++;
  }
}

console.log(`\nRestored ${fixedCount} route files`);