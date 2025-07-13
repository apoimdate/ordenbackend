// User Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'USER' | 'SELLER' | 'ADMIN' | 'SUPER_ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION' | 'DELETED';
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

// Seller Types
export interface Seller {
  id: string;
  userId: string;
  businessName: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'UNDER_REVIEW' | 'ON_VACATION';
  commission: number;
  goMembershipTier?: string;
  createdAt: string;
  updatedAt: string;
  user: User;
}

// Product Types
export interface Product {
  id: string;
  sellerId: string;
  name: string;
  description: string;
  price: number;
  currency: 'USD' | 'EUR';
  status: 'DRAFT' | 'PENDING_ADMIN_APPROVAL' | 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  categoryId: string;
  images: ProductImage[];
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
  seller: Seller;
  category: Category;
}

export interface ProductImage {
  id: string;
  url: string;
  altText?: string;
  isPrimary: boolean;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  imageUrl?: string;
  isActive: boolean;
}

// Order Types
export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
  currency: 'USD' | 'EUR';
  items: OrderItem[];
  user: User;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  total: number;
  product: Product;
}

// Analytics Types
export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  activeUsers: number;
  activeSellers: number;
  revenueGrowth: number;
  ordersGrowth: number;
  usersGrowth: number;
  sellersGrowth: number;
}

export interface RevenueData {
  month: string;
  revenue: number;
  orders: number;
}

export interface CategorySales {
  name: string;
  value: number;
  color: string;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

// Form Types
export interface LoginForm {
  email: string;
  password: string;
}

export interface UserCreateForm {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: 'USER' | 'SELLER' | 'ADMIN';
}

export interface ProductCreateForm {
  name: string;
  description: string;
  price: number;
  currency: 'USD' | 'EUR';
  categoryId: string;
  images: File[];
  variants: Omit<ProductVariant, 'id'>[];
}

// Filter Types
export interface UserFilters {
  search?: string;
  status?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export interface ProductFilters {
  search?: string;
  status?: string;
  categoryId?: string;
  sellerId?: string;
  page?: number;
  limit?: number;
}

export interface OrderFilters {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// Store Types
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  notifications: Notification[];
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}