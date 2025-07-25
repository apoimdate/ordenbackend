import { Geolocation, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class GeolocationRepository extends BaseRepository<
  Geolocation,
  Prisma.GeolocationCreateInput,
  Prisma.GeolocationUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'geolocation', 300);
  }

}