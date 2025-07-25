import { CurrencyExchangeRate, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class CurrencyExchangeRateRepository extends BaseRepository<
  CurrencyExchangeRate,
  Prisma.CurrencyExchangeRateCreateInput,
  Prisma.CurrencyExchangeRateUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'currencyExchangeRate', 300);
  }

}