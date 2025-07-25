import { FastifyPluginAsync } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

/**
 * Plugin to configure Fastify with TypeBox type provider
 * This enables automatic type inference from TypeBox schemas
 */
export const typeProviderPlugin: FastifyPluginAsync = async (fastify) => {
  // Set TypeBox as the type provider
  fastify.withTypeProvider<TypeBoxTypeProvider>();
};