import { FastifyInstance } from 'fastify';
import { CategoryService } from '../services/category.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import {
  createCategorySchema,
  findManyCategorySchema,
  findCategoryByIdSchema,
  updateCategorySchema,
  deleteCategoryRequestSchema,
} from '../schemas/category.schemas';
import { z } from 'zod';

export default async function categoryRoutes(fastify: FastifyInstance) {
  const categoryService = new CategoryService(fastify);

  fastify.get(
    '/',
    {
      schema: findManyCategorySchema,
    },
    async (request, reply) => {
      const { page, limit, search } = request.query as z.infer<typeof findManyCategorySchema.querystring>;
      const result = await categoryService.findMany({
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        search,
      });

      if (result.success) {
        return reply.send(result.data);
      } else {
        return reply.code(result.error?.statusCode || 500).send(result.error);
      }
    },
  );

  fastify.get(
    '/:id',
    {
      schema: findCategoryByIdSchema,
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof findCategoryByIdSchema.params>;
      const result = await categoryService.findById(id);

      if (result.success) {
        if (result.data) {
          return reply.send(result.data);
        } else {
          return reply.code(404).send({ message: 'Category not found' });
        }
      } else {
        return reply.code(result.error?.statusCode || 500).send(result.error);
      }
    },
  );

  fastify.post(
    '/',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: createCategorySchema,
    },
    async (request, reply) => {
      const result = await categoryService.createCategory(request.body as z.infer<typeof createCategorySchema.body>);

      if (result.success) {
        return reply.code(201).send(result.data);
      } else {
        return reply.code(result.error?.statusCode || 500).send(result.error);
      }
    },
  );

  fastify.put(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: updateCategorySchema,
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof updateCategorySchema.params>;
      const result = await categoryService.update(id, request.body as z.infer<typeof updateCategorySchema.body>);

      if (result.success) {
        return reply.send(result.data);
      } else {
        return reply.code(result.error?.statusCode || 500).send(result.error);
      }
    },
  );

  fastify.delete(
    '/:id',
    {
      preHandler: [authenticate, authorize(['ADMIN', 'SUPER_ADMIN'])],
      schema: deleteCategoryRequestSchema,
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof deleteCategoryRequestSchema.params>;
      const result = await categoryService.delete(id);

      if (result.success) {
        return reply.code(204).send();
      } else {
        return reply.code(result.error?.statusCode || 500).send(result.error);
      }
    },
  );
}
