import { api } from '@/lib/api'
import {
  DashboardResponse,
  RealtimeStats,
  RevenueAnalytics,
  UserAnalytics,
  SellerAnalytics,
  PlatformHealth,
  Alert,
  PaginatedResponse,
} from '@/types'

export class DashboardService {
  // Get dashboard overview
  static async getDashboard(): Promise<DashboardResponse> {
    return api.get('/dashboard')
  }

  // Get real-time statistics
  static async getRealtimeStats(): Promise<RealtimeStats> {
    return api.get('/dashboard/realtime')
  }

  // Get revenue analytics
  static async getRevenueAnalytics(params?: {
    startDate?: string
    endDate?: string
    groupBy?: string
  }): Promise<RevenueAnalytics> {
    return api.get('/dashboard/revenue', params)
  }

  // Get user analytics
  static async getUserAnalytics(params?: {
    startDate?: string
    endDate?: string
  }): Promise<UserAnalytics> {
    return api.get('/dashboard/users', params)
  }

  // Get seller analytics
  static async getSellerAnalytics(params?: {
    startDate?: string
    endDate?: string
    limit?: string
  }): Promise<SellerAnalytics> {
    return api.get('/dashboard/sellers', params)
  }

  // Get platform health
  static async getPlatformHealth(): Promise<PlatformHealth> {
    return api.get('/dashboard/health')
  }

  // Get alerts
  static async getAlerts(params?: {
    severity?: string
    status?: string
    page?: string
    limit?: string
  }): Promise<PaginatedResponse<Alert>> {
    return api.get('/dashboard/alerts', params)
  }

  // Acknowledge alert
  static async acknowledgeAlert(alertId: string): Promise<{ success: boolean }> {
    return api.post(`/dashboard/alerts/${alertId}/acknowledge`)
  }

  // Export dashboard data
  static async exportDashboardData(params?: {
    format?: string
    sections?: string
    startDate?: string
    endDate?: string
  }): Promise<{
    exportId: string
    status: string
    estimatedTime: number
    downloadUrl: string
  }> {
    return api.get('/dashboard/export', params)
  }
}