#!/usr/bin/env python3
import os
import re

# Lista de todos los modelos de Prisma que necesitan servicios
PRISMA_MODELS = [
    'AbandonedBrowse', 'AbandonedCheckout', 'AbTest', 'AbTestAssignment',
    'AccountDeletion', 'Address', 'AdminActionLog', 'Affiliate', 'AffiliateClick',
    'ApiKey', 'ApiRequestLog', 'AppInstallation', 'Backup', 'BannedItem',
    'BlockedEmail', 'BlockedIp', 'BlogCategory', 'BlogPost', 'Brand',
    'BundleItem', 'buy_box_configs', 'CartAbandonment', 'CollectionProduct',
    'ComparisonList', 'Content', 'CurrencyExchangeRate', 'CustomerGroup',
    'CustomerGroupMember', 'CustomsItem', 'DashboardWidget', 'DataExport',
    'duplicate_groups', 'duplicate_products', 'EmailTemplate', 'Event', 'Faq',
    'FeatureFlag', 'FileUpload', 'FlashSale', 'FlashSaleItem', 'FraudCheck',
    'FraudRule', 'Geolocation', 'GiftCard', 'inventory_adjustment_items',
    'inventory_adjustments', 'inventory_items', 'InventoryLog', 'inventory_movements',
    'inventory_reservations', 'JobQueue', 'Language', 'LiveStream', 'low_stock_alerts',
    'LoyaltyPoints', 'MarketingCampaign', 'Membership', 'Menu', 'MenuItem',
    'NewsletterSubscriber', 'NotificationPreference', 'OrderHistory', 'OrderItem',
    'Page', 'Partner', 'PaymentLog', 'PickupLocation', 'PlatformAnalytics',
    'PriceHistory', 'PriceRule', 'ProductAlert', 'ProductAttribute', 'ProductBundle',
    'ProductCollection', 'ProductImage', 'ProductImport', 'ProductQuestion',
    'ProductRecommendation', 'ProductTag', 'ProductView', 'Promotion',
    'PurchaseOrder', 'QuickOrder', 'Redirect', 'Referral', 'Refund', 'Report',
    'ReturnRequest', 'Review', 'ScriptTag', 'SearchLog', 'SecurityLog',
    'SellerAnalytics', 'SellerBadge', 'SellerBadgeAssignment', 'SellerDocument',
    'seller_offers', 'SellerOrder', 'SellerReview', 'SeoMetadata', 'Session',
    'Shipment', 'ShippingClass', 'ShippingZone', 'ShippingZoneMethod', 'SmsTemplate',
    'SocialMediaLink', 'stock_locations', 'StockTransfer', 'stock_transfer_items',
    'stock_transfers_enhanced', 'StoreCredit', 'StoreLocation', 'StoreSetting',
    'Subscription', 'SupportTicket', 'Survey', 'SurveyResponse', 'SystemHealth',
    'TaxRule', 'Testimonial', 'Theme', 'TicketMessage', 'Translation',
    'UserActivityLog', 'UserConsent', 'UserSearchPreference', 'Vendor',
    'Wallet', 'WalletTransaction', 'WebhookLog'
]

# Services that already exist
EXISTING_SERVICES = []

def get_existing_services():
    """Get list of existing services"""
    services = []
    services_dir = './src/services'
    if os.path.exists(services_dir):
        for filename in os.listdir(services_dir):
            if filename.endswith('.service.ts') and filename != 'base.service.ts' and filename != 'crud.service.ts':
                service_name = filename.replace('.service.ts', '')
                services.append(service_name)
    return services

def camel_to_kebab(name):
    """Convert CamelCase to kebab-case"""
    return re.sub(r'(?<!^)(?=[A-Z])', '-', name).lower()

def camel_to_pascal(name):
    """Convert camelCase to PascalCase"""
    return name[0].upper() + name[1:]

def create_service_template(model_name, service_name):
    """Create service template"""
    class_name = camel_to_pascal(service_name) + 'Service'
    
    return f"""import {{ FastifyInstance }} from 'fastify';
import {{ {model_name}, Prisma }} from '@prisma/client';
import {{ CrudService }} from './crud.service';
import {{ ServiceResult, PaginatedResult }} from '../types';
import {{ logger }} from '../utils/logger';

export class {class_name} extends CrudService<{model_name}> {{
  constructor(fastify: FastifyInstance) {{
    super(fastify.prisma, '{model_name[0].lower() + model_name[1:]}');
  }}

  /**
   * Get all {model_name.lower()}s with pagination
   */
  async findMany(params?: {{
    page?: number;
    limit?: number;
    search?: string;
    where?: Prisma.{model_name}WhereInput;
    orderBy?: Prisma.{model_name}OrderByWithRelationInput;
  }}): Promise<ServiceResult<PaginatedResult<{model_name}>>> {{
    try {{
      const {{ page = 1, limit = 20, search, where = {{}}, orderBy = {{ createdAt: 'desc' }} }} = params || {{}};
      const skip = (page - 1) * limit;

      const whereClause: Prisma.{model_name}WhereInput = {{
        ...where
      }};

      const [data, total] = await Promise.all([
        this.prisma.{model_name[0].lower() + model_name[1:]}.findMany({{
          where: whereClause,
          orderBy,
          skip,
          take: limit
        }}),
        this.prisma.{model_name[0].lower() + model_name[1:]}.count({{ where: whereClause }})
      ]);

      return {{
        success: true,
        data: {{
          data,
          meta: {{
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }}
        }}
      }};
    }} catch (error) {{
      logger.error({{ error }}, 'Failed to find {model_name.lower()}s');
      return {{
        success: false,
        error: {{
          code: 'FETCH_FAILED',
          message: 'Failed to fetch {model_name.lower()}s',
          statusCode: 500
        }}
      }};
    }}
  }}

  /**
   * Create a new {model_name.lower()}
   */
  async create(data: Prisma.{model_name}CreateInput): Promise<ServiceResult<{model_name}>> {{
    try {{
      const result = await this.prisma.{model_name[0].lower() + model_name[1:]}.create({{
        data
      }});

      return {{
        success: true,
        data: result
      }};
    }} catch (error) {{
      logger.error({{ error }}, 'Failed to create {model_name.lower()}');
      return {{
        success: false,
        error: {{
          code: 'CREATE_FAILED',
          message: 'Failed to create {model_name.lower()}',
          statusCode: 500
        }}
      }};
    }}
  }}
}}
"""

def create_route_template(model_name, service_name):
    """Create route template"""
    class_name = camel_to_pascal(service_name) + 'Service'
    route_prefix = camel_to_kebab(model_name) + 's'
    
    return f"""import {{ FastifyInstance, FastifyRequest, FastifyReply }} from 'fastify';
import {{ {class_name} }} from '../services/{service_name}.service';
import {{ authenticate }} from '../middleware/auth.middleware';
import {{ authorize }} from '../middleware/rbac.middleware';

export default async function {service_name}Routes(fastify: FastifyInstance) {{
  const {service_name}Service = new {class_name}(fastify);

  // Get all {model_name.lower()}s
  fastify.get('/', {{
    preHandler: [authenticate],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {{
      const {{ page, limit, search }} = request.query as any;
      const result = await {service_name}Service.findMany({{
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        search
      }});
      
      if (!result.success) {{
        return reply.code(result.error?.statusCode || 500).send(result);
      }}
      
      return reply.send(result);
    }}
  }});

  // Get {model_name.lower()} by ID
  fastify.get('/:id', {{
    preHandler: [authenticate],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {{
      const {{ id }} = request.params as any;
      const result = await {service_name}Service.findById(id);
      
      if (!result.success) {{
        return reply.code(result.error?.statusCode || 500).send(result);
      }}
      
      return reply.send(result);
    }}
  }});

  // Create {model_name.lower()}
  fastify.post('/', {{
    preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {{
      const result = await {service_name}Service.create(request.body as any);
      
      if (!result.success) {{
        return reply.code(result.error?.statusCode || 500).send(result);
      }}
      
      return reply.code(201).send(result);
    }}
  }});

  // Update {model_name.lower()}
  fastify.put('/:id', {{
    preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {{
      const {{ id }} = request.params as any;
      const result = await {service_name}Service.update(id, request.body as any);
      
      if (!result.success) {{
        return reply.code(result.error?.statusCode || 500).send(result);
      }}
      
      return reply.send(result);
    }}
  }});

  // Delete {model_name.lower()}
  fastify.delete('/:id', {{
    preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {{
      const {{ id }} = request.params as any;
      const result = await {service_name}Service.delete(id);
      
      if (!result.success) {{
        return reply.code(result.error?.statusCode || 500).send(result);
      }}
      
      return reply.code(204).send();
    }}
  }});
}}
"""

def main():
    existing_services = get_existing_services()
    print(f"Found {len(existing_services)} existing services")
    
    # Create missing services
    services_dir = './src/services'
    routes_dir = './src/routes'
    
    if not os.path.exists(services_dir):
        os.makedirs(services_dir)
    if not os.path.exists(routes_dir):
        os.makedirs(routes_dir)
    
    created_services = 0
    created_routes = 0
    
    # Priority services to create
    priority_models = [
        'inventory_items', 'inventory_adjustments', 'inventory_movements',
        'stock_locations', 'StockTransfer', 'Wallet', 'WalletTransaction',
        'StoreCredit', 'FlashSale', 'GiftCard', 'ProductBundle', 'BundleItem',
        'Subscription', 'Language', 'Translation', 'Theme', 'Report',
        'MarketingCampaign', 'Affiliate', 'Membership', 'LiveStream'
    ]
    
    for model in priority_models[:10]:  # Create first 10 priority services
        service_name = camel_to_kebab(model).replace('_', '-')
        
        # Skip if service already exists
        if service_name in existing_services:
            continue
        
        # Create service file
        service_path = os.path.join(services_dir, f'{service_name}.service.ts')
        if not os.path.exists(service_path):
            with open(service_path, 'w') as f:
                f.write(create_service_template(model, service_name))
            print(f"Created service: {service_name}.service.ts")
            created_services += 1
        
        # Create route file
        route_path = os.path.join(routes_dir, f'{service_name}.routes.ts')
        if not os.path.exists(route_path):
            with open(route_path, 'w') as f:
                f.write(create_route_template(model, service_name))
            print(f"Created route: {service_name}.routes.ts")
            created_routes += 1
    
    print(f"\nCreated {created_services} services and {created_routes} routes")

if __name__ == "__main__":
    main()