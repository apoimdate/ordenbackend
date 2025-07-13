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
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  Badge,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Search,
  FilterList,
  MoreVert,
  Email,
  Phone,
  LocationOn,
  Person,
  Block,
  CheckCircle,
  Warning,
  ShoppingCart,
  AttachMoney,
  Edit,
  Delete,
  Visibility,
  Schedule,
  Send,
  Download,
  Upload,
  Security,
  AccountBalanceWallet,
  LocalOffer,
  TrendingUp,
  History,
  Assignment,
  Verified,
  Cancel,
  AdminPanelSettings,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';

interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatar?: string;
  role: 'USER' | 'SELLER' | 'ADMIN' | 'SUPER_ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  preferredCurrency: 'USD' | 'EUR';
  language: string;
  totalSpent: number;
  totalOrders: number;
  walletBalance: number;
  loyaltyPoints: number;
  lastActiveAt: string;
  createdAt: string;
  suspendedAt?: string;
  suspendedReason?: string;
  addresses: {
    id: string;
    isDefault: boolean;
    province: string;
    municipality: string;
  }[];
  metrics: {
    averageOrderValue: number;
    orderFrequency: string;
    favoriteCategories: string[];
    lastOrderDate?: string;
  };
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
      id={`user-tabpanel-${index}`}
      aria-labelledby={`user-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [tabValue, setTabValue] = useState(0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [statusDialog, setStatusDialog] = useState(false);
  const [walletDialog, setWalletDialog] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [walletAction, setWalletAction] = useState<'add' | 'deduct'>('add');
  const [walletAmount, setWalletAmount] = useState('');
  const [walletReason, setWalletReason] = useState('');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    suspended: 0,
    verified: 0,
    totalSpent: 0,
    totalOrders: 0,
    newThisMonth: 0,
    activeToday: 0,
  });

  useEffect(() => {
    fetchUsers();
  }, [page, rowsPerPage, searchQuery, roleFilter, statusFilter, verifiedFilter, tabValue]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Mock data
      const mockUsers: User[] = Array.from({ length: 500 }, (_, i) => ({
        id: `usr_${i + 1}`,
        email: `user${i + 1}@example.com`,
        username: `user${i + 1}`,
        firstName: `First${i + 1}`,
        lastName: `Last${i + 1}`,
        phone: `+1555000${String(i).padStart(4, '0')}`,
        avatar: Math.random() > 0.5 ? `/images/avatars/avatar-${(i % 10) + 1}.jpg` : undefined,
        role: ['USER', 'SELLER', 'ADMIN'][Math.floor(Math.random() * 3)] as User['role'],
        status: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'][
          Math.floor(Math.random() * 4)
        ] as User['status'],
        emailVerified: Math.random() > 0.2,
        phoneVerified: Math.random() > 0.3,
        twoFactorEnabled: Math.random() > 0.7,
        preferredCurrency: Math.random() > 0.5 ? 'USD' : 'EUR',
        language: ['en', 'es', 'fr'][Math.floor(Math.random() * 3)],
        totalSpent: Math.floor(Math.random() * 100000),
        totalOrders: Math.floor(Math.random() * 100),
        walletBalance: Math.floor(Math.random() * 10000),
        loyaltyPoints: Math.floor(Math.random() * 5000),
        lastActiveAt: dayjs().subtract(Math.floor(Math.random() * 30), 'day').toISOString(),
        createdAt: dayjs().subtract(Math.floor(Math.random() * 365), 'day').toISOString(),
        suspendedAt: Math.random() > 0.95 ? dayjs().subtract(Math.floor(Math.random() * 30), 'day').toISOString() : undefined,
        suspendedReason: Math.random() > 0.95 ? 'Terms violation' : undefined,
        addresses: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, j) => ({
          id: `addr_${i}_${j}`,
          isDefault: j === 0,
          province: ['Florida', 'California', 'New York', 'Texas'][Math.floor(Math.random() * 4)],
          municipality: ['Miami', 'Los Angeles', 'New York', 'Houston'][Math.floor(Math.random() * 4)],
        })),
        metrics: {
          averageOrderValue: Math.floor(Math.random() * 1000) + 100,
          orderFrequency: ['Weekly', 'Monthly', 'Quarterly', 'Rarely'][Math.floor(Math.random() * 4)],
          favoriteCategories: ['Electronics', 'Fashion', 'Home'].slice(0, Math.floor(Math.random() * 3) + 1),
          lastOrderDate: Math.random() > 0.3 ? dayjs().subtract(Math.floor(Math.random() * 60), 'day').toISOString() : undefined,
        },
      }));

      // Apply filters
      let filtered = mockUsers;
      if (searchQuery) {
        filtered = filtered.filter(
          (u) =>
            u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      if (roleFilter !== 'all') {
        filtered = filtered.filter((u) => u.role === roleFilter);
      }
      if (statusFilter !== 'all') {
        filtered = filtered.filter((u) => u.status === statusFilter);
      }
      if (verifiedFilter === 'verified') {
        filtered = filtered.filter((u) => u.emailVerified);
      } else if (verifiedFilter === 'unverified') {
        filtered = filtered.filter((u) => !u.emailVerified);
      }

      // Tab filters
      if (tabValue === 1) {
        filtered = filtered.filter((u) => u.status === 'ACTIVE');
      } else if (tabValue === 2) {
        filtered = filtered.filter((u) => u.status === 'SUSPENDED');
      } else if (tabValue === 3) {
        filtered = filtered.filter((u) => u.role === 'SELLER');
      }

      // Calculate stats
      const now = dayjs();
      const startOfMonth = now.startOf('month');
      const statsData = {
        total: mockUsers.length,
        active: mockUsers.filter((u) => u.status === 'ACTIVE').length,
        suspended: mockUsers.filter((u) => u.status === 'SUSPENDED').length,
        verified: mockUsers.filter((u) => u.emailVerified).length,
        totalSpent: mockUsers.reduce((sum, u) => sum + u.totalSpent, 0),
        totalOrders: mockUsers.reduce((sum, u) => sum + u.totalOrders, 0),
        newThisMonth: mockUsers.filter((u) => dayjs(u.createdAt).isAfter(startOfMonth)).length,
        activeToday: mockUsers.filter((u) => dayjs(u.lastActiveAt).isSame(now, 'day')).length,
      };
      setStats(statsData);

      setTotalUsers(filtered.length);
      setUsers(filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage));
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setSnackbar({ open: true, message: 'Failed to load users', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedUser || !newStatus) return;
    try {
      // API call here
      setSnackbar({
        open: true,
        message: `User status updated to ${newStatus}`,
        severity: 'success',
      });
      setStatusDialog(false);
      fetchUsers();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update status', severity: 'error' });
    }
  };

  const handleWalletAction = async () => {
    if (!selectedUser || !walletAmount) return;
    try {
      // API call here
      setSnackbar({
        open: true,
        message: `Wallet ${walletAction === 'add' ? 'credited' : 'debited'} successfully`,
        severity: 'success',
      });
      setWalletDialog(false);
      setWalletAmount('');
      setWalletReason('');
      fetchUsers();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update wallet', severity: 'error' });
    }
  };

  const getStatusColor = (status: User['status']) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'INACTIVE':
        return 'default';
      case 'SUSPENDED':
        return 'error';
      case 'PENDING_VERIFICATION':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getRoleColor = (role: User['role']) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'error';
      case 'ADMIN':
        return 'secondary';
      case 'SELLER':
        return 'primary';
      case 'USER':
        return 'default';
      default:
        return 'default';
    }
  };

  const getRoleIcon = (role: User['role']) => {
    switch (role) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return <AdminPanelSettings />;
      case 'SELLER':
        return <BusinessCenter />;
      case 'USER':
        return <Person />;
      default:
        return <Person />;
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
            User Management
          </Typography>

          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Users
                  </Typography>
                  <Typography variant="h4">{stats.total}</Typography>
                  <Typography variant="body2" color="success.main">
                    +{stats.newThisMonth} this month
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Active Users
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {stats.active}
                  </Typography>
                  <Typography variant="body2">
                    {stats.activeToday} active today
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Verified
                  </Typography>
                  <Typography variant="h4" color="primary.main">
                    {stats.verified}
                  </Typography>
                  <Typography variant="body2">
                    {((stats.verified / stats.total) * 100).toFixed(1)}% verified
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Revenue
                  </Typography>
                  <Typography variant="h5">
                    ${stats.totalSpent.toLocaleString()}
                  </Typography>
                  <Typography variant="body2">
                    {stats.totalOrders} orders
                  </Typography>
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
              <Tab label="All Users" />
              <Tab label="Active" />
              <Tab label="Suspended" />
              <Tab label="Sellers" />
            </Tabs>
            <Box sx={{ p: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Search by name, email, or username..."
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
                    <InputLabel>Role</InputLabel>
                    <Select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      label="Role"
                    >
                      <MenuItem value="all">All Roles</MenuItem>
                      <MenuItem value="USER">User</MenuItem>
                      <MenuItem value="SELLER">Seller</MenuItem>
                      <MenuItem value="ADMIN">Admin</MenuItem>
                    </Select>
                  </FormControl>
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
                      <MenuItem value="ACTIVE">Active</MenuItem>
                      <MenuItem value="INACTIVE">Inactive</MenuItem>
                      <MenuItem value="SUSPENDED">Suspended</MenuItem>
                      <MenuItem value="PENDING_VERIFICATION">Pending</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>Verification</InputLabel>
                    <Select
                      value={verifiedFilter}
                      onChange={(e) => setVerifiedFilter(e.target.value)}
                      label="Verification"
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="verified">Verified</MenuItem>
                      <MenuItem value="unverified">Unverified</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button
                    variant="outlined"
                    startIcon={<Download />}
                    fullWidth
                  >
                    Export
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Paper>

          {/* Users Table */}
          {loading ? (
            <LinearProgress />
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell align="center">Role</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Verification</TableCell>
                    <TableCell align="right">Spent</TableCell>
                    <TableCell align="right">Wallet</TableCell>
                    <TableCell>Last Active</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow
                      key={user.id}
                      hover
                      onClick={() => {
                        setSelectedUser(user);
                        setDetailsDialog(true);
                      }}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Badge
                            overlap="circular"
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            badgeContent={
                              user.twoFactorEnabled && (
                                <Security sx={{ width: 12, height: 12 }} />
                              )
                            }
                          >
                            <Avatar src={user.avatar} sx={{ width: 40, height: 40 }}>
                              {user.firstName[0]}{user.lastName[0]}
                            </Avatar>
                          </Badge>
                          <Box>
                            <Typography variant="body1">
                              {user.firstName} {user.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              @{user.username}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{user.email}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.phone}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={getRoleIcon(user.role)}
                          label={user.role}
                          size="small"
                          color={getRoleColor(user.role)}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={user.status}
                          size="small"
                          color={getStatusColor(user.status)}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                          <Tooltip title="Email">
                            {user.emailVerified ? (
                              <CheckCircle color="success" fontSize="small" />
                            ) : (
                              <Cancel color="error" fontSize="small" />
                            )}
                          </Tooltip>
                          <Tooltip title="Phone">
                            {user.phoneVerified ? (
                              <CheckCircle color="success" fontSize="small" />
                            ) : (
                              <Cancel color="error" fontSize="small" />
                            )}
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          ${user.totalSpent.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.totalOrders} orders
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          ${user.walletBalance.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.loyaltyPoints} pts
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {dayjs(user.lastActiveAt).format('MMM D, YYYY')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {dayjs(user.lastActiveAt).fromNow()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAnchorEl(e.currentTarget);
                            setSelectedUser(user);
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
                count={totalUsers}
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
              setNewStatus(selectedUser?.status || '');
              setAnchorEl(null);
            }}
          >
            <Edit sx={{ mr: 1 }} /> Update Status
          </MenuItem>
          <MenuItem
            onClick={() => {
              setWalletDialog(true);
              setAnchorEl(null);
            }}
          >
            <AccountBalanceWallet sx={{ mr: 1 }} /> Manage Wallet
          </MenuItem>
          <MenuItem
            onClick={() => {
              // Send message logic
              setAnchorEl(null);
            }}
          >
            <Send sx={{ mr: 1 }} /> Send Message
          </MenuItem>
          <MenuItem
            onClick={() => {
              // View orders logic
              setAnchorEl(null);
            }}
          >
            <ShoppingCart sx={{ mr: 1 }} /> View Orders
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              // Suspend logic
              setAnchorEl(null);
            }}
            sx={{ color: 'error.main' }}
          >
            <Block sx={{ mr: 1 }} /> Suspend User
          </MenuItem>
        </Menu>

        {/* User Details Dialog */}
        <Dialog
          open={detailsDialog}
          onClose={() => setDetailsDialog(false)}
          maxWidth="lg"
          fullWidth
        >
          {selectedUser && (
            <>
              <DialogTitle>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar src={selectedUser.avatar} sx={{ width: 56, height: 56 }}>
                      {selectedUser.firstName[0]}{selectedUser.lastName[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="h6">
                        {selectedUser.firstName} {selectedUser.lastName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        @{selectedUser.username} • {selectedUser.email}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      label={selectedUser.status}
                      color={getStatusColor(selectedUser.status)}
                    />
                    <Chip
                      icon={getRoleIcon(selectedUser.role)}
                      label={selectedUser.role}
                      color={getRoleColor(selectedUser.role)}
                    />
                  </Box>
                </Box>
              </DialogTitle>
              <DialogContent>
                <Grid container spacing={3}>
                  {/* Account Information */}
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Account Information
                      </Typography>
                      <List dense>
                        <ListItem>
                          <ListItemIcon>
                            <Email />
                          </ListItemIcon>
                          <ListItemText
                            primary="Email"
                            secondary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {selectedUser.email}
                                {selectedUser.emailVerified && (
                                  <Verified color="primary" fontSize="small" />
                                )}
                              </Box>
                            }
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            <Phone />
                          </ListItemIcon>
                          <ListItemText
                            primary="Phone"
                            secondary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {selectedUser.phone}
                                {selectedUser.phoneVerified && (
                                  <Verified color="primary" fontSize="small" />
                                )}
                              </Box>
                            }
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            <Security />
                          </ListItemIcon>
                          <ListItemText
                            primary="Two-Factor Authentication"
                            secondary={selectedUser.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            <AttachMoney />
                          </ListItemIcon>
                          <ListItemText
                            primary="Preferred Currency"
                            secondary={selectedUser.preferredCurrency}
                          />
                        </ListItem>
                      </List>
                    </Paper>
                  </Grid>

                  {/* Purchase Metrics */}
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Purchase Metrics
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Total Spent
                          </Typography>
                          <Typography variant="h6">
                            ${selectedUser.totalSpent.toLocaleString()}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Total Orders
                          </Typography>
                          <Typography variant="h6">
                            {selectedUser.totalOrders}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Average Order Value
                          </Typography>
                          <Typography variant="h6">
                            ${selectedUser.metrics.averageOrderValue}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Order Frequency
                          </Typography>
                          <Typography variant="h6">
                            {selectedUser.metrics.orderFrequency}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>

                  {/* Wallet & Loyalty */}
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Wallet & Loyalty
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AccountBalanceWallet color="primary" />
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Wallet Balance
                              </Typography>
                              <Typography variant="h6">
                                ${selectedUser.walletBalance.toLocaleString()}
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LocalOffer color="warning" />
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Loyalty Points
                              </Typography>
                              <Typography variant="h6">
                                {selectedUser.loyaltyPoints.toLocaleString()}
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>

                  {/* Addresses */}
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Addresses ({selectedUser.addresses.length})
                      </Typography>
                      <List dense>
                        {selectedUser.addresses.map((address) => (
                          <ListItem key={address.id}>
                            <ListItemIcon>
                              <LocationOn />
                            </ListItemIcon>
                            <ListItemText
                              primary={`${address.municipality}, ${address.province}`}
                              secondary={address.isDefault ? 'Default address' : undefined}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Paper>
                  </Grid>

                  {/* Activity */}
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Activity & Preferences
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary">
                            Member Since
                          </Typography>
                          <Typography>
                            {dayjs(selectedUser.createdAt).format('MMMM D, YYYY')}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary">
                            Last Active
                          </Typography>
                          <Typography>
                            {dayjs(selectedUser.lastActiveAt).format('MMMM D, YYYY h:mm A')}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary">
                            Last Order
                          </Typography>
                          <Typography>
                            {selectedUser.metrics.lastOrderDate
                              ? dayjs(selectedUser.metrics.lastOrderDate).format('MMMM D, YYYY')
                              : 'No orders yet'}
                          </Typography>
                        </Grid>
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">
                            Favorite Categories
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            {selectedUser.metrics.favoriteCategories.map((category) => (
                              <Chip key={category} label={category} size="small" />
                            ))}
                          </Box>
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>

                  {/* Suspension Info */}
                  {selectedUser.suspendedAt && (
                    <Grid item xs={12}>
                      <Alert severity="error">
                        <Typography variant="subtitle2" gutterBottom>
                          Account Suspended
                        </Typography>
                        <Typography variant="body2">
                          Date: {dayjs(selectedUser.suspendedAt).format('MMMM D, YYYY h:mm A')}
                        </Typography>
                        {selectedUser.suspendedReason && (
                          <Typography variant="body2">
                            Reason: {selectedUser.suspendedReason}
                          </Typography>
                        )}
                      </Alert>
                    </Grid>
                  )}
                </Grid>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDetailsDialog(false)}>Close</Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    // View full profile
                  }}
                >
                  View Full Profile
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    // View orders
                  }}
                >
                  View Orders
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>

        {/* Update Status Dialog */}
        <Dialog open={statusDialog} onClose={() => setStatusDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Update User Status</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>New Status</InputLabel>
                <Select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  label="New Status"
                >
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="INACTIVE">Inactive</MenuItem>
                  <MenuItem value="SUSPENDED">Suspended</MenuItem>
                </Select>
              </FormControl>
              {newStatus === 'SUSPENDED' && (
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Reason"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Provide a reason for suspension..."
                />
              )}
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Notify user via email"
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

        {/* Wallet Management Dialog */}
        <Dialog open={walletDialog} onClose={() => setWalletDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Manage Wallet Balance</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Alert severity="info">
                Current Balance: ${selectedUser?.walletBalance.toLocaleString()}
              </Alert>
              <FormControl fullWidth>
                <InputLabel>Action</InputLabel>
                <Select
                  value={walletAction}
                  onChange={(e) => setWalletAction(e.target.value as 'add' | 'deduct')}
                  label="Action"
                >
                  <MenuItem value="add">Add Funds</MenuItem>
                  <MenuItem value="deduct">Deduct Funds</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Amount"
                type="number"
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Reason"
                value={walletReason}
                onChange={(e) => setWalletReason(e.target.value)}
                placeholder="Provide a reason for this transaction..."
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setWalletDialog(false)}>Cancel</Button>
            <Button onClick={handleWalletAction} variant="contained" color={walletAction === 'add' ? 'primary' : 'error'}>
              {walletAction === 'add' ? 'Add Funds' : 'Deduct Funds'}
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