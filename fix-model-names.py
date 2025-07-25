#!/usr/bin/env python3
import os
import re

def fix_model_names(file_path):
    """Fix model names to match Prisma schema"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Fix inventory_items -> InventoryItem
        content = content.replace('inventory_items', 'InventoryItem')
        content = content.replace('inventory_itemsService', 'inventoryItemService')
        content = content.replace('inventoryItem', 'inventoryItem')
        
        # Fix inventory_adjustments -> InventoryAdjustment
        content = content.replace('inventory_adjustments', 'InventoryAdjustment')
        content = content.replace('inventory_adjustmentsService', 'inventoryAdjustmentService')
        
        # Fix inventory_movements -> InventoryMovement
        content = content.replace('inventory_movements', 'InventoryMovement')
        content = content.replace('inventory_movementsService', 'inventoryMovementService')
        
        # Fix stock_locations -> StockLocation
        content = content.replace('stock_locations', 'StockLocation')
        content = content.replace('stock_locationsService', 'stockLocationService')
        
        # Fix StoreCredit
        content = content.replace('storecredit', 'storeCredit')
        
        # Fix class names
        content = re.sub(r'class Inventory-itemsService', 'class InventoryItemService', content)
        content = re.sub(r'class Inventory-adjustmentsService', 'class InventoryAdjustmentService', content)
        content = re.sub(r'class Inventory-movementsService', 'class InventoryMovementService', content)
        content = re.sub(r'class Stock-locationsService', 'class StockLocationService', content)
        content = re.sub(r'class Stock-transferService', 'class StockTransferService', content)
        content = re.sub(r'class Store-creditService', 'class StoreCreditService', content)
        content = re.sub(r'class Flash-saleService', 'class FlashSaleService', content)
        content = re.sub(r'class Gift-cardService', 'class GiftCardService', content)
        content = re.sub(r'class Wallet-transactionService', 'class WalletTransactionService', content)
        
        # Fix service instance names
        content = re.sub(r'const inventory-itemsService', 'const inventoryItemService', content)
        content = re.sub(r'const inventory-adjustmentsService', 'const inventoryAdjustmentService', content)
        content = re.sub(r'const inventory-movementsService', 'const inventoryMovementService', content)
        content = re.sub(r'const stock-locationsService', 'const stockLocationService', content)
        content = re.sub(r'const stock-transferService', 'const stockTransferService', content)
        content = re.sub(r'const store-creditService', 'const storeCreditService', content)
        content = re.sub(r'const flash-saleService', 'const flashSaleService', content)
        content = re.sub(r'const gift-cardService', 'const giftCardService', content)
        content = re.sub(r'const wallet-transactionService', 'const walletTransactionService', content)
        
        # Fix model references in Prisma calls
        content = re.sub(r'this\.prisma\.inventoryItem', 'this.prisma.inventoryItem', content)
        
        # Only write if changes were made
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Fixed: {file_path}")
            return True
        return False
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    fixed_count = 0
    
    # Fix new service files
    services_dir = './src/services'
    new_services = [
        'inventory-items.service.ts', 'inventory-adjustments.service.ts',
        'inventory-movements.service.ts', 'stock-locations.service.ts',
        'stock-transfer.service.ts', 'wallet.service.ts',
        'wallet-transaction.service.ts', 'store-credit.service.ts',
        'flash-sale.service.ts', 'gift-card.service.ts'
    ]
    
    for filename in new_services:
        file_path = os.path.join(services_dir, filename)
        if os.path.exists(file_path):
            if fix_model_names(file_path):
                fixed_count += 1
    
    # Fix new route files
    routes_dir = './src/routes'
    new_routes = [f.replace('.service.ts', '.routes.ts') for f in new_services]
    
    for filename in new_routes:
        file_path = os.path.join(routes_dir, filename)
        if os.path.exists(file_path):
            if fix_model_names(file_path):
                fixed_count += 1
    
    print(f"\nTotal files fixed: {fixed_count}")

if __name__ == "__main__":
    main()