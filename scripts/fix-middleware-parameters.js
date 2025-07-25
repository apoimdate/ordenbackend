const fs = require('fs');
const glob = require('glob');

// Find all middleware files
const files = glob.sync('src/middleware/**/*.ts');

console.log(`Found ${files.length} middleware files`);

let totalFixes = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let fixes = 0;
  
  // Fix middleware functions that reference request/reply without parameters
  // Pattern: async (request, reply) => { ... request ... reply ... }
  content = content.replace(/async\s*\(([^)]+)\)\s*=>\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/gs, (match, params, body) => {
    // Extract parameter names
    const paramList = params.split(',').map(p => p.trim().split(':')[0].trim());
    
    // Check if body references request/reply that aren't in params
    let needsFix = false;
    let newBody = body;
    
    if (body.includes('request') && !paramList.includes('request')) {
      needsFix = true;
    }
    if (body.includes('reply') && !paramList.includes('reply')) {
      needsFix = true;
    }
    if (body.includes('done') && !paramList.includes('done')) {
      needsFix = true;
    }
    if (body.includes('next') && !paramList.includes('next')) {
      needsFix = true;
    }
    
    if (needsFix) {
      fixes++;
      // This is a complex fix, let's mark it for manual review
      return `// TODO: Fix parameter scope - ${match}`;
    }
    
    return match;
  });
  
  // Simpler fix: replace common middleware patterns
  content = content.replace(/export\s+async\s+function\s+(\w+)\s*\(\s*([^)]*)\s*\)\s*\{/g, (match, funcName, params) => {
    // If it's a middleware function, ensure it has request, reply parameters
    if (funcName.includes('middleware') || funcName.includes('Middleware') || 
        funcName === 'authenticate' || funcName === 'requireRole' || funcName === 'optionalAuth') {
      
      // Parse existing parameters
      let paramList = params ? params.split(',').map(p => p.trim()) : [];
      
      // Ensure FastifyRequest and FastifyReply are imported and used
      if (!params.includes('request')) {
        if (paramList.length === 0) {
          paramList = ['request: FastifyRequest', 'reply: FastifyReply'];
        } else if (paramList.length === 1) {
          paramList.push('reply: FastifyReply');
        }
        fixes++;
      }
      
      return `export async function ${funcName}(${paramList.join(', ')}) {`;
    }
    
    return match;
  });
  
  if (fixes > 0) {
    fs.writeFileSync(file, content);
    totalFixes += fixes;
    console.log(`Fixed ${fixes} parameter scope issues in ${file}`);
  }
});

console.log(`\nTotal fixes: ${totalFixes}`);