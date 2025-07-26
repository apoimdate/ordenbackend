import { EmailTemplate } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { CrudService } from './crud.service';
import { ServiceResult } from '../types';
import { ApiError } from '../utils/errors';
import { cache } from '../utils/cache';
import { nanoid } from 'nanoid';

interface CreateEmailTemplateData {
  name: string;
  subject: string;
  body: string;
  variables?: string[];
  isActive?: boolean;
}

interface EmailPreview {
  subject: string;
  html: string;
  text: string;
  variables: Record<string, any>;
}

interface SendEmailData {
  templateId: string;
  to: string | string[];
  variables: Record<string, any>;
}

export class EmailTemplateService extends CrudService<EmailTemplate> {
  modelName = 'emailTemplate' as const;

  constructor(app: FastifyInstance) {
    super(app);
  }

  /**
   * Create a new email template
   */
  async createTemplate(data: CreateEmailTemplateData): Promise<ServiceResult<EmailTemplate>> {
    try {
      // Check if template with same name exists
      const existing = await this.prisma.emailTemplate.findUnique({
        where: { name: data.name }
      });

      if (existing) {
        return {
          success: false,
          error: new ApiError('Template with this name already exists', 400, 'DUPLICATE_TEMPLATE')
        };
      }

      // Extract variables from templates
      const subjectVars = this.extractVariables(data.subject);
      const bodyVars = this.extractVariables(data.body);
      const allVars = [...new Set([...(data.variables || []), ...subjectVars, ...bodyVars])];

      // Create template
      const template = await this.prisma.emailTemplate.create({
        data: {
          id: nanoid(),
          name: data.name,
          subject: data.subject,
          body: data.body,
          variables: allVars,
          isActive: data.isActive ?? true
        }
      });

      // Clear cache
      await cache.invalidatePattern('email-templates:*');

      return { success: true, data: template };
    } catch (error) {
      this.logger.error({ error }, 'Failed to create email template');
      return {
        success: false,
        error: new ApiError('Failed to create template', 500, 'CREATE_TEMPLATE_ERROR')
      };
    }
  }

  /**
   * Get template by name
   */
  async getTemplateByName(name: string): Promise<ServiceResult<EmailTemplate | null>> {
    try {
      const cacheKey = `email-templates:${name}`;
      const cached = await cache.get<EmailTemplate>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const template = await this.prisma.emailTemplate.findUnique({
        where: { name }
      });

      if (template) {
        await cache.set(cacheKey, template, { ttl: 3600 });
      }

      return { success: true, data: template };
    } catch (error) {
      this.logger.error({ error, name }, 'Failed to get template by name');
      return {
        success: false,
        error: new ApiError('Failed to get template', 500, 'GET_TEMPLATE_ERROR')
      };
    }
  }

  /**
   * Preview email template
   */
  async previewTemplate(templateId: string, variables: Record<string, any> = {}): Promise<ServiceResult<EmailPreview>> {
    try {
      const template = await this.prisma.emailTemplate.findUnique({
        where: { id: templateId }
      });

      if (!template) {
        return {
          success: false,
          error: new ApiError('Template not found', 404, 'TEMPLATE_NOT_FOUND')
        };
      }

      // Merge with default variables
      const mergedVariables = {
        ...this.getDefaultVariables(),
        ...variables
      };

      // Render templates
      const preview: EmailPreview = {
        subject: this.renderTemplate(template.subject, mergedVariables),
        html: this.renderTemplate(template.body, mergedVariables),
        text: this.htmlToText(this.renderTemplate(template.body, mergedVariables)),
        variables: mergedVariables
      };

      return { success: true, data: preview };
    } catch (error: any) {
      this.logger.error({ error, templateId }, 'Failed to preview template');
      return {
        success: false,
        error: new ApiError(`Failed to preview template: ${error.message}`, 500, 'PREVIEW_ERROR')
      };
    }
  }

  /**
   * Send email using template (placeholder implementation)
   */
  async sendEmail(data: SendEmailData): Promise<ServiceResult<{ messageId: string }>> {
    try {
      const template = await this.prisma.emailTemplate.findUnique({
        where: { id: data.templateId }
      });

      if (!template) {
        return {
          success: false,
          error: new ApiError('Template not found', 404, 'TEMPLATE_NOT_FOUND')
        };
      }

      if (!template.isActive) {
        return {
          success: false,
          error: new ApiError('Template is not active', 400, 'TEMPLATE_INACTIVE')
        };
      }

      // Merge variables
      const variables = {
        ...this.getDefaultVariables(),
        ...data.variables
      };

      // Simple template replacement
      const subject = this.renderTemplate(template.subject, variables);
      this.renderTemplate(template.body, variables); // Generate HTML but don't store

      // Log email send attempt (placeholder for actual email sending)
      this.logger.info({
        templateId: template.id,
        to: data.to,
        subject
      }, 'Email would be sent');

      return {
        success: true,
        data: { messageId: nanoid() }
      };
    } catch (error) {
      this.logger.error({ error, templateId: data.templateId }, 'Failed to send email');
      return {
        success: false,
        error: new ApiError('Failed to send email', 500, 'SEND_EMAIL_ERROR')
      };
    }
  }

  /**
   * Clone template
   */
  async cloneTemplate(templateId: string, newName: string): Promise<ServiceResult<EmailTemplate>> {
    try {
      const original = await this.prisma.emailTemplate.findUnique({
        where: { id: templateId }
      });

      if (!original) {
        return {
          success: false,
          error: new ApiError('Template not found', 404, 'TEMPLATE_NOT_FOUND')
        };
      }

      const clone = await this.prisma.emailTemplate.create({
        data: {
          id: nanoid(),
          name: newName,
          subject: original.subject,
          body: original.body,
          variables: original.variables,
          isActive: false
        }
      });

      return { success: true, data: clone };
    } catch (error) {
      this.logger.error({ error, templateId }, 'Failed to clone template');
      return {
        success: false,
        error: new ApiError('Failed to clone template', 500, 'CLONE_ERROR')
      };
    }
  }

  /**
   * Create standard email templates
   */
  async createStandardTemplates(): Promise<ServiceResult<{ created: number }>> {
    try {
      const standardTemplates = [
        {
          name: 'Order Confirmation',
          subject: 'Order {orderNumber} Confirmed',
          body: `
            <h1>Thank you for your order!</h1>
            <p>Hi {customerName},</p>
            <p>Your order {orderNumber} has been confirmed.</p>
            <p><strong>Total: {orderTotal}</strong></p>
          `,
          variables: ['orderNumber', 'customerName', 'orderTotal']
        },
        {
          name: 'Password Reset',
          subject: 'Reset Your Password',
          body: `
            <h1>Password Reset Request</h1>
            <p>Hi {firstName},</p>
            <p>You requested to reset your password. Click the link below:</p>
            <p><a href="{resetUrl}">Reset Password</a></p>
            <p>This link will expire in 24 hours.</p>
          `,
          variables: ['firstName', 'resetUrl']
        },
        {
          name: 'Welcome Email',
          subject: 'Welcome to {siteName}!',
          body: `
            <h1>Welcome to {siteName}!</h1>
            <p>Hi {firstName},</p>
            <p>Thank you for joining us!</p>
          `,
          variables: ['firstName', 'siteName']
        }
      ];

      let created = 0;
      for (const template of standardTemplates) {
        const existing = await this.prisma.emailTemplate.findUnique({
          where: { name: template.name }
        });

        if (!existing) {
          await this.createTemplate(template);
          created++;
        }
      }

      return {
        success: true,
        data: { created }
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to create standard templates');
      return {
        success: false,
        error: new ApiError('Failed to create standard templates', 500, 'CREATE_STANDARD_ERROR')
      };
    }
  }

  /**
   * Get default template variables
   */
  private getDefaultVariables(): Record<string, any> {
    return {
      siteName: process.env.SITE_NAME || 'OrderDirecta',
      siteUrl: process.env.SITE_URL || 'https://ordendirecta.com',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@ordendirecta.com',
      year: new Date().getFullYear(),
      date: new Date()
    };
  }

  /**
   * Simple template renderer
   */
  private renderTemplate(template: string, variables: Record<string, any>): string {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    });
    return result;
  }

  /**
   * Extract variables from template
   */
  private extractVariables(template: string): string[] {
    const matches = template.match(/\{([^}]+)\}/g) || [];
    return matches.map(match => match.slice(1, -1));
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}