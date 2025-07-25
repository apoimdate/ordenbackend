import { describe, test, expect, beforeEach } from '@jest/globals';
import { 
  setupTestApp, 
  createTestUser, 
  generateTestJWT,
  cleanupDatabase,
  expectValidationError,
  expectUnauthorized
} from '../setup';
import { AuthService } from '../../src/services/auth.service';

describe('Authentication Service', () => {
  let app: any;
  let authService: AuthService;

  beforeEach(async () => {
    app = await setupTestApp();
    authService = new AuthService(app);
    await cleanupDatabase();
  });

  describe('User Registration', () => {
    test('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      const result = await authService.register(userData);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('user');
      expect(result.data).toHaveProperty('token');
      expect(result.data?.user.email).toBe(userData.email);
      expect(result.data?.user.password).toBeUndefined(); // Password should not be returned
    });

    test('should not register user with existing email', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      // Create first user
      await authService.register(userData);

      // Try to create second user with same email
      const result = await authService.register(userData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    test('should validate password requirements', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'weak',
        firstName: 'John',
        lastName: 'Doe'
      };

      const result = await authService.register(userData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('WEAK_PASSWORD');
    });
  });

  describe('User Login', () => {
    test('should login with valid credentials', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      // Register user first
      await authService.register(userData);

      // Login
      const result = await authService.login({
        email: userData.email,
        password: userData.password
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('user');
      expect(result.data).toHaveProperty('token');
      expect(result.data).toHaveProperty('refreshToken');
    });

    test('should not login with invalid credentials', async () => {
      const result = await authService.login({
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_CREDENTIALS');
    });

    test('should not login inactive user', async () => {
      const user = await createTestUser({ status: 'INACTIVE' });

      const result = await authService.login({
        email: user.email,
        password: 'Password123!'
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ACCOUNT_INACTIVE');
    });
  });

  describe('Token Management', () => {
    test('should refresh token successfully', async () => {
      const user = await createTestUser();
      const refreshToken = await authService.generateRefreshToken(user.id);

      const result = await authService.refreshToken(refreshToken);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('token');
      expect(result.data).toHaveProperty('refreshToken');
    });

    test('should not refresh with invalid token', async () => {
      const result = await authService.refreshToken('invalid-refresh-token');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_REFRESH_TOKEN');
    });

    test('should logout and invalidate tokens', async () => {
      const user = await createTestUser();
      const refreshToken = await authService.generateRefreshToken(user.id);

      const result = await authService.logout(user.id, refreshToken);

      expect(result.success).toBe(true);

      // Try to use the refresh token again
      const refreshResult = await authService.refreshToken(refreshToken);
      expect(refreshResult.success).toBe(false);
    });
  });

  describe('Password Management', () => {
    test('should initiate password reset', async () => {
      const user = await createTestUser();

      const result = await authService.initiatePasswordReset(user.email);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('resetToken');
    });

    test('should reset password with valid token', async () => {
      const user = await createTestUser();
      const resetResult = await authService.initiatePasswordReset(user.email);
      const resetToken = resetResult.data?.resetToken;

      const result = await authService.resetPassword(resetToken!, 'NewPassword123!');

      expect(result.success).toBe(true);

      // Verify login with new password
      const loginResult = await authService.login({
        email: user.email,
        password: 'NewPassword123!'
      });
      expect(loginResult.success).toBe(true);
    });

    test('should change password for authenticated user', async () => {
      const user = await createTestUser();
      
      const result = await authService.changePassword(
        user.id,
        'Password123!', // Current password (assuming this is the default from createTestUser)
        'NewPassword123!'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Email Verification', () => {
    test('should send verification email', async () => {
      const user = await createTestUser({ emailVerified: false });

      const result = await authService.sendVerificationEmail(user.id);

      expect(result.success).toBe(true);
    });

    test('should verify email with valid token', async () => {
      const user = await createTestUser({ emailVerified: false });
      const verificationResult = await authService.sendVerificationEmail(user.id);
      const verificationToken = verificationResult.data?.verificationToken;

      const result = await authService.verifyEmail(verificationToken!);

      expect(result.success).toBe(true);

      // Check that user is now verified
      const updatedUser = await app.prisma.user.findUnique({
        where: { id: user.id }
      });
      expect(updatedUser?.emailVerified).toBe(true);
    });
  });
});

describe('Authentication Routes', () => {
  let app: any;

  beforeEach(async () => {
    app = await setupTestApp();
    await cleanupDatabase();
  });

  describe('POST /api/auth/register', () => {
    test('should register new user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'Password123!',
          firstName: 'John',
          lastName: 'Doe'
        }
      });

      expect(response.statusCode).toBe(201);
      const data = response.json();
      expect(data.user).toBeDefined();
      expect(data.token).toBeDefined();
    });

    test('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'weak'
        }
      });

      expectValidationError(response);
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login existing user', async () => {
      // Register user first
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'Password123!',
          firstName: 'John',
          lastName: 'Doe'
        }
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'Password123!'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.user).toBeDefined();
      expect(data.token).toBeDefined();
      expect(data.refreshToken).toBeDefined();
    });

    test('should reject invalid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        }
      });

      expectUnauthorized(response);
    });
  });

  describe('POST /api/auth/refresh', () => {
    test('should refresh valid token', async () => {
      // Register and login to get refresh token
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'Password123!',
          firstName: 'John',
          lastName: 'Doe'
        }
      });

      const loginData = registerResponse.json();
      const refreshToken = loginData.refreshToken;

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          refreshToken
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.token).toBeDefined();
      expect(data.refreshToken).toBeDefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout authenticated user', async () => {
      const user = await createTestUser();
      const token = await generateTestJWT(user);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      expect(response.statusCode).toBe(200);
    });

    test('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout'
      });

      expectUnauthorized(response);
    });
  });

  describe('Password Reset Flow', () => {
    test('should complete password reset flow', async () => {
      const user = await createTestUser();

      // Request password reset
      const resetResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: {
          email: user.email
        }
      });

      expect(resetResponse.statusCode).toBe(200);

      // In a real scenario, the reset token would be sent via email
      // For testing, we'll get it from the response
      const resetData = resetResponse.json();
      const resetToken = resetData.resetToken;

      // Reset password with token
      const newPasswordResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: {
          token: resetToken,
          newPassword: 'NewPassword123!'
        }
      });

      expect(newPasswordResponse.statusCode).toBe(200);

      // Verify login with new password
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: user.email,
          password: 'NewPassword123!'
        }
      });

      expect(loginResponse.statusCode).toBe(200);
    });
  });
});