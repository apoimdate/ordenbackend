import { SurveyResponse, Prisma } from '@prisma/client';
import { FindOptionsWithoutWhere } from './base.repository';
import { BaseRepository } from './base.repository';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from 'pino';

export class SurveyResponseRepository extends BaseRepository<
  SurveyResponse,
  Prisma.SurveyResponseCreateInput,
  Prisma.SurveyResponseUpdateInput
> {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger, 'surveyResponse', 300);
  }

  async findByUserId(userId: string, options?: FindOptionsWithoutWhere): Promise<SurveyResponse[]> {
    return this.findMany({
      ...options,
      where: {
        
        userId
      }
    });
  }
}