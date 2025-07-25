#!/usr/bin/env python3
import os

def create_service(model_name, file_name):
    """Create a properly formatted service file"""
    class_name = model_name + 'Service'
    model_lower = model_name[0].lower() + model_name[1:]
    
    return f"""import {{ FastifyInstance }} from 'fastify';
import {{ {model_name}, Prisma }} from '@prisma/client';
import {{ CrudService }} from './crud.service';
import {{ ServiceResult, PaginatedResult }} from '../types';
import {{ logger }} from '../utils/logger';

export class {class_name} extends CrudService<{model_name}> {{
  constructor(fastify: FastifyInstance) {{
    super(fastify.prisma, '{model_lower}');
  }}

  /**
   * Get all {model_lower}s with pagination
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
        this.prisma.{model_lower}.findMany({{
          where: whereClause,
          orderBy,
          skip,
          take: limit
        }}),
        this.prisma.{model_lower}.count({{ where: whereClause }})
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
      logger.error({{ error }}, 'Failed to find {model_lower}s');
      return {{
        success: false,
        error: {{
          code: 'FETCH_FAILED',
          message: 'Failed to fetch {model_lower}s',
          statusCode: 500
        }}
      }};
    }}
  }}

  /**
   * Create a new {model_lower}
   */
  async create(data: Prisma.{model_name}CreateInput): Promise<ServiceResult<{model_name}>> {{
    try {{
      const result = await this.prisma.{model_lower}.create({{
        data
      }});

      return {{
        success: true,
        data: result
      }};
    }} catch (error) {{
      logger.error({{ error }}, 'Failed to create {model_lower}');
      return {{
        success: false,
        error: {{
          code: 'CREATE_FAILED',
          message: 'Failed to create {model_lower}',
          statusCode: 500
        }}
      }};
    }}
  }}
}}
"""

def create_route(model_name, service_file_name):
    """Create a properly formatted route file"""
    class_name = model_name + 'Service'
    service_instance = model_name[0].lower() + model_name[1:] + 'Service'
    model_lower = model_name[0].lower() + model_name[1:]
    
    return f"""import {{ FastifyInstance, FastifyRequest, FastifyReply }} from 'fastify';
import {{ {class_name} }} from '../services/{service_file_name}.service';
import {{ authenticate }} from '../middleware/auth.middleware';
import {{ authorize }} from '../middleware/rbac.middleware';

export default async function {service_file_name.replace('-', '')}Routes(fastify: FastifyInstance) {{
  const {service_instance} = new {class_name}(fastify);

  // Get all {model_lower}s
  fastify.get('/', {{
    preHandler: [authenticate],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {{
      const {{ page, limit, search }} = request.query as any;
      const result = await {service_instance}.findMany({{
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

  // Get {model_lower} by ID
  fastify.get('/:id', {{
    preHandler: [authenticate],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {{
      const {{ id }} = request.params as any;
      const result = await {service_instance}.findById(id);
      
      if (!result.success) {{
        return reply.code(result.error?.statusCode || 500).send(result);
      }}
      
      return reply.send(result);
    }}
  }});

  // Create {model_lower}
  fastify.post('/', {{
    preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {{
      const result = await {service_instance}.create(request.body as any);
      
      if (!result.success) {{
        return reply.code(result.error?.statusCode || 500).send(result);
      }}
      
      return reply.code(201).send(result);
    }}
  }});

  // Update {model_lower}
  fastify.put('/:id', {{
    preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {{
      const {{ id }} = request.params as any;
      const result = await {service_instance}.update(id, request.body as any);
      
      if (!result.success) {{
        return reply.code(result.error?.statusCode || 500).send(result);
      }}
      
      return reply.send(result);
    }}
  }});

  // Delete {model_lower}
  fastify.delete('/:id', {{
    preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {{
      const {{ id }} = request.params as any;
      const result = await {service_instance}.delete(id);
      
      if (!result.success) {{
        return reply.code(result.error?.statusCode || 500).send(result);
      }}
      
      return reply.code(204).send();
    }}
  }});
}}
"""

def main():
    # Services to create
    services_to_create = [
        ('InventoryItem', 'inventory-items'),
        ('InventoryAdjustment', 'inventory-adjustments'),
        ('InventoryMovement', 'inventory-movements'),
        ('StockLocation', 'stock-locations'),
        ('StockTransfer', 'stock-transfer'),
        ('Wallet', 'wallet'),
        ('WalletTransaction', 'wallet-transaction'),
        ('StoreCredit', 'store-credit'),
        ('FlashSale', 'flash-sale'),
        ('GiftCard', 'gift-card'),
    ]
    
    for model_name, file_name in services_to_create:
        # Create service file
        service_path = f'./src/services/{file_name}.service.ts'
        with open(service_path, 'w') as f:
            f.write(create_service(model_name, file_name))
        print(f"Created: {service_path}")
        
        # Create route file
        route_path = f'./src/routes/{file_name}.routes.ts'
        with open(route_path, 'w') as f:
            f.write(create_route(model_name, file_name))
        print(f"Created: {route_path}")

if __name__ == "__main__":
    main()