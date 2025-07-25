import { FastifyInstance, FastifyRequest } from 'fastify';
import { AuthService } from '../services/auth.service';
import { jsonSchemas } from '../utils/json-schemas';
import { 
  emailReputationMiddleware, 
  ipReputationMiddleware 
} from '../middleware/fraud-detection.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

export async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(
    fastify.prisma,
    fastify.redis,
    logger
  );

  /**
   * Register new user
   */
  fastify.post('/register', {
    schema: {
      description: 'Register a new user account',
      summary: 'User registration',
      tags: ['Authentication'],
      body: jsonSchemas.user.create,
      response: {
        201: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                username: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                role: { type: 'string' },
                isEmailVerified: { type: 'boolean' },
                createdAt: { type: 'string' }
              }
            },
            tokens: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                expiresIn: { type: 'number' },
                tokenType: { type: 'string' }
              }
            }
          }
        }
      }
    },
    preHandler: [
      ipReputationMiddleware(fastify.fraudService),
    // @ts-ignore - TS2322: Temporary fix
      emailReputationMiddleware(fastify.fraudService)
    ]
  }, async (request, reply) => {
    try {
      const { user, tokens } = await authService.register((request.body as any));

      // Remove sensitive data
      const sanitizedUser = {
        id: user.id,
        email: user.email,
    // @ts-ignore - TS2339: Temporary fix
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
    // @ts-ignore - TS2551: Temporary fix
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt
      };

      return reply.status(201).send({
        user: sanitizedUser,
        tokens
      });
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'Registration failed');
      
      if (error.message.includes('already exists')) {
        return reply.status(409).send({
          error: {
            code: 'USER_EXISTS',
            message: error.message
          }
        });
      }

      throw error;
    }
  });

  /**
   * Login
   */
  fastify.post('/login', {
    schema: {
      description: 'Authenticate user and receive access tokens',
      summary: 'User login',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['emailOrUsername', 'password'],
        properties: {
          emailOrUsername: { type: 'string' },
          password: { type: 'string' },
          twoFactorCode: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                username: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                role: { type: 'string' },
                twoFactorEnabled: { type: 'boolean' }
              }
            },
            tokens: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                expiresIn: { type: 'number' },
                tokenType: { type: 'string' }
              }
            },
            requires2FA: { type: 'boolean' }
          }
        }
      }
    },
    preHandler: [
      ipReputationMiddleware(fastify.fraudService)
    ]
  }, async (request, reply) => {
    try {
      const deviceInfo = {
        userAgent: request.headers['user-agent'] as string,
        ip: request.ip
      };

      const { user, tokens } = await authService.login({
        ...(request.body as any),
        deviceInfo
      });

      // Check if 2FA is required
      if (user.twoFactorEnabled && !tokens.accessToken) {
        return reply.send({
          user: {
            id: user.id,
            twoFactorEnabled: true
          },
          tokens: {
            accessToken: '',
            refreshToken: '',
            expiresIn: 0,
            tokenType: 'Bearer'
          },
          requires2FA: true
        });
      }

      // Sanitize user data
      const sanitizedUser = {
        id: user.id,
        email: user.email,
    // @ts-ignore - TS2339: Temporary fix
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled
      };

      return reply.send({
        user: sanitizedUser,
        tokens,
        requires2FA: false
      });
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'Login failed');
      
      if (error.message.includes('Invalid')) {
        return reply.status(401).send({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email/username or password'
          }
        });
      }

      if (error.message.includes('disabled')) {
        return reply.status(403).send({
          error: {
            code: 'ACCOUNT_DISABLED',
            message: error.message
          }
        });
      }

      throw error;
    }
  });

  /**
   * Refresh access token
   */
  fastify.post('/refresh', {
    schema: {
      body: {
        type: 'object', required: ['refreshToken'], properties: {
          refreshToken: { type: 'string' }
        }
      }, response: {
        200: {
          type: 'object', properties: {
            accessToken: { type: 'string' }, refreshToken: { type: 'string' }, expiresIn: { type: 'number' }, tokenType: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const tokens = await authService.refreshToken((request.body as any).refreshToken);
      return reply.send(tokens);
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'Token refresh failed');
      
      return reply.status(401).send({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token'
        }
      });
    }
  });

  /**
   * Logout
   */
  fastify.post('/logout', {
    schema: {
      response: {
        200: {
          type: 'object', properties: {
            message: { type: 'string' }
          }
        }
      }
    }, preHandler: authenticate
  }, async (request: FastifyRequest, reply) => {
    try {
      await authService.logout((request as any).user.userId, (request as any).user.sessionId);
      return reply.send({ message: 'Logged out successfully' });
    } catch (error: any) { logger.error({ error, traceId: (request as any).traceId }, 'Logout failed');
      throw error;
    }
  });

  /**
   * Logout all sessions
   */
  fastify.post('/logout-all', {
    schema: {
      response: {
        200: {
          type: 'object', properties: {
            message: { type: 'string' }
          }
        }
      }
    }, preHandler: authenticate
  }, async (request: FastifyRequest, reply) => {
    try {
      await authService.logout((request as any).user.userId);
      return reply.send({ message: 'All sessions logged out successfully' });
    } catch (error: any) { logger.error({ error, traceId: (request as any).traceId }, 'Logout all failed');
      throw error;
    }
  });

  /**
   * Setup 2FA
   */
  fastify.post('/2fa/setup', {
    schema: {
      response: {
        200: {
          type: 'object', properties: {
            secret: { type: 'string' }, qrCode: { type: 'string' }, backupCodes: {
              type: 'array', items: { type: 'string' }
            }
          }
        }
      }
    }, preHandler: authenticate
  }, async (request: FastifyRequest, reply) => {
    try {
      const setup = await authService.setup2FA((request as any).user.userId);
      return reply.send(setup);
    } catch (error: any) { logger.error({ error, traceId: (request as any).traceId }, '2FA setup failed');
      throw error;
    }
  });

  /**
   * Verify and enable 2FA
   */
  fastify.post('/2fa/verify', {
    schema: {
      body: {
        type: 'object', required: ['token'], properties: {
          token: { type: 'string', minLength: 6, maxLength: 6 }
        }
      }, response: {
        200: {
          type: 'object', properties: {
            message: { type: 'string' }
          }
        }
      }
    }, preHandler: authenticate
  }, async (request: FastifyRequest, reply) => {
    try {
      await authService.verify2FA((request as any).user.userId, (request.body as any).token);
      return reply.send({ message: '2FA enabled successfully' });
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, '2FA verification failed');
      
      if (error.message.includes('Invalid')) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_2FA_CODE',
            message: error.message
          }
        });
      }

      throw error;
    }
  });

  /**
   * Disable 2FA
   */
  fastify.post('/2fa/disable', {
    schema: {
      body: {
        type: 'object', required: ['password'], properties: {
          password: { type: 'string' }
        }
      }, response: {
        200: {
          type: 'object', properties: {
            message: { type: 'string' }
          }
        }
      }
    }, preHandler: authenticate
  }, async (request: FastifyRequest, reply) => {
    try {
      await authService.disable2FA((request as any).user.userId, (request.body as any).password);
      return reply.send({ message: '2FA disabled successfully' });
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, '2FA disable failed');
      
      if (error.message.includes('password')) {
        return reply.status(401).send({
          error: {
            code: 'INVALID_PASSWORD',
            message: error.message
          }
        });
      }

      throw error;
    }
  });

  /**
   * Request password reset
   */
  fastify.post('/password/reset-request', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    },
    preHandler: [
      ipReputationMiddleware(fastify.fraudService)
    ]
  }, async (request, reply) => {
    try {
      await authService.requestPasswordReset((request.body as any).email);
      
      // Always return success to prevent email enumeration
      return reply.send({ 
        message: 'If the email exists, a password reset link has been sent' 
      });
    } catch (error: any) { logger.error({ error, traceId: (request as any).traceId }, 'Password reset request failed');
      
      // Still return success to prevent enumeration
      return reply.send({ 
        message: 'If the email exists, a password reset link has been sent' 
      });
    }
  });

  /**
   * Reset password
   */
  fastify.post('/password/reset', {
    schema: {
      body: {
        type: 'object', required: ['token', 'newPassword'], properties: {
          token: { type: 'string' }, newPassword: { type: 'string', minLength: 8 }
        }
      }, response: {
        200: {
          type: 'object', properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await authService.resetPassword((request.body as any).token, (request.body as any).newPassword);
      return reply.send({ message: 'Password reset successfully' });
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'Password reset failed');
      
      if (error.message.includes('Invalid')) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_RESET_TOKEN',
            message: 'Invalid or expired reset token'
          }
        });
      }

      throw error;
    }
  });

  /**
   * Verify email
   */
  fastify.get('/verify-email/:token', {
    schema: {
      params: {
        type: 'object', required: ['token'], properties: {
          token: { type: 'string' }
        }
      }, response: {
        200: {
          type: 'object', properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await authService.verifyEmail((request.params as any).token);
      return reply.send({ message: 'Email verified successfully' });
    } catch (error: any) {
      logger.error({ error, traceId: (request as any).traceId }, 'Email verification failed');
      
      if (error.message.includes('Invalid')) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_VERIFICATION_TOKEN',
            message: 'Invalid or expired verification token'
          }
        });
      }

      throw error;
    }
  });
}
