import { FastifyInstance } from 'fastify';
import { CMSService } from '../services/cms.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac';
import {
  createCmsSchema,
  findManyCmsSchema,
  findCmsByIdSchema,
  updateCmsSchema,
  deleteCmsRequestSchema,
} from '../schemas/cms.schemas';
import { z } from 'zod';

export default async function cmsRoutes(fastify: FastifyInstance) {
  const cmsService = new CMSService(fastify);

  fastify.get(
    '/',
    {
      schema: findManyCmsSchema,
    },
    async (request, reply) => {
      const { page, limit, search } = request.query as z.infer<typeof findManyCmsSchema.querystring>;
      const result = await cmsService.findMany({
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
      schema: findCmsByIdSchema,
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof findCmsByIdSchema.params>;
      const result = await cmsService.findById(id);

      if (result.success) {
        if (result.data) {
          return reply.send(result.data);
        } else {
          return reply.code(404).send({ message: 'CMS not found' });
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
      schema: createCmsSchema,
    },
    async (request, reply) => {
      const result = await cmsService.create(request.body as z.infer<typeof createCmsSchema.body>);

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
      schema: updateCmsSchema,
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof updateCmsSchema.params>;
      const result = await cmsService.update(id, request.body as z.infer<typeof updateCmsSchema.body>);

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
      schema: deleteCmsRequestSchema,
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof deleteCmsRequestSchema.params>;
      const result = await cmsService.delete(id);

      if (result.success) {
        return reply.code(204).send();
      } else {
        return reply.code(result.error?.statusCode || 500).send(result.error);
      }
    },
  );
}
