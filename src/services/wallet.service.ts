import { FastifyInstance } from 'fastify';
import { Wallet, Prisma } from '@prisma/client';
import { CrudService } from './crud.service';

export class WalletService extends CrudService<
  Wallet,
  Prisma.WalletCreateInput,
  Prisma.WalletUpdateInput
> {
  modelName = 'wallet' as const;
  
  constructor(fastify: FastifyInstance) {
    super(fastify);
  }
}
