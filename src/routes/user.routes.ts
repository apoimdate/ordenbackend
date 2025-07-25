import { FastifyInstance } from 'fastify';
import { UserService } from '../services/user.service';
import { authenticate } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { userSchemas } from '../schemas/user.schemas';
import { z } from 'zod';

export async function userRoutes(fastify: FastifyInstance) {
  const userService = new UserService(
    fastify.prisma,
    fastify.redis,
    logger
  );

  fastify.get('/profile', {
    schema: userSchemas.getProfile,
    preHandler: authenticate
  }, async (request, reply) => {
    const { includeStats } = request.query as z.infer<typeof userSchemas.getProfile>['querystring'];
    const result = await userService.getProfile(request.user.userId, includeStats);

    if (result.success) {
      return reply.send(result.data);
    } else {
      return reply.status(result.error?.statusCode || 500).send(result.error);
    }
  });

  fastify.patch('/profile', {
    schema: userSchemas.updateProfile,
    preHandler: authenticate
  }, async (request, reply) => {
    const result = await userService.updateProfile(request.user.userId, request.body as z.infer<typeof userSchemas.updateProfile>['body']);

    if (result.success) {
      return reply.send(result.data);
    } else {
      return reply.status(result.error?.statusCode || 500).send(result.error);
    }
  });

  fastify.post('/change-password', {
    schema: userSchemas.changePassword,
    preHandler: authenticate
  }, async (request, reply) => {
    const result = await userService.changePassword(request.user.userId, request.body as z.infer<typeof userSchemas.changePassword>['body']);

    if (result.success) {
      return reply.send(result.data);
    } else {
      return reply.status(result.error?.statusCode || 500).send(result.error);
    }
  });

  fastify.get('/addresses', {
    schema: userSchemas.getAddresses,
    preHandler: authenticate
  }, async (request, reply) => {
    const result = await userService.getAddresses(request.user.userId);

    if (result.success) {
      return reply.send(result.data);
    } else {
      return reply.status(result.error?.statusCode || 500).send(result.error);
    }
  });

  fastify.post('/addresses', {
    schema: userSchemas.createAddress,
    preHandler: authenticate
  }, async (request, reply) => {
    const result = await userService.createAddress(request.user.userId, request.body as z.infer<typeof userSchemas.createAddress>['body']);

    if (result.success) {
      return reply.status(201).send(result.data);
    } else {
      return reply.status(result.error?.statusCode || 500).send(result.error);
    }
  });

  fastify.patch('/addresses/:addressId', {
    schema: userSchemas.updateAddress,
    preHandler: authenticate
  }, async (request, reply) => {
    const { addressId } = request.params as z.infer<typeof userSchemas.updateAddress>['params'];
    const result = await userService.updateAddress(request.user.userId, addressId, request.body as z.infer<typeof userSchemas.updateAddress>['body']);

    if (result.success) {
      return reply.send(result.data);
    } else {
      return reply.status(result.error?.statusCode || 500).send(result.error);
    }
  });

  fastify.delete('/addresses/:addressId', {
    schema: userSchemas.deleteAddress,
    preHandler: authenticate
  }, async (request, reply) => {
    const { addressId } = request.params as z.infer<typeof userSchemas.deleteAddress>['params'];
    const result = await userService.deleteAddress(request.user.userId, addressId);

    if (result.success) {
      return reply.status(204).send();
    } else {
      return reply.status(result.error?.statusCode || 500).send(result.error);
    }
  });

  fastify.get('/wishlist', {
    schema: userSchemas.getWishlist,
    preHandler: authenticate
  }, async (request, reply) => {
    const { page, limit } = request.query as z.infer<typeof userSchemas.getWishlist>['querystring'];
    const result = await userService.getWishlist(request.user.userId, page || 1, limit || 10);

    if (result.success) {
      return reply.send(result.data);
    } else {
      return reply.status(result.error?.statusCode || 500).send(result.error);
    }
  });

  fastify.post('/wishlist', {
    schema: userSchemas.addToWishlist,
    preHandler: authenticate
  }, async (request, reply) => {
    const { productId } = request.body as z.infer<typeof userSchemas.addToWishlist>['body'];
    const result = await userService.addToWishlist(request.user.userId, productId);

    if (result.success) {
      return reply.status(201).send(result.data);
    } else {
      return reply.status(result.error?.statusCode || 500).send(result.error);
    }
  });

  fastify.delete('/wishlist/:productId', {
    schema: userSchemas.removeFromWishlist,
    preHandler: authenticate
  }, async (request, reply) => {
    const { productId } = request.params as z.infer<typeof userSchemas.removeFromWishlist>['params'];
    const result = await userService.removeFromWishlist(request.user.userId, productId);

    if (result.success) {
      return reply.status(204).send();
    } else {
      return reply.status(result.error?.statusCode || 500).send(result.error);
    }
  });

  fastify.post('/delete-account', {
    schema: userSchemas.deleteAccount,
    preHandler: authenticate
  }, async (request, reply) => {
    const { password } = request.body as z.infer<typeof userSchemas.deleteAccount>['body'];
    const result = await userService.deleteAccount(request.user.userId, password);

    if (result.success) {
      return reply.send(result.data);
    } else {
      return reply.status(result.error?.statusCode || 500).send(result.error);
    }
  });

  fastify.post('/export-data', {
    schema: userSchemas.exportData,
    preHandler: authenticate
  }, async (request, reply) => {
    const result = await userService.exportUserData(request.user.userId);

    if (result.success) {
      return reply.send(result.data);
    } else {
      return reply.status(result.error?.statusCode || 500).send(result.error);
    }
  });
}
