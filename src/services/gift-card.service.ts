import { FastifyInstance } from 'fastify';
import { GiftCard, Prisma } from '@prisma/client';
import { CrudService } from './crud.service';

export class GiftCardService extends CrudService<
  GiftCard,
  Prisma.GiftCardCreateInput,
  Prisma.GiftCardUpdateInput
> {
  modelName = 'giftCard' as const;

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }
}
