const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');

// These files have the most critical issues
const problematicFiles = [
  'webhook.routes.ts',
  'support.routes.ts',
  'seller.routes.ts',
  'shipping.routes.ts',
  'user.routes.ts'
];

console.log(`Fixing ${problematicFiles.length} specific route files`);

function fixSpecificRoute(fileName) {
  const filePath = path.join(routesDir, fileName);
  
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${fileName} - file not found`);
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Fix duplicate closing braces in catch blocks
  content = content.replace(/\}\s*\n\s*\}\s*\} catch/g, '}\n    } catch');
  
  // Fix patterns where there are duplicate closing braces after reply.send
  content = content.replace(/\)\s*\}\s*\n\s*\}\s*\} catch/g, ');\n    } catch');
  
  // Fix patterns where error object has duplicate closing
  content = content.replace(/(statusCode:\s*\d+\s*\})\s*\}/g, '$1');
  
  // Fix patterns where there's a closing brace before return statement
  content = content.replace(/\}\s*\n\s*return reply/g, '\n      return reply');
  
  // Fix catch blocks that have extra closing braces
  content = content.replace(/catch\s*\([^)]+\)\s*\{([^}]+)\}\s*\}\s*\}/g, 'catch (error: any) {\n$1\n    }');
  
  // Fix schema objects that have misplaced closing braces
  content = content.replace(/properties:\s*\{([^}]+)\}\s*\n\s*\n\s*\}/g, (match, props) => {
    // Count braces
    const openCount = (props.match(/\{/g) || []).length;
    const closeCount = (props.match(/\}/g) || []).length;
    
    if (openCount > closeCount) {
      let closing = '';
      for (let i = 0; i < openCount - closeCount; i++) {
        closing += '\n        }';
      }
      return `properties: {${props}${closing}\n        }\n      }`;
    }
    return match;
  });
  
  // Fix duplicate } at end of handlers
  content = content.replace(/\}\s*\n\s*\}\s*\);/g, '}\n  });');
  
  // Ensure proper closing of route definitions
  content = content.replace(/\}\s*\)\s*;\s*\n\s*\}\s*\)\s*;/g, '}\n  });');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${fileName}`);
    return true;
  }
  
  return false;
}

let fixedCount = 0;
for (const file of problematicFiles) {
  if (fixSpecificRoute(file)) {
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} specific route files`);