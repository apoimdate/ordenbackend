import { FastifyRequest } from 'fastify';
import { z } from 'zod';

type InferredZodSchema<T extends z.ZodTypeAny> = {
  Body?: z.infer<T>['body'];
  Querystring?: z.infer<T>['querystring'];
  Params?: z.infer<T>['params'];
};

export type AuthenticatedRequest<T extends z.ZodTypeAny = z.ZodTypeAny> = FastifyRequest<InferredZodSchema<T>> & {
  user: {
    userId: string;
    role: string;
    sessionId: string;
    permissions: string[];
  };
};
