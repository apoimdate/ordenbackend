#!/usr/bin/env python3
import os

def fix_service_file(file_path, old_name, new_name):
    """Fix service class names and imports"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Fix class name
        content = content.replace(f'class {old_name}Service', f'class {new_name}Service')
        
        # Fix in routes if it's a route file
        if '.routes.ts' in file_path:
            content = content.replace(f'{{ {old_name}Service }}', f'{{ {new_name}Service }}')
            content = content.replace(f'from \'../services/{old_name.lower().replace("-", "-")}.service\'', 
                                    f'from \'../services/{old_name.lower()}.service\'')
            content = content.replace(f'const {old_name.lower()}Service = new {old_name}Service', 
                                    f'const {new_name[0].lower() + new_name[1:]}Service = new {new_name}Service')
            
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed: {file_path}")
        return True
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    # Map of files to fix
    fixes = [
        ('inventory-items', 'InventoryItem'),
        ('inventory-adjustments', 'InventoryAdjustment'),
        ('inventory-movements', 'InventoryMovement'),
        ('stock-locations', 'StockLocation'),
        ('stock-transfer', 'StockTransfer'),
        ('wallet-transaction', 'WalletTransaction'),
        ('store-credit', 'StoreCredit'),
        ('flash-sale', 'FlashSale'),
        ('gift-card', 'GiftCard'),
    ]
    
    for old_name, new_name in fixes:
        # Fix service file
        service_path = f'./src/services/{old_name}.service.ts'
        if os.path.exists(service_path):
            fix_service_file(service_path, old_name.replace('-', '-'), new_name)
        
        # Fix route file
        route_path = f'./src/routes/{old_name}.routes.ts'
        if os.path.exists(route_path):
            fix_service_file(route_path, old_name.replace('-', '-'), new_name)

if __name__ == "__main__":
    main()