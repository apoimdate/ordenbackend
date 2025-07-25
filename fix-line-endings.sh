#!/bin/bash

# Fix corrupted TypeScript files with embedded \n characters
cd ordendirecta-backend-production-new

echo "Fixing corrupted TypeScript files..."

# List of corrupted files
corrupted_files=(
  "src/repositories/review-vote.repository.ts"
  "src/services/order.service.ts"
  "src/services/product.service.ts"
  "src/services/commission.service.ts"
  "src/services/shipping.service.ts"
  "src/services/product-qa.service.ts"
  "src/services/coupon.service.ts"
  "src/services/fraud-advanced.service.ts"
  "src/services/notification.service.ts"
  "src/services/seller.service.ts"
  "src/services/review.service.ts"
  "src/services/return.service.ts"
  "src/services/auth.service.ts"
  "src/services/payment.service.ts"
  "src/services/customs.service.ts"
  "src/services/chat.service.ts"
  "src/services/loyalty.service.ts"
  "src/services/search.service.ts"
  "src/services/support.service.ts"
  "src/services/webhook.service.ts"
  "src/services/pickup.service.ts"
  "src/services/category.service.ts"
  "src/services/fraud-detection.service.ts"
  "src/middleware/tracing.middleware.ts"
  "src/middleware/auth.ts"
  "src/routes/loyalty.routes.ts"
  "src/routes/product-qa.routes.ts"
  "src/routes/auth.routes.ts"
  "src/routes/cms.routes.ts"
  "src/routes/coupon.routes.ts"
  "src/routes/return.routes.ts"
  "src/routes/support.routes.ts"
  "src/routes/webhook.routes.ts"
)

# Fix each file
for file in "${corrupted_files[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing $file..."
    # Create backup
    cp "$file" "$file.backup"
    # Convert embedded \n to actual newlines
    sed 's/\\n/\n/g' "$file" > "$file.temp" && mv "$file.temp" "$file"
    echo "Fixed $file"
  else
    echo "File not found: $file"
  fi
done

echo "Done fixing corrupted files."