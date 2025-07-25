import { FastifyInstance } from 'fastify';
import { PrismaClient, Role, ProductQuestion } from '@prisma/client';
import { logger } from '../utils/logger';
import { ServiceResult } from '../types';
import { NotificationService } from './notification.service';
import { ApiError } from '../utils/errors';

export interface CreateQuestionData {
  productId: string;
  userId: string;
  question: string;
  isAnonymous?: boolean;
}

export interface CreateAnswerData {
  questionId: string;
  answer: string;
  userId: string;
  isOfficial: boolean;
}

export interface UpdateQuestionData {
  question?: string;
  isAnonymous?: boolean;
}

export interface UpdateAnswerData {
  answer?: string;
  isVerified?: boolean;
}

export interface QuestionWithDetails extends ProductQuestion {
  user?: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  product: {
    id: string;
    name: string;
    images: { url: string }[];
    sellerId: string;
  };
  answers: Array<{
    id: string;
    answer: string;
    isOfficial: boolean;
    isVerified: boolean;
    createdAt: Date;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      role: Role;
      avatar?: string;
    };
    votes: {
      helpful: number;
      notHelpful: number;
    };
  }>;
  followersCount: number;
  isFollowing?: boolean;
}

export class ProductQAService {
  private prisma: PrismaClient;
  private notificationService?: NotificationService;

  constructor(app: FastifyInstance) {
    this.prisma = app.prisma;
    // this.notificationService = app.notificationService; // Service not available
  }

  async getProductQuestions(_productId: string, _options: any): Promise<ServiceResult<any>> {
    // Implementation needed
    return { success: true, data: [] };
  }

  async createQuestion(data: CreateQuestionData): Promise<ServiceResult<ProductQuestion>> {
    try {
      // Validate product exists
      const product = await this.prisma.product.findUnique({
        where: { id: data.productId },
        include: {
          seller: true
        }
      });

      if (!product) {
        return {
          success: false,
          error: new ApiError('Product not found', 404, 'PRODUCT_NOT_FOUND')
        };
      }

      // Create question
      const question = await this.prisma.productQuestion.create({
        data: {
          productId: data.productId,
          userId: data.userId,
          question: data.question,
        },
      });

      // Notify seller
      if (this.notificationService && product.seller.userId) {
        await this.notificationService.createNotification({
          type: 'NEW_QUESTION',
          title: 'Nueva pregunta sobre tu producto',
          message: `Han hecho una pregunta sobre ${product.name}`,
          userId: product.seller.userId,
          createdBy: data.userId,
          data: {
            questionId: question.id,
            productId: product.id,
            productName: product.name,
            question: data.question
          },
        });
      }
      
      logger.info({
        questionId: question.id,
        productId: data.productId,
        userId: data.userId
      }, 'Product question created');

      return {
        success: true,
        data: question
      };
    } catch (error: any) { 
      logger.error({ error, data }, 'Failed to create product question');
      return {
        success: false,
        error: new ApiError('Failed to create question', 500, 'CREATE_QUESTION_ERROR')
      };
    }
  }

  async createAnswer(data: CreateAnswerData): Promise<ServiceResult<any>> {
    try {
      const question = await this.prisma.productQuestion.findUnique({
        where: { id: data.questionId },
        include: {
          product: true,
          user: true
        }
      } as any);

      if (!question) {
        return {
          success: false,
          error: new ApiError('Question not found', 404, 'QUESTION_NOT_FOUND')
        };
      }

      const answerer = await this.prisma.user.findUnique({
        where: { id: data.userId }
      });

      if (!answerer) {
        return {
          success: false,
          error: new ApiError('User not found', 404, 'USER_NOT_FOUND')
        };
      }

      const isOfficial = data.isOfficial || 
        ['ADMIN', 'SUPER_ADMIN'].includes(answerer.role);

      const answer = await this.prisma.productQuestion.update({
        where: { id: data.questionId },
        data: {
          answer: data.answer,
          answeredBy: data.userId,
          answeredAt: new Date(),
        }
      });

      if (this.notificationService) {
        await this.notificationService.createNotification({
          type: 'QUESTION_ANSWERED',
          title: 'Tu pregunta ha sido respondida',
          message: `${isOfficial ? 'El vendedor' : 'Alguien'} ha respondido tu pregunta sobre el producto`,
          userId: question.userId,
          createdBy: data.userId,
          data: {
            questionId: question.id,
            answerId: answer.id,
            productId: question.productId,
            productName: 'Product',
            isOfficialAnswer: isOfficial
          },
        });
      }

      logger.info({
        answerId: answer.id,
        questionId: data.questionId,
        userId: data.userId,
        isOfficial
      }, 'Product question answered');

      return {
        success: true,
        data: answer
      };
    } catch (error: any) { 
      logger.error({ error, data }, 'Failed to create answer');
      return {
        success: false,
        error: new ApiError('Failed to create answer', 500, 'CREATE_ANSWER_ERROR')
      };
    }
  }

  async voteAnswer(_answerId: string, _userId: string, _voteType: 'helpful' | 'not_helpful'): Promise<ServiceResult<void>> {
    // Implementation needed
    return { success: true, data: undefined };
  }

  async toggleFollowQuestion(_questionId: string, _userId: string): Promise<ServiceResult<{ isFollowing: boolean }>> {
    // Implementation needed
    return { success: true, data: { isFollowing: true } };
  }

  async verifyAnswer(_answerId: string, _userId: string): Promise<ServiceResult<void>> {
    // Implementation needed
    return { success: true, data: undefined };
  }

  async deleteQuestion(_questionId: string, _userId: string): Promise<ServiceResult<void>> {
    // Implementation needed
    return { success: true, data: undefined };
  }

  async getProductQAStats(_productId: string): Promise<ServiceResult<any>> {
    // Implementation needed
    return { success: true, data: {} };
  }
}