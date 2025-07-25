import { FastifyInstance } from 'fastify';
import { FlashSale, Prisma } from '@prisma/client';
import { CrudService } from './crud.service';

export class FlashSaleService extends CrudService<
  FlashSale,
  Prisma.FlashSaleCreateInput,
  Prisma.FlashSaleUpdateInput
> {
  modelName = 'flashSale' as const;

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }
}
