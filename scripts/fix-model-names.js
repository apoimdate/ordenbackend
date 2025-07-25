const fs = require('fs');
const glob = require('glob');

// Find all TypeScript files
const files = glob.sync('src/**/*.ts');

console.log(`Found ${files.length} files`);

let totalFixes = 0;

const modelMappings = {
  'webhookDelivery': 'webhookLog',
  'analyticsEvent': 'event', // Based on schema having Event model
  'Analytics': 'PlatformAnalytics', // Based on what exists in schema
  'ProductAnalytics': 'Product', // Fallback to Product model
  'UserAnalytics': 'User' // Fallback to User model
};

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let fixes = 0;
  
  // Replace model names
  Object.keys(modelMappings).forEach(oldModel => {
    const newModel = modelMappings[oldModel];
    const regex = new RegExp(`\\b${oldModel}\\b`, 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, newModel);
      fixes += matches.length;
    }
  });
  
  if (fixes > 0) {
    fs.writeFileSync(file, content);
    totalFixes += fixes;
    console.log(`Fixed ${fixes} model name issues in ${file}`);
  }
});

console.log(`\nTotal fixes: ${totalFixes}`);