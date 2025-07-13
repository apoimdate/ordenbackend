'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  IconButton,
  TextField,
  InputAdornment,
  MenuItem,
  Chip,
  Menu,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Alert,
  Snackbar,
  LinearProgress,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  Divider,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
  Badge,
  Tooltip,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Search,
  FilterList,
  MoreVert,
  Email,
  Phone,
  LocationOn,
  Store,
  Person,
  Schedule,
  LocalShipping,
  Payment,
  Assignment,
  CheckCircle,
  Cancel,
  Warning,
  TrendingUp,
  AttachMoney,
  Edit,
  Visibility,
  Print,
  Download,
  RefreshOutlined,
  ShoppingCart,
  CreditCard,
  AccountBalanceWallet,
  Block,
  AssignmentReturn,
  LocalShippingOutlined,
  PendingActions,
  AssignmentTurnedIn,
  ContentCopy,
  Flag,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from 'recharts';

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  variantName?: string;
  quantity: number;
  price: number;
  total: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
  paymentStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod: 'STRIPE_CARD' | 'PAYPAL' | 'WALLET' | 'BANK_TRANSFER';
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    avatar?: string;
  };
  seller: {
    id: string;
    businessName: string;
    email: string;
  };
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  commission: number;
  sellerPayout: number;
  currency: 'USD' | 'EUR';
  deliveryAddress: {
    firstName: string;
    lastName: string;
    phone: string;
    country: string;
    province: string;
    municipality: string;
    address: string;
    instructions?: string;
  };
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  notes?: string;
  flagged: boolean;
  flagReason?: string;
  createdAt: string;
  updatedAt: string;
  timeline: {
    status: string;
    timestamp: string;
    note?: string;
    user?: string;
  }[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`order-tabpanel-${index}`}
      aria-labelledby={`order-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalOrders, setTotalOrders] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [tabValue, setTabValue] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [statusDialog, setStatusDialog] = useState(false);
  const [flagDialog, setFlagDialog] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [flagReason, setFlagReason] = useState('');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    totalRevenue: 0,
    totalCommission: 0,
    todayOrders: 0,
    todayRevenue: 0,
  });

  // Chart data
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    fetchOrders();
  }, [page, rowsPerPage, searchQuery, statusFilter, paymentFilter, dateFilter, tabValue]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Mock data
      const mockOrders: Order[] = Array.from({ length: 200 }, (_, i) => ({
        id: `ord_${i + 1}`,
        orderNumber: `ORD-2024-${String(1000 + i).padStart(4, '0')}`,
        status: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'][
          Math.floor(Math.random() * 7)
        ] as Order['status'],
        paymentStatus: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED'][
          Math.floor(Math.random() * 5)
        ] as Order['paymentStatus'],
        paymentMethod: ['STRIPE_CARD', 'PAYPAL', 'WALLET', 'BANK_TRANSFER'][
          Math.floor(Math.random() * 4)
        ] as Order['paymentMethod'],
        customer: {
          id: `cust_${i + 1}`,
          name: `Customer ${i + 1}`,
          email: `customer${i + 1}@example.com`,
          phone: `+1555000${String(i).padStart(4, '0')}`,
          avatar: Math.random() > 0.5 ? `/images/avatars/avatar-${(i % 10) + 1}.jpg` : undefined,
        },
        seller: {
          id: `sel_${i % 20 + 1}`,
          businessName: `Seller ${i % 20 + 1}`,
          email: `seller${i % 20 + 1}@example.com`,
        },
        items: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, j) => ({
          id: `item_${i}_${j}`,
          productId: `prod_${i}_${j}`,
          productName: `Product ${i + 1}-${j + 1}`,
          productImage: `/images/products/product-${(j % 5) + 1}.jpg`,
          variantName: Math.random() > 0.5 ? 'Size M - Blue' : undefined,
          quantity: Math.floor(Math.random() * 3) + 1,
          price: Math.floor(Math.random() * 100) * 1000 + 10000,
          total: 0, // Will calculate
        })),
        subtotal: 0, // Will calculate
        tax: 0, // Will calculate
        shipping: Math.random() > 0.3 ? Math.floor(Math.random() * 1000) + 500 : 0,
        discount: Math.random() > 0.7 ? Math.floor(Math.random() * 5000) : 0,
        total: 0, // Will calculate
        commission: 0, // Will calculate
        sellerPayout: 0, // Will calculate
        currency: Math.random() > 0.7 ? 'EUR' : 'USD',
        deliveryAddress: {
          firstName: 'John',
          lastName: 'Doe',
          phone: '+15550001234',
          country: 'USA',
          province: 'Florida',
          municipality: 'Miami',
          address: '123 Main St, Apt 4B',
          instructions: Math.random() > 0.5 ? 'Leave at door' : undefined,
        },
        trackingNumber: ['SHIPPED', 'DELIVERED'].includes(
          ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'][
            Math.floor(Math.random() * 7)
          ]
        )
          ? `TRK${String(Math.floor(Math.random() * 1000000)).padStart(10, '0')}`
          : undefined,
        estimatedDelivery: dayjs()
          .add(Math.floor(Math.random() * 7) + 1, 'day')
          .format('YYYY-MM-DD'),
        notes: Math.random() > 0.7 ? 'Customer requested gift wrapping' : undefined,
        flagged: Math.random() > 0.9,
        flagReason: Math.random() > 0.9 ? 'Suspicious payment activity' : undefined,
        createdAt: dayjs()
          .subtract(Math.floor(Math.random() * 30), 'day')
          .toISOString(),
        updatedAt: dayjs()
          .subtract(Math.floor(Math.random() * 7), 'day')
          .toISOString(),
        timeline: [],
      }));

      // Calculate totals
      mockOrders.forEach((order) => {
        order.items.forEach((item) => {
          item.total = item.price * item.quantity;
        });
        order.subtotal = order.items.reduce((sum, item) => sum + item.total, 0);
        order.tax = order.subtotal * 0.05; // 5% tax
        order.total = order.subtotal + order.tax + order.shipping - order.discount;
        order.commission = order.subtotal * 0.15; // 15% commission
        order.sellerPayout = order.total - order.commission;

        // Generate timeline
        const statuses = ['PENDING', 'CONFIRMED'];
        if (['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status)) statuses.push('PROCESSING');
        if (['SHIPPED', 'DELIVERED'].includes(order.status)) statuses.push('SHIPPED');
        if (order.status === 'DELIVERED') statuses.push('DELIVERED');
        if (order.status === 'CANCELLED') statuses.push('CANCELLED');
        if (order.status === 'REFUNDED') statuses.push('REFUNDED');

        order.timeline = statuses.map((status, index) => ({
          status,
          timestamp: dayjs(order.createdAt)
            .add(index * 2, 'hour')
            .toISOString(),
          note: status === 'CANCELLED' ? 'Customer requested cancellation' : undefined,
          user: status === 'CONFIRMED' ? 'System' : 'Admin User',
        }));
      });

      // Apply filters
      let filtered = mockOrders;
      if (searchQuery) {
        filtered = filtered.filter(
          (o) =>
            o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.seller.businessName.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      if (statusFilter !== 'all') {
        filtered = filtered.filter((o) => o.status === statusFilter);
      }
      if (paymentFilter !== 'all') {
        filtered = filtered.filter((o) => o.paymentStatus === paymentFilter);
      }
      if (dateFilter !== 'all') {
        const now = dayjs();
        filtered = filtered.filter((o) => {
          const orderDate = dayjs(o.createdAt);
          switch (dateFilter) {
            case 'today':
              return orderDate.isSame(now, 'day');
            case 'week':
              return orderDate.isAfter(now.subtract(7, 'day'));
            case 'month':
              return orderDate.isAfter(now.subtract(30, 'day'));
            default:
              return true;
          }
        });
      }

      // Tab filters
      if (tabValue === 1) {
        filtered = filtered.filter((o) => o.status === 'PENDING');
      } else if (tabValue === 2) {
        filtered = filtered.filter((o) => ['PROCESSING', 'SHIPPED'].includes(o.status));
      } else if (tabValue === 3) {
        filtered = filtered.filter((o) => o.paymentStatus === 'PENDING');
      } else if (tabValue === 4) {
        filtered = filtered.filter((o) => o.flagged);
      }

      // Calculate stats
      const now = dayjs();
      const statsData = {
        total: mockOrders.length,
        pending: mockOrders.filter((o) => o.status === 'PENDING').length,
        processing: mockOrders.filter((o) => o.status === 'PROCESSING').length,
        shipped: mockOrders.filter((o) => o.status === 'SHIPPED').length,
        delivered: mockOrders.filter((o) => o.status === 'DELIVERED').length,
        cancelled: mockOrders.filter((o) => o.status === 'CANCELLED').length,
        totalRevenue: mockOrders.reduce((sum, o) => sum + o.total, 0),
        totalCommission: mockOrders.reduce((sum, o) => sum + o.commission, 0),
        todayOrders: mockOrders.filter((o) => dayjs(o.createdAt).isSame(now, 'day')).length,
        todayRevenue: mockOrders
          .filter((o) => dayjs(o.createdAt).isSame(now, 'day'))
          .reduce((sum, o) => sum + o.total, 0),
      };
      setStats(statsData);

      // Generate chart data
      const chartDataMap = new Map();
      for (let i = 6; i >= 0; i--) {
        const date = now.subtract(i, 'day').format('MMM D');
        chartDataMap.set(date, { date, orders: 0, revenue: 0 });
      }
      mockOrders.forEach((order) => {
        const date = dayjs(order.createdAt).format('MMM D');
        if (chartDataMap.has(date)) {
          const data = chartDataMap.get(date);
          data.orders += 1;
          data.revenue += order.total;
        }
      });
      setChartData(Array.from(chartDataMap.values()));

      setTotalOrders(filtered.length);
      setOrders(filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage));
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setSnackbar({ open: true, message: 'Failed to load orders', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedOrder || !newStatus) return;
    try {
      // API call here
      setSnackbar({
        open: true,
        message: `Order status updated to ${newStatus}`,
        severity: 'success',
      });
      setStatusDialog(false);
      fetchOrders();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update status', severity: 'error' });
    }
  };

  const handleFlagOrder = async () => {
    if (!selectedOrder || !flagReason) return;
    try {
      // API call here
      setSnackbar({
        open: true,
        message: 'Order flagged successfully',
        severity: 'success',
      });
      setFlagDialog(false);
      setFlagReason('');
      fetchOrders();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to flag order', severity: 'error' });
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'CONFIRMED':
        return 'info';
      case 'PROCESSING':
        return 'primary';
      case 'SHIPPED':
        return 'secondary';
      case 'DELIVERED':
        return 'success';
      case 'CANCELLED':
      case 'REFUNDED':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPaymentStatusColor = (status: Order['paymentStatus']) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'PROCESSING':
        return 'info';
      case 'FAILED':
      case 'REFUNDED':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPaymentMethodIcon = (method: Order['paymentMethod']) => {
    switch (method) {
      case 'STRIPE_CARD':
        return <CreditCard />;
      case 'PAYPAL':
        return <Payment />;
      case 'WALLET':
        return <AccountBalanceWallet />;
      case 'BANK_TRANSFER':
        return <AccountBalance />;
      default:
        return <Payment />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Schedule />;
      case 'CONFIRMED':
        return <Assignment />;
      case 'PROCESSING':
        return <PendingActions />;
      case 'SHIPPED':
        return <LocalShippingOutlined />;
      case 'DELIVERED':
        return <AssignmentTurnedIn />;
      case 'CANCELLED':
        return <Block />;
      case 'REFUNDED':
        return <AssignmentReturn />;
      default:
        return <CheckCircle />;
    }
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Typography variant="h4" component="h1" gutterBottom>
            Order Management
          </Typography>

          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={8}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Today's Orders
                      </Typography>
                      <Typography variant="h4">{stats.todayOrders}</Typography>
                      <Typography variant="body2" color="success.main">
                        ${stats.todayRevenue.toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Pending
                      </Typography>
                      <Typography variant="h4" color="warning.main">
                        {stats.pending}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Processing
                      </Typography>
                      <Typography variant="h4" color="primary.main">
                        {stats.processing}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Shipped
                      </Typography>
                      <Typography variant="h4" color="secondary.main">
                        {stats.shipped}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    Orders Last 7 Days
                  </Typography>
                  <ResponsiveContainer width="100%" height={100}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2196F3" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#2196F3" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="orders"
                        stroke="#2196F3"
                        fillOpacity={1}
                        fill="url(#colorOrders)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Tabs and Filters */}
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={tabValue}
              onChange={(e, v) => setTabValue(v)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="All Orders" />
              <Tab 
                label={
                  <Badge badgeContent={stats.pending} color="warning">
                    Pending
                  </Badge>
                } 
              />
              <Tab 
                label={
                  <Badge badgeContent={stats.processing + stats.shipped} color="primary">
                    In Progress
                  </Badge>
                } 
              />
              <Tab label="Payment Issues" />
              <Tab label="Flagged" />
            </Tabs>
            <Box sx={{ p: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Search by order number, customer, or seller..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      label="Status"
                    >
                      <MenuItem value="all">All Status</MenuItem>
                      <MenuItem value="PENDING">Pending</MenuItem>
                      <MenuItem value="CONFIRMED">Confirmed</MenuItem>
                      <MenuItem value="PROCESSING">Processing</MenuItem>
                      <MenuItem value="SHIPPED">Shipped</MenuItem>
                      <MenuItem value="DELIVERED">Delivered</MenuItem>
                      <MenuItem value="CANCELLED">Cancelled</MenuItem>
                      <MenuItem value="REFUNDED">Refunded</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>Payment</InputLabel>
                    <Select
                      value={paymentFilter}
                      onChange={(e) => setPaymentFilter(e.target.value)}
                      label="Payment"
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="PENDING">Pending</MenuItem>
                      <MenuItem value="COMPLETED">Completed</MenuItem>
                      <MenuItem value="FAILED">Failed</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>Date</InputLabel>
                    <Select
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      label="Date"
                    >
                      <MenuItem value="all">All Time</MenuItem>
                      <MenuItem value="today">Today</MenuItem>
                      <MenuItem value="week">Last 7 Days</MenuItem>
                      <MenuItem value="month">Last 30 Days</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      startIcon={<Download />}
                      fullWidth
                    >
                      Export
                    </Button>
                    <IconButton onClick={fetchOrders}>
                      <RefreshOutlined />
                    </IconButton>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Paper>

          {/* Orders Table */}
          {loading ? (
            <LinearProgress />
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Order</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Seller</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="center">Payment</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow
                      key={order.id}
                      hover
                      onClick={() => {
                        setSelectedOrder(order);
                        setDetailsDialog(true);
                      }}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {order.flagged && (
                            <Tooltip title={order.flagReason}>
                              <Flag color="error" fontSize="small" />
                            </Tooltip>
                          )}
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {order.orderNumber}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {order.items.length} item{order.items.length > 1 ? 's' : ''}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar src={order.customer.avatar} sx={{ width: 32, height: 32 }}>
                            {order.customer.name[0]}
                          </Avatar>
                          <Box>
                            <Typography variant="body2">{order.customer.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {order.customer.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{order.seller.businessName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {order.seller.email}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold">
                          ${order.total.toLocaleString()} {order.currency}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Commission: ${order.commission.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                          <Chip
                            label={order.paymentStatus}
                            size="small"
                            color={getPaymentStatusColor(order.paymentStatus)}
                          />
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {getPaymentMethodIcon(order.paymentMethod)}
                            <Typography variant="caption">
                              {order.paymentMethod.replace('_', ' ')}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={order.status}
                          size="small"
                          color={getStatusColor(order.status)}
                          icon={getStatusIcon(order.status)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {dayjs(order.createdAt).format('MMM D, YYYY')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {dayjs(order.createdAt).fromNow()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAnchorEl(e.currentTarget);
                            setSelectedOrder(order);
                          }}
                        >
                          <MoreVert />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={totalOrders}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
              />
            </TableContainer>
          )}
        </motion.div>

        {/* Actions Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem
            onClick={() => {
              setDetailsDialog(true);
              setAnchorEl(null);
            }}
          >
            <Visibility sx={{ mr: 1 }} /> View Details
          </MenuItem>
          <MenuItem
            onClick={() => {
              setStatusDialog(true);
              setNewStatus(selectedOrder?.status || '');
              setAnchorEl(null);
            }}
          >
            <Edit sx={{ mr: 1 }} /> Update Status
          </MenuItem>
          <MenuItem
            onClick={() => {
              // Print logic
              setAnchorEl(null);
            }}
          >
            <Print sx={{ mr: 1 }} /> Print Invoice
          </MenuItem>
          {!selectedOrder?.flagged && (
            <MenuItem
              onClick={() => {
                setFlagDialog(true);
                setAnchorEl(null);
              }}
            >
              <Flag sx={{ mr: 1 }} /> Flag Order
            </MenuItem>
          )}
          <Divider />
          <MenuItem
            onClick={() => {
              // Refund logic
              setAnchorEl(null);
            }}
            sx={{ color: 'error.main' }}
          >
            <AssignmentReturn sx={{ mr: 1 }} /> Process Refund
          </MenuItem>
        </Menu>

        {/* Order Details Dialog */}
        <Dialog
          open={detailsDialog}
          onClose={() => setDetailsDialog(false)}
          maxWidth="lg"
          fullWidth
        >
          {selectedOrder && (
            <>
              <DialogTitle>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6">Order {selectedOrder.orderNumber}</Typography>
                    {selectedOrder.flagged && (
                      <Chip
                        icon={<Flag />}
                        label="Flagged"
                        color="error"
                        size="small"
                      />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      label={selectedOrder.status}
                      color={getStatusColor(selectedOrder.status)}
                      icon={getStatusIcon(selectedOrder.status)}
                    />
                    <Chip
                      label={selectedOrder.paymentStatus}
                      color={getPaymentStatusColor(selectedOrder.paymentStatus)}
                      size="small"
                    />
                  </Box>
                </Box>
              </DialogTitle>
              <DialogContent>
                <Grid container spacing={3}>
                  {/* Customer Information */}
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Customer Information
                      </Typography>
                      <List dense>
                        <ListItem>
                          <ListItemAvatar>
                            <Avatar src={selectedOrder.customer.avatar}>
                              {selectedOrder.customer.name[0]}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={selectedOrder.customer.name}
                            secondary={selectedOrder.customer.email}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            <Phone />
                          </ListItemIcon>
                          <ListItemText primary={selectedOrder.customer.phone} />
                        </ListItem>
                      </List>
                    </Paper>
                  </Grid>

                  {/* Seller Information */}
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Seller Information
                      </Typography>
                      <List dense>
                        <ListItem>
                          <ListItemIcon>
                            <Store />
                          </ListItemIcon>
                          <ListItemText
                            primary={selectedOrder.seller.businessName}
                            secondary={selectedOrder.seller.email}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            <AttachMoney />
                          </ListItemIcon>
                          <ListItemText
                            primary="Seller Payout"
                            secondary={`$${selectedOrder.sellerPayout.toLocaleString()} ${selectedOrder.currency}`}
                          />
                        </ListItem>
                      </List>
                    </Paper>
                  </Grid>

                  {/* Payment Information */}
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Payment Information
                      </Typography>
                      <List dense>
                        <ListItem>
                          <ListItemIcon>
                            {getPaymentMethodIcon(selectedOrder.paymentMethod)}
                          </ListItemIcon>
                          <ListItemText
                            primary="Payment Method"
                            secondary={selectedOrder.paymentMethod.replace('_', ' ')}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            <Schedule />
                          </ListItemIcon>
                          <ListItemText
                            primary="Payment Status"
                            secondary={selectedOrder.paymentStatus}
                          />
                        </ListItem>
                      </List>
                    </Paper>
                  </Grid>

                  {/* Delivery Information */}
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Delivery Information
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <List dense>
                            <ListItem>
                              <ListItemIcon>
                                <LocationOn />
                              </ListItemIcon>
                              <ListItemText
                                primary={`${selectedOrder.deliveryAddress.firstName} ${selectedOrder.deliveryAddress.lastName}`}
                                secondary={
                                  <>
                                    {selectedOrder.deliveryAddress.address}
                                    <br />
                                    {selectedOrder.deliveryAddress.municipality}, {selectedOrder.deliveryAddress.province}
                                    <br />
                                    {selectedOrder.deliveryAddress.country}
                                  </>
                                }
                              />
                            </ListItem>
                          </List>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          {selectedOrder.trackingNumber && (
                            <List dense>
                              <ListItem>
                                <ListItemIcon>
                                  <LocalShipping />
                                </ListItemIcon>
                                <ListItemText
                                  primary="Tracking Number"
                                  secondary={selectedOrder.trackingNumber}
                                />
                              </ListItem>
                              {selectedOrder.estimatedDelivery && (
                                <ListItem>
                                  <ListItemIcon>
                                    <Schedule />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary="Estimated Delivery"
                                    secondary={dayjs(selectedOrder.estimatedDelivery).format('MMMM D, YYYY')}
                                  />
                                </ListItem>
                              )}
                            </List>
                          )}
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>

                  {/* Order Items */}
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Order Items
                      </Typography>
                      <List>
                        {selectedOrder.items.map((item) => (
                          <ListItem key={item.id}>
                            <ListItemAvatar>
                              <Avatar src={item.productImage} variant="rounded" />
                            </ListItemAvatar>
                            <ListItemText
                              primary={item.productName}
                              secondary={item.variantName}
                            />
                            <Typography variant="body2" sx={{ mr: 2 }}>
                              x{item.quantity}
                            </Typography>
                            <Typography variant="body2" fontWeight="bold">
                              ${item.total.toLocaleString()}
                            </Typography>
                          </ListItem>
                        ))}
                      </List>
                      <Divider sx={{ my: 2 }} />
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography>Subtotal</Typography>
                            <Typography>${selectedOrder.subtotal.toLocaleString()}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography>Tax</Typography>
                            <Typography>${selectedOrder.tax.toLocaleString()}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography>Shipping</Typography>
                            <Typography>${selectedOrder.shipping.toLocaleString()}</Typography>
                          </Box>
                          {selectedOrder.discount > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography>Discount</Typography>
                              <Typography color="error">
                                -${selectedOrder.discount.toLocaleString()}
                              </Typography>
                            </Box>
                          )}
                          <Divider sx={{ my: 1 }} />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="h6">Total</Typography>
                            <Typography variant="h6">
                              ${selectedOrder.total.toLocaleString()} {selectedOrder.currency}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Platform Breakdown
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2">Commission (15%)</Typography>
                              <Typography variant="body2">
                                ${selectedOrder.commission.toLocaleString()}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2">Seller Payout</Typography>
                              <Typography variant="body2" fontWeight="bold">
                                ${selectedOrder.sellerPayout.toLocaleString()}
                              </Typography>
                            </Box>
                          </Paper>
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>

                  {/* Order Timeline */}
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Order Timeline
                      </Typography>
                      <Timeline>
                        {selectedOrder.timeline.map((event, index) => (
                          <TimelineItem key={index}>
                            <TimelineOppositeContent color="text.secondary">
                              {dayjs(event.timestamp).format('MMM D, YYYY h:mm A')}
                            </TimelineOppositeContent>
                            <TimelineSeparator>
                              <TimelineDot color={getStatusColor(event.status as Order['status'])}>
                                {getStatusIcon(event.status)}
                              </TimelineDot>
                              {index < selectedOrder.timeline.length - 1 && <TimelineConnector />}
                            </TimelineSeparator>
                            <TimelineContent>
                              <Typography variant="body1">{event.status}</Typography>
                              {event.note && (
                                <Typography variant="body2" color="text.secondary">
                                  {event.note}
                                </Typography>
                              )}
                              {event.user && (
                                <Typography variant="caption" color="text.secondary">
                                  by {event.user}
                                </Typography>
                              )}
                            </TimelineContent>
                          </TimelineItem>
                        ))}
                      </Timeline>
                    </Paper>
                  </Grid>

                  {/* Notes */}
                  {(selectedOrder.notes || selectedOrder.flagReason) && (
                    <Grid item xs={12}>
                      <Paper sx={{ p: 2 }}>
                        <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                          Notes & Alerts
                        </Typography>
                        {selectedOrder.notes && (
                          <Alert severity="info" sx={{ mb: 1 }}>
                            {selectedOrder.notes}
                          </Alert>
                        )}
                        {selectedOrder.flagReason && (
                          <Alert severity="error">
                            <Typography variant="subtitle2">Flagged Order</Typography>
                            {selectedOrder.flagReason}
                          </Alert>
                        )}
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDetailsDialog(false)}>Close</Button>
                <Button
                  variant="outlined"
                  startIcon={<Print />}
                  onClick={() => {
                    // Print logic
                  }}
                >
                  Print Invoice
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    setStatusDialog(true);
                    setNewStatus(selectedOrder.status);
                    setDetailsDialog(false);
                  }}
                >
                  Update Status
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>

        {/* Update Status Dialog */}
        <Dialog open={statusDialog} onClose={() => setStatusDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Update Order Status</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>New Status</InputLabel>
                <Select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  label="New Status"
                >
                  <MenuItem value="CONFIRMED">Confirmed</MenuItem>
                  <MenuItem value="PROCESSING">Processing</MenuItem>
                  <MenuItem value="SHIPPED">Shipped</MenuItem>
                  <MenuItem value="DELIVERED">Delivered</MenuItem>
                  <MenuItem value="CANCELLED">Cancelled</MenuItem>
                  <MenuItem value="REFUNDED">Refunded</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Note (optional)"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Add a note about this status change..."
              />
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Notify customer via email"
              />
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Notify seller via email"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStatusDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateStatus} variant="contained">
              Update Status
            </Button>
          </DialogActions>
        </Dialog>

        {/* Flag Order Dialog */}
        <Dialog open={flagDialog} onClose={() => setFlagDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Flag Order</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Alert severity="warning">
                Flagging an order will mark it for review and notify the appropriate team members.
              </Alert>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Reason for flagging"
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="Describe why this order needs attention..."
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFlagDialog(false)}>Cancel</Button>
            <Button onClick={handleFlagOrder} variant="contained" color="error">
              Flag Order
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
}