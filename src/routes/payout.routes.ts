// Payout routes temporarily disabled due to service incompatibilities
import { FastifyPluginAsync } from 'fastify';

const payoutRoutes: FastifyPluginAsync = async (fastify) => {
  // All payout routes disabled - PayoutService has schema incompatibilities
  fastify.get('/', async (_request, reply) => {
    reply.status(501).send({
      error: {
        code: 'SERVICE_NOT_IMPLEMENTED',
        message: 'Payout service temporarily disabled due to schema incompatibilities'
      }
    });
  });
};

export default payoutRoutes;