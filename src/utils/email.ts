import nodemailer from 'nodemailer';
import { logger } from './logger';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

export interface EmailTemplateData {
  [key: string]: any;
}

class EmailService {
  private transporter!: nodemailer.Transporter;
  private defaultFrom: string;
  private isConfigured: boolean = false;

  constructor() {
    this.defaultFrom = process.env.EMAIL_FROM || 'noreply@ordendirecta.com';
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      const emailConfig = {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        tls: {
          rejectUnauthorized: false // Allow self-signed certificates in development
        }
      };

      // Check if email credentials are configured
      if (!emailConfig.auth.user || !emailConfig.auth.pass) {
        logger.warn('Email service not configured - missing EMAIL_USER or EMAIL_PASS');
        this.isConfigured = false;
        return;
      }

      this.transporter = nodemailer.createTransport(emailConfig);
      this.isConfigured = true;

      // Verify the connection
      this.transporter.verify((error) => {
        if (error) {
          logger.error({ error }, 'Email service configuration failed');
          this.isConfigured = false;
        } else {
          logger.info('Email service configured successfully');
        }
      });
    } catch (error) {
      logger.error({ error }, 'Failed to initialize email service');
      this.isConfigured = false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured) {
      logger.warn('Email service not configured - email not sent', { to: options.to, subject: options.subject });
      return false;
    }

    try {
      const mailOptions = {
        from: options.from || this.defaultFrom,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        attachments: options.attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info({
        messageId: result.messageId,
        to: options.to,
        subject: options.subject
      }, 'Email sent successfully');

      return true;
    } catch (error) {
      logger.error({
        error,
        to: options.to,
        subject: options.subject
      }, 'Failed to send email');
      return false;
    }
  }

  // Email verification template
  async sendVerificationEmail(
    email: string,
    firstName: string,
    verificationToken: string,
    baseUrl: string = process.env.FRONTEND_URL || 'http://localhost:3000'
  ): Promise<boolean> {
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verificar tu cuenta</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: bold; color: #007bff; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 8px; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">OrdenDirecta</div>
          </div>
          
          <div class="content">
            <h2>¡Bienvenido/a ${firstName}!</h2>
            <p>Gracias por registrarte en OrdenDirecta. Para completar tu registro, necesitas verificar tu dirección de correo electrónico.</p>
            
            <p>Haz clic en el siguiente botón para verificar tu cuenta:</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verificar mi cuenta</a>
            </div>
            
            <p>Si el botón no funciona, puedes copiar y pegar este enlace en tu navegador:</p>
            <p style="word-break: break-all; background: #f1f3f4; padding: 10px; border-radius: 3px; font-family: monospace;">
              ${verificationUrl}
            </p>
            
            <div class="warning">
              <strong>Importante:</strong> Este enlace expirará en 24 horas por motivos de seguridad.
            </div>
          </div>
          
          <div class="footer">
            <p>Si no creaste esta cuenta, puedes ignorar este correo electrónico.</p>
            <p>&copy; ${new Date().getFullYear()} OrdenDirecta. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
¡Bienvenido/a ${firstName}!

Gracias por registrarte en OrdenDirecta. Para completar tu registro, necesitas verificar tu dirección de correo electrónico.

Visita este enlace para verificar tu cuenta:
${verificationUrl}

Este enlace expirará en 24 horas por motivos de seguridad.

Si no creaste esta cuenta, puedes ignorar este correo electrónico.

© ${new Date().getFullYear()} OrdenDirecta. Todos los derechos reservados.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Verifica tu cuenta en OrdenDirecta',
      html,
      text
    });
  }

  // Password reset template
  async sendPasswordResetEmail(
    email: string,
    firstName: string,
    resetToken: string,
    baseUrl: string = process.env.FRONTEND_URL || 'http://localhost:3000'
  ): Promise<boolean> {
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablecer contraseña</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: bold; color: #007bff; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 8px; }
          .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; }
          .warning { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .security-info { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">OrdenDirecta</div>
          </div>
          
          <div class="content">
            <h2>Solicitud para restablecer contraseña</h2>
            <p>Hola ${firstName},</p>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta de OrdenDirecta.</p>
            
            <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Restablecer contraseña</a>
            </div>
            
            <p>Si el botón no funciona, puedes copiar y pegar este enlace en tu navegador:</p>
            <p style="word-break: break-all; background: #f1f3f4; padding: 10px; border-radius: 3px; font-family: monospace;">
              ${resetUrl}
            </p>
            
            <div class="warning">
              <strong>Importante:</strong> Este enlace expirará en 1 hora por motivos de seguridad.
            </div>
            
            <div class="security-info">
              <strong>Consejos de seguridad:</strong>
              <ul>
                <li>Nunca compartas tu contraseña con nadie</li>
                <li>Usa una contraseña fuerte y única</li>
                <li>Si no solicitaste este cambio, contacta con soporte inmediatamente</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p>Si no solicitaste restablecer tu contraseña, puedes ignorar este correo electrónico de forma segura.</p>
            <p>Tu contraseña no cambiará hasta que hagas clic en el enlace y crees una nueva.</p>
            <p>&copy; ${new Date().getFullYear()} OrdenDirecta. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Solicitud para restablecer contraseña

Hola ${firstName},

Recibimos una solicitud para restablecer la contraseña de tu cuenta de OrdenDirecta.

Visita este enlace para crear una nueva contraseña:
${resetUrl}

Este enlace expirará en 1 hora por motivos de seguridad.

Consejos de seguridad:
- Nunca compartas tu contraseña con nadie
- Usa una contraseña fuerte y única
- Si no solicitaste este cambio, contacta con soporte inmediatamente

Si no solicitaste restablecer tu contraseña, puedes ignorar este correo electrónico de forma segura.
Tu contraseña no cambiará hasta que hagas clic en el enlace y crees una nueva.

© ${new Date().getFullYear()} OrdenDirecta. Todos los derechos reservados.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Restablecer contraseña - OrdenDirecta',
      html,
      text
    });
  }

  // Order confirmation template
  async sendOrderConfirmationEmail(
    email: string,
    firstName: string,
    orderNumber: string,
    orderTotal: string,
    items: Array<{ name: string; quantity: number; price: string }>,
    baseUrl: string = process.env.FRONTEND_URL || 'http://localhost:3000'
  ): Promise<boolean> {
    const orderUrl = `${baseUrl}/orders/${orderNumber}`;
    
    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.price}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmación de pedido</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: bold; color: #007bff; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 8px; }
          .order-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .order-table { width: 100%; border-collapse: collapse; }
          .order-table th { background: #f1f3f4; padding: 10px; text-align: left; }
          .total { font-weight: bold; font-size: 18px; color: #007bff; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">OrdenDirecta</div>
          </div>
          
          <div class="content">
            <h2>¡Pedido confirmado!</h2>
            <p>Hola ${firstName},</p>
            <p>Gracias por tu pedido. Hemos recibido tu solicitud y la estamos procesando.</p>
            
            <div class="order-details">
              <h3>Detalles del pedido #${orderNumber}</h3>
              <table class="order-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style="text-align: center;">Cantidad</th>
                    <th style="text-align: right;">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                  <tr>
                    <td colspan="2" style="padding: 15px; font-weight: bold; border-top: 2px solid #007bff;">Total:</td>
                    <td style="padding: 15px; text-align: right; font-weight: bold; border-top: 2px solid #007bff;" class="total">${orderTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div style="text-align: center;">
              <a href="${orderUrl}" class="button">Ver detalles del pedido</a>
            </div>
            
            <p>Te notificaremos cuando tu pedido sea enviado.</p>
          </div>
          
          <div class="footer">
            <p>¿Tienes preguntas? Contacta con nuestro equipo de soporte.</p>
            <p>&copy; ${new Date().getFullYear()} OrdenDirecta. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `Confirmación de pedido #${orderNumber} - OrdenDirecta`,
      html
    });
  }

  // Generic template method for custom emails
  async sendTemplateEmail(
    template: 'welcome' | 'order_shipped' | 'payment_failed' | 'account_suspended' | 'custom',
    email: string,
    data: EmailTemplateData
  ): Promise<boolean> {
    // This can be extended with more templates as needed
    switch (template) {
      case 'welcome':
        return this.sendVerificationEmail(
          email,
          data.firstName || 'Usuario',
          data.verificationToken,
          data.baseUrl
        );
      default:
        logger.warn(`Email template '${template}' not implemented`);
        return false;
    }
  }

  // Test email configuration
  async testConfiguration(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      const testResult = await this.transporter.verify();
      return testResult;
    } catch (error) {
      logger.error({ error }, 'Email configuration test failed');
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
export { EmailService };