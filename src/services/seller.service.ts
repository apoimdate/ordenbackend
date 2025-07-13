import { api } from '@/lib/api'
import {
  Seller,
  SellerFilters,
  PaginatedResponse,
  SellerApprovalForm,
} from '@/types'

export class SellerService {
  // Get sellers with pagination and filtering
  static async getSellers(filters?: SellerFilters): Promise<PaginatedResponse<Seller>> {
    return api.get('/sellers', filters)
  }

  // Get seller by ID
  static async getSellerById(id: string): Promise<Seller> {
    return api.get(`/sellers/${id}`)
  }

  // Approve or reject seller
  static async updateSellerStatus(
    id: string,
    data: SellerApprovalForm
  ): Promise<{ success: boolean; message: string }> {
    return api.patch(`/sellers/${id}/status`, data)
  }

  // Get seller analytics
  static async getSellerAnalytics(id: string): Promise<{
    totalSales: number
    totalOrders: number
    averageOrderValue: number
    rating: number
    salesGrowth: number
    topProducts: Array<{
      id: string
      name: string
      sales: number
      revenue: number
    }>
    recentOrders: Array<{
      id: string
      orderNumber: string
      total: number
      status: string
      createdAt: string
    }>
  }> {
    return api.get(`/sellers/${id}/analytics`)
  }

  // Suspend seller account
  static async suspendSeller(
    id: string,
    data: { reason: string; duration?: number }
  ): Promise<{ success: boolean; message: string }> {
    return api.post(`/sellers/${id}/suspend`, data)
  }

  // Reactivate seller account
  static async reactivateSeller(id: string): Promise<{ success: boolean; message: string }> {
    return api.post(`/sellers/${id}/reactivate`)
  }

  // Get seller verification documents
  static async getSellerDocuments(id: string): Promise<{
    businessLicense?: string
    taxCertificate?: string
    identityDocument?: string
    bankStatement?: string
  }> {
    return api.get(`/sellers/${id}/documents`)
  }

  // Update seller commission
  static async updateSellerCommission(
    id: string,
    data: { commission: number; reason: string }
  ): Promise<{ success: boolean; message: string }> {
    return api.patch(`/sellers/${id}/commission`, data)
  }

  // Get seller activity log
  static async getSellerActivity(
    id: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<{
    id: string
    action: string
    description: string
    timestamp: string
    metadata?: Record<string, any>
  }>> {
    return api.get(`/sellers/${id}/activity`, params)
  }

  // Get pending seller approvals count
  static async getPendingApprovalsCount(): Promise<{ count: number }> {
    return api.get('/sellers/pending/count')
  }

  // Bulk approve sellers
  static async bulkApproveSellers(
    sellerIds: string[]
  ): Promise<{ success: boolean; approved: number; failed: number }> {
    return api.post('/sellers/bulk/approve', { sellerIds })
  }

  // Export sellers data
  static async exportSellers(
    filters?: SellerFilters & { format?: 'csv' | 'excel' }
  ): Promise<Blob> {
    const response = await api.get('/sellers/export', filters)
    return response
  }
}