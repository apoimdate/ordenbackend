#!/bin/bash

echo "🔧 Fixing all TypeScript import paths..."

# Fix @config imports
find src -name "*.ts" -type f -exec sed -i 's|from ['\''"]@config/environment['\''"]|from '\''../config/environment'\''|g' {} \;
find src -name "*.ts" -type f -exec sed -i 's|from ['\''"]@config/database['\''"]|from '\''../config/database'\''|g' {} \;
find src -name "*.ts" -type f -exec sed -i 's|from ['\''"]@config['\''"]|from '\''../config'\''|g' {} \;

# Fix @services imports
find src -name "*.ts" -type f -exec sed -i 's|from ['\''"]@services/\([^'\'''"]*\)['\''"]|from '\''../services/\1'\''|g' {} \;

# Fix @middleware imports
find src -name "*.ts" -type f -exec sed -i 's|from ['\''"]@middleware/\([^'\'''"]*\)['\''"]|from '\''../middleware/\1'\''|g' {} \;
find src -name "*.ts" -type f -exec sed -i 's|from ['\''"]@middleware['\''"]|from '\''../middleware'\''|g' {} \;

# Fix @routes imports
find src -name "*.ts" -type f -exec sed -i 's|from ['\''"]@routes/\([^'\'''"]*\)['\''"]|from '\''../routes/\1'\''|g' {} \;

# Fix @repositories imports
find src -name "*.ts" -type f -exec sed -i 's|from ['\''"]@repositories/\([^'\'''"]*\)['\''"]|from '\''../repositories/\1'\''|g' {} \;
find src -name "*.ts" -type f -exec sed -i 's|from ['\''"]@repositories['\''"]|from '\''../repositories'\''|g' {} \;

# Fix @utils imports
find src -name "*.ts" -type f -exec sed -i 's|from ['\''"]@utils/\([^'\'''"]*\)['\''"]|from '\''../utils/\1'\''|g' {} \;

# Fix @integrations imports
find src -name "*.ts" -type f -exec sed -i 's|from ['\''"]@integrations/\([^'\'''"]*\)['\''"]|from '\''../integrations/\1'\''|g' {} \;

# Fix @types imports
find src -name "*.ts" -type f -exec sed -i 's|from ['\''"]@types/\([^'\'''"]*\)['\''"]|from '\''../types/\1'\''|g' {} \;

# Special case for services in routes (they're at same level)
find src/routes -name "*.ts" -type f -exec sed -i 's|from ['\''"]\.\.\/services/|from '\''../services/|g' {} \;
find src/services -name "*.ts" -type f -exec sed -i 's|from ['\''"]\.\.\/repositories/|from '\''../repositories/|g' {} \;

# Fix deeper paths (../../)
find src/services -name "*.ts" -type f -exec sed -i 's|from ['\''"]"\.\./\.\./repositories"|from '\''../repositories'\''|g' {} \;

echo "✅ Import paths fixed!"