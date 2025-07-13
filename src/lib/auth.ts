import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { LoginCredentials, LoginResponse } from '@/types'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        twoFactorCode: { label: 'Two Factor Code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_ADMIN_API_URL}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
              twoFactorCode: credentials.twoFactorCode || undefined,
            } as LoginCredentials),
          })

          if (!response.ok) {
            const error = await response.json()
            
            // Handle 2FA required case
            if (response.status === 428) {
              throw new Error('TWO_FACTOR_REQUIRED')
            }
            
            throw new Error(error.message || 'Authentication failed')
          }

          const data: LoginResponse = await response.json()

          return {
            id: data.user.id,
            email: data.user.email,
            name: `${data.user.firstName} ${data.user.lastName}`,
            role: data.user.roleType,
            permissions: data.user.permissions,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          }
        } catch (error) {
          console.error('Auth error:', error)
          throw error
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        return {
          ...token,
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          role: user.role,
          permissions: user.permissions,
        }
      }

      // Check if token needs refresh
      if (token.accessToken) {
        // TODO: Implement token refresh logic
        // const refreshedToken = await refreshAccessToken(token)
        // if (refreshedToken) return refreshedToken
      }

      return token
    },
    async session({ session, token }) {
      return {
        ...session,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        user: {
          ...session.user,
          role: token.role,
          permissions: token.permissions,
        },
      }
    },
  },
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
  events: {
    async signOut() {
      // Clean up on sign out
    },
  },
}

// Helper function to refresh access token
async function refreshAccessToken(token: any) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_ADMIN_API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken: token.refreshToken,
      }),
    })

    if (!response.ok) {
      throw new Error('Token refresh failed')
    }

    const refreshedTokens = await response.json()

    return {
      ...token,
      accessToken: refreshedTokens.accessToken,
      refreshToken: refreshedTokens.refreshToken,
    }
  } catch (error) {
    console.error('Token refresh error:', error)
    return null
  }
}