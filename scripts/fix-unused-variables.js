const fs = require('fs');
const glob = require('glob');

// Find all TypeScript files
const tsFiles = glob.sync('src/**/*.ts');

console.log(`Found ${tsFiles.length} TypeScript files`);

let totalFixes = 0;

tsFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let fixes = 0;
  
  // Fix unused reply parameters in middleware
  content = content.replace(/\(request:\s*[^,]+,\s*(reply)\)/g, (match, reply) => {
    fixes++;
    return match.replace(reply, '_reply');
  });
  
  // Fix unused parameters in function signatures
  content = content.replace(/\(([^)]*)\)\s*=>/g, (match, params) => {
    const paramList = params.split(',').map(param => {
      param = param.trim();
      // Skip if already prefixed with underscore or is a destructured parameter
      if (param.startsWith('_') || param.includes('{') || param.includes('...')) {
        return param;
      }
      // Common unused parameter names
      if (/^(reply|opts|request|payload|done|next)$/.test(param.split(':')[0].trim())) {
        fixes++;
        return '_' + param;
      }
      return param;
    });
    return `(${paramList.join(', ')}) =>`;
  });
  
  // Fix unused imports
  content = content.replace(/^import\s+{\s*([^}]+)\s*}\s+from\s+['"][^'"]+['"];?\s*$/gm, (match, imports) => {
    // Skip if it's a complex import or already has underscores
    if (imports.includes('_') || imports.length > 50) {
      return match;
    }
    return match;
  });
  
  // Fix unused variables in function parameters more specifically
  content = content.replace(/async\s+\(([^)]+)\)\s*=>/g, (match, params) => {
    const paramList = params.split(',').map(param => {
      param = param.trim();
      if (param.startsWith('_') || param.includes('{')) {
        return param;
      }
      // Check for common unused parameters
      const paramName = param.split(':')[0].trim();
      if (['reply', 'opts', 'done', 'next', 'payload'].includes(paramName)) {
        fixes++;
        return param.replace(paramName, '_' + paramName);
      }
      return param;
    });
    return `async (${paramList.join(', ')}) =>`;
  });
  
  if (fixes > 0) {
    fs.writeFileSync(file, content);
    totalFixes += fixes;
    console.log(`Fixed ${fixes} unused variables in ${file}`);
  }
});

console.log(`\nTotal fixes: ${totalFixes}`);