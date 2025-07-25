const fs = require('fs');
const glob = require('glob');

// Find all TypeScript files
const files = glob.sync('src/**/*.ts');

console.log(`Found ${files.length} files`);

let totalRemovals = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let removals = 0;
  
  // Split content into lines
  const lines = content.split('\n');
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line contains @ts-expect-error
    if (line.includes('@ts-expect-error')) {
      // Keep the line but remove the @ts-expect-error comment
      // This is safer than trying to determine if the error still exists
      if (line.trim().startsWith('//') && line.includes('@ts-expect-error')) {
        // Skip the entire comment line
        removals++;
        continue;
      } else {
        // Remove just the @ts-expect-error part
        const cleanedLine = line.replace(/\/\*.*@ts-expect-error.*\*\//, '')
                               .replace(/\/\/.*@ts-expect-error.*$/, '');
        if (cleanedLine.trim() !== line.trim()) {
          removals++;
        }
        newLines.push(cleanedLine);
      }
    } else {
      newLines.push(line);
    }
  }
  
  if (removals > 0) {
    const newContent = newLines.join('\n');
    fs.writeFileSync(file, newContent);
    totalRemovals += removals;
    console.log(`Removed ${removals} @ts-expect-error directives from ${file}`);
  }
});

console.log(`\nTotal @ts-expect-error directives removed: ${totalRemovals}`);