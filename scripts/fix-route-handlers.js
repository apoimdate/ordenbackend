const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');

// Only fix the routes with the most critical syntax issues
const problematicRoutes = [
  'webhook.routes.ts',
  'user.routes.ts',
  'support.routes.ts',
  'seller.routes.ts',
  'shipping.routes.ts'
];

console.log(`Fixing ${problematicRoutes.length} problematic route files`);

function fixProblematicRoute(fileName) {
  const filePath = path.join(routesDir, fileName);
  
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${fileName} - file not found`);
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Fix missing closing braces in route handlers
  // Look for patterns where });\n is missing
  content = content.replace(/(\s*return reply[^;]+;)\s*\}\s*catch/g, '$1\n    } catch');
  
  // Fix error blocks that aren't properly closed
  content = content.replace(
    /(error:\s*\{[^}]+message:\s*[^}]+)\s*\}\s*$/gm,
    '$1\n          }\n        });\n      }'
  );
  
  // Fix missing closing braces in response objects
  content = content.replace(
    /(response:\s*\{[^}]+properties:\s*\{[^}]+)\}\s*\}\s*},/g,
    '$1\n            }\n          }\n        }\n      }'
  );
  
  // Fix missing closing braces in nested objects
  content = content.replace(
    /(properties:\s*\{[^}]+(?:street|city|state|country|postalCode):\s*\{[^}]+\})\s*$/gm,
    '$1\n        }\n      }'
  );
  
  // Fix routes where closing braces are missing
  content = content.replace(
    /(}\s*catch[^}]+throw error;)\s*}/g,
    '$1\n    }\n  });'
  );
  
  // Fix malformed closing patterns
  content = content.replace(/\}\s*\}\s*\}\s*\},/g, '}\n        }\n      }\n    },');
  
  // Fix export statement at end of file
  if (!content.trim().endsWith('}')) {
    const lines = content.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    if (lastLine.includes('export') || lastLine.match(/^\s*\}/)) {
      // Already has proper ending
    } else {
      content = content.trim() + '\n}';
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${fileName}`);
    return true;
  }
  
  return false;
}

let fixedCount = 0;
for (const file of problematicRoutes) {
  if (fixProblematicRoute(file)) {
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} problematic route files`);