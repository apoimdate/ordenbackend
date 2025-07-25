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
  
  // Fix patterns where closing braces are duplicated or misplaced
  // Pattern: } catch (error: any) {
  content = content.replace(/\}\s*catch\s*\(error/g, '}\n    } catch (error');
  
  // Fix patterns where throw error has extra closing braces
  content = content.replace(/throw error;\s*\}\s*\n/g, 'throw error;\n    }\n  });\n');
  
  // Fix malformed error object returns
  content = content.replace(/(message:\s*[^}]+)\s*\}\s*\n\s*throw error;/g, '$1\n          }\n        });\n      }\n\n      throw error;');
  
  // Fix missing closing braces in schemas
  content = content.replace(/properties:\s*\{([^}]+)\}\s*\n\s*\},\s*async/g, (match, props) => {
    // Count braces in properties
    const openCount = (props.match(/\{/g) || []).length;
    const closeCount = (props.match(/\}/g) || []).length;
    let closing = '';
    for (let i = 0; i < openCount - closeCount; i++) {
      closing += '\n        }';
    }
    return `properties: {${props}${closing}\n        }\n      }\n    },\n    async`;
  });
  
  // Fix handlers that are missing their route method closing
  content = content.replace(/catch\s*\(error[^}]+\}\s*\);?\s*$/gm, (match) => {
    if (!match.includes('});')) {
      return match.replace(/\);?\s*$/, '\n  });');
    }
    return match;
  });
  
  // Fix duplicate closing patterns at end of routes
  content = content.replace(/\}\s*\)\s*;\s*\}\s*\)\s*;/g, '}\n  });');
  
  // Fix missing closing braces in catch blocks
  content = content.replace(/catch\s*\([^)]+\)\s*\{([^}]+throw error;)\s*\}/g, 'catch (error: any) {\n$1\n    }');
  
  // Ensure file ends with single closing brace for the export function
  content = content.trim();
  
  // Remove any trailing duplicate closing braces
  content = content.replace(/\}\s*\}\s*\}\s*$/, '}');
  
  // Make sure file ends with a single closing brace
  if (!content.endsWith('}')) {
    content += '\n}';
  }

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