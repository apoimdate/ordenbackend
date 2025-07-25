import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeSeller } from '../middleware/rbac';
import { ProductQAService } from '../services/product-qa.service';


interface CreateQuestionBody {
  question: string;
  isAnonymous?: boolean;
}

interface CreateAnswerBody {
  answer: string;
}

interface VoteAnswerBody {
  voteType: 'helpful' | 'not_helpful';
}

interface GetQuestionsQuery {
  page?: number;
  limit?: number;
  sortBy?: 'newest' | 'mostAnswers' | 'mostFollowed';
  onlyAnswered?: boolean;
}

const productQARoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const qaService = new ProductQAService(fastify);

  /**
   * @swagger
   * tags:
   *   name: Product Q&A
   *   description: Product questions and answers management
   */

  /**
   * @swagger
   * /api/products/{productId}/questions:
   *   get:
   *     summary: Get questions for a product
   *     tags: [Product Q&A]
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [newest, mostAnswers, mostFollowed]
   *       - in: query
   *         name: onlyAnswered
   *         schema:
   *           type: boolean
   *     responses:
   *       200:
   *         description: Questions retrieved successfully
   */
  fastify.get<{
    Params: { productId: string };
    Querystring: GetQuestionsQuery;
  }>('/products/:productId/questions', async (request: FastifyRequest, reply: FastifyReply) => {
      const { productId  } = (request.params as any) as any;
      const { page, limit, sortBy, onlyAnswered  } = (request.query as any) as any;
      const userId = (request as any).user?.userId;

      const result = await qaService.getProductQuestions(productId, {
        page,
        limit,
        sortBy,
        onlyAnswered,
        userId
      });

      if (!result.success) {
        return reply.code(result.error!.statusCode).send({ error: result.error });
      }

      return reply.send(result.data);
    }
  );

  /**
   * @swagger
   * /api/products/{productId}/questions:
   *   post:
   *     summary: Create a question for a product
   *     tags: [Product Q&A]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - question
   *             properties:
   *               question:
   *                 type: string
   *                 minLength: 10
   *                 maxLength: 500
   *               isAnonymous:
   *                 type: boolean
   *                 default: false
   *     responses:
   *       201:
   *         description: Question created successfully
   */
  fastify.post<{
    Params: { productId: string };
    Body: CreateQuestionBody;
  }>('/products/:productId/questions', {
      preHandler: [authenticate], schema: {
        body: {
          type: 'object', required: ['question'], properties: {
            question: { 
              type: 'string', minLength: 10, maxLength: 500 
            }, isAnonymous: { 
              type: 'boolean', default: false 
            }
          }
        }
      }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const { productId  } = (request.params as any) as any;
      const userId = (request as any).user.userId;

      const result = await qaService.createQuestion({
        productId,
        userId,
        ...((request.body as any) as any)
      });

      if (!result.success) {
        return reply.code(result.error!.statusCode).send({ error: result.error });
      }

      return reply.code(201).send(result.data);
    }
  );

  /**
   * @swagger
   * /api/questions/{questionId}/answers:
   *   post:
   *     summary: Answer a question
   *     tags: [Product Q&A]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: questionId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - answer
   *             properties:
   *               answer:
   *                 type: string
   *                 minLength: 10
   *                 maxLength: 2000
   *     responses:
   *       201:
   *         description: Answer created successfully
   */
  fastify.post<{
    Params: { questionId: string };
    Body: CreateAnswerBody;
  }>('/questions/:questionId/answers', {
      preHandler: [authenticate], schema: {
        body: {
          type: 'object', required: ['answer'], properties: {
            answer: { 
              type: 'string', minLength: 10, maxLength: 2000 
            }
          }
        }
      }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const { questionId  } = (request.params as any) as any;
      const userId = (request as any).user.userId;
      const userRole = (request as any).user.role;

      const result = await qaService.createAnswer({
        questionId,
        answer: (request.body as any).answer,
        userId: userId,
        isOfficial: ['SELLER', 'ADMIN', 'SUPER_ADMIN'].includes(userRole)
      });

      if (!result.success) {
        return reply.code(result.error!.statusCode).send({ error: result.error });
      }

      return reply.code(201).send(result.data);
    }
  );

  /**
   * @swagger
   * /api/answers/{answerId}/vote:
   *   post:
   *     summary: Vote on an answer
   *     tags: [Product Q&A]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: answerId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - voteType
   *             properties:
   *               voteType:
   *                 type: string
   *                 enum: [helpful, not_helpful]
   *     responses:
   *       200:
   *         description: Vote recorded successfully
   */
  fastify.post<{
    Params: { answerId: string };
    Body: VoteAnswerBody;
  }>('/answers/:answerId/vote', {
      preHandler: [authenticate], schema: {
        body: {
          type: 'object', required: ['voteType'], properties: {
            voteType: { 
              type: 'string', enum: ['helpful', 'not_helpful'] 
            }
          }
        }
      }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const { answerId  } = (request.params as any) as any;
      const userId = (request as any).user.userId;
      const { voteType  } = (request.body as any) as any;

      const result = await qaService.voteAnswer(answerId, userId, voteType);

      if (!result.success) {
        return reply.code(result.error!.statusCode).send({ error: result.error });
      }

      return reply.send({ message: 'Vote recorded successfully' });
    }
  );

  /**
   * @swagger
   * /api/questions/{questionId}/follow:
   *   post:
   *     summary: Follow/unfollow a question
   *     tags: [Product Q&A]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: questionId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Follow status updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 isFollowing:
   *                   type: boolean
   */
  fastify.post<{
    Params: { questionId: string };
  }>('/questions/:questionId/follow', {
      preHandler: [authenticate]
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const { questionId  } = (request.params as any) as any;
      const userId = (request as any).user.userId;

      const result = await qaService.toggleFollowQuestion(questionId, userId);

      if (!result.success) {
        return reply.code(result.error!.statusCode).send({ error: result.error });
      }

      return reply.send(result.data);
    }
  );

  /**
   * @swagger
   * /api/answers/{answerId}/verify:
   *   post:
   *     summary: Verify an answer (seller/admin only)
   *     tags: [Product Q&A]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: answerId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Answer verified successfully
   */
  fastify.post<{
    Params: { answerId: string };
  }>('/answers/:answerId/verify', {
      preHandler: [authenticate]
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const { answerId  } = (request.params as any) as any;
      const userId = (request as any).user.userId;

      const result = await qaService.verifyAnswer(answerId, userId);

      if (!result.success) {
        return reply.code(result.error!.statusCode).send({ error: result.error });
      }

      return reply.send({ message: 'Answer verified successfully' });
    }
  );

  /**
   * @swagger
   * /api/questions/{questionId}:
   *   delete:
   *     summary: Delete a question (owner/admin only)
   *     tags: [Product Q&A]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: questionId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Question deleted successfully
   */
  fastify.delete<{
    Params: { questionId: string };
  }>('/questions/:questionId', {
      preHandler: [authenticate]
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const { questionId  } = (request.params as any) as any;
      const userId = (request as any).user.userId;

      const result = await qaService.deleteQuestion(questionId, userId);

      if (!result.success) {
        return reply.code(result.error!.statusCode).send({ error: result.error });
      }

      return reply.send({ message: 'Question deleted successfully' });
    }
  );

  /**
   * @swagger
   * /api/products/{productId}/questions/stats:
   *   get:
   *     summary: Get Q&A statistics for a product
   *     tags: [Product Q&A]
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Statistics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 totalQuestions:
   *                   type: number
   *                 answeredQuestions:
   *                   type: number
   *                 averageResponseTime:
   *                   type: number
   *                 responseRate:
   *                   type: number
   */
  fastify.get<{
    Params: { productId: string };
  }>('/products/:productId/questions/stats', async (request: FastifyRequest, reply: FastifyReply) => {
      const { productId  } = (request.params as any) as any;

      const result = await qaService.getProductQAStats(productId);

      if (!result.success) {
        return reply.code(result.error!.statusCode).send({ error: result.error });
      }

      return reply.send(result.data);
    }
  );

  /**
   * @swagger
   * /api/seller/questions:
   *   get:
   *     summary: Get all questions for seller's products
   *     tags: [Product Q&A]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *       - in: query
   *         name: unanswered
   *         schema:
   *           type: boolean
   *     responses:
   *       200:
   *         description: Questions retrieved successfully
   */
  fastify.get<{
    Querystring: {
      page?: number;
      limit?: number;
      unanswered?: boolean;
    };
  }>('/seller/questions', {
    // @ts-ignore - TS2322: Temporary fix
      preHandler: [authenticate, authorizeSeller]
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const sellerId = (request as any).seller.id;
      const { page = 1, limit = 20, unanswered  } = (request.query as any) as any;

      // Get seller's products
      const products = await fastify.prisma.product.findMany({
        where: { sellerId },
        select: { id: true }
      });

      const productIds = products.map(p => p.id);

      const where: any = {
        productId: { in: productIds },
        deletedAt: null
      };

      if (unanswered) {
        where.answers = {
          none: {
            isOfficial: true
          }
        };
      }

      const [questions, total] = await Promise.all([
        fastify.prisma.productQuestion.findMany({
          where,
    // @ts-ignore - TS2322: Temporary fix
          include: {
            user: true,
            product: true,
            answers: {
              where: { isOfficial: true },
              include: {
                user: true
              }
            },
            _count: {
              select: {
                answers: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        fastify.prisma.productQuestion.count({ where })
      ]);

      return reply.send({
        questions,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      });
    }
  );
};

export default productQARoutes;