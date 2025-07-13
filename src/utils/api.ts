import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';

class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL: string = 'http://localhost:3000/api') {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('admin_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('admin_token');
          window.location.href = '/login';
        }

        const message = error.response?.data?.message || 'Ocurrió un error inesperado';
        toast.error(message);

        return Promise.reject(error);
      }
    );
  }

  // Generic request method
  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<T>(config);
    return response.data;
  }

  // GET method
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  // POST method
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  // PUT method
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  // DELETE method
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  // PATCH method
  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  // Upload file method
  async upload<T>(url: string, file: File, config?: AxiosRequestConfig): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    return this.request<T>({
      ...config,
      method: 'POST',
      url,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...config?.headers,
      },
    });
  }
}

export const apiClient = new ApiClient();

// API endpoints
export const endpoints = {
  // Auth
  auth: {
    login: '/admin/auth/login',
    logout: '/admin/auth/logout',
    refresh: '/admin/auth/refresh',
    me: '/admin/auth/me',
  },

  // Dashboard
  dashboard: {
    stats: '/admin/dashboard/stats',
    revenue: '/admin/dashboard/revenue',
    activities: '/admin/dashboard/activities',
  },

  // Users
  users: {
    list: '/admin/users',
    create: '/admin/users',
    get: (id: string) => `/admin/users/${id}`,
    update: (id: string) => `/admin/users/${id}`,
    delete: (id: string) => `/admin/users/${id}`,
    suspend: (id: string) => `/admin/users/${id}/suspend`,
    reactivate: (id: string) => `/admin/users/${id}/reactivate`,
  },

  // Sellers
  sellers: {
    list: '/admin/sellers',
    get: (id: string) => `/admin/sellers/${id}`,
    approve: (id: string) => `/admin/sellers/${id}/approve`,
    reject: (id: string) => `/admin/sellers/${id}/reject`,
    suspend: (id: string) => `/admin/sellers/${id}/suspend`,
    reactivate: (id: string) => `/admin/sellers/${id}/reactivate`,
  },

  // Products
  products: {
    list: '/admin/products',
    get: (id: string) => `/admin/products/${id}`,
    approve: (id: string) => `/admin/products/${id}/approve`,
    reject: (id: string) => `/admin/products/${id}/reject`,
    remove: (id: string) => `/admin/products/${id}/remove`,
  },

  // Orders
  orders: {
    list: '/admin/orders',
    get: (id: string) => `/admin/orders/${id}`,
    updateStatus: (id: string) => `/admin/orders/${id}/status`,
  },

  // Categories
  categories: {
    list: '/admin/categories',
    create: '/admin/categories',
    get: (id: string) => `/admin/categories/${id}`,
    update: (id: string) => `/admin/categories/${id}`,
    delete: (id: string) => `/admin/categories/${id}`,
  },

  // Analytics
  analytics: {
    overview: '/admin/analytics/overview',
    revenue: '/admin/analytics/revenue',
    users: '/admin/analytics/users',
    products: '/admin/analytics/products',
    sales: '/admin/analytics/sales',
  },

  // Reports
  reports: {
    generate: '/admin/reports/generate',
    list: '/admin/reports',
    download: (id: string) => `/admin/reports/${id}/download`,
  },

  // System
  system: {
    health: '/admin/system/health',
    settings: '/admin/system/settings',
    maintenance: '/admin/system/maintenance',
  },
};

// Utility functions
export const formatError = (error: any): string => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'Ocurrió un error inesperado';
};

export const handleApiError = (error: any) => {
  const message = formatError(error);
  toast.error(message);
  console.error('API Error:', error);
};

export default apiClient;