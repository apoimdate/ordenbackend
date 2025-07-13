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
  Tooltip,
  Switch,
  FormControlLabel,
  Divider,
  Tab,
  Tabs,
  Slider,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  Search,
  FilterList,
  MoreVert,
  Email,
  Phone,
  LocationOn,
  Store,
  Verified,
  Block,
  CheckCircle,
  Warning,
  TrendingUp,
  AttachMoney,
  Star,
  Edit,
  Delete,
  Visibility,
  Assignment,
  Schedule,
  PendingActions,
  Cancel,
  BusinessCenter,
  Assessment,
  AccountBalance,
  Download,
  Upload,
  Send,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';

interface Seller {
  id: string;
  userId: string;
  businessName: string;
  slug: string;
  description: string;
  email: string;
  phone: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'UNDER_REVIEW' | 'ON_VACATION';
  verificationStatus: 'pending' | 'verified' | 'rejected';
  commission: number;
  membershipTier: 'BASIC' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  rating: number;
  reviewCount: number;
  joinedAt: string;
  approvedAt?: string;
  suspendedAt?: string;
  suspendedReason?: string;
  documents: {
    businessLicense: boolean;
    taxId: boolean;
    bankAccount: boolean;
    identityProof: boolean;
  };
  bankAccount?: {
    holder: string;
    number: string;
    bank: string;
  };
  metrics: {
    conversionRate: number;
    responseTime: string;
    fulfillmentRate: number;
    returnRate: number;
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
      id={`seller-tabpanel-${index}`}
      aria-labelledby={`seller-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function SellersPage() {
  const router = useRouter();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalSellers, setTotalSellers] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [tabValue, setTabValue] = useState(0);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [statusDialog, setStatusDialog] = useState(false);
  const [commissionDialog, setCommissionDialog] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [newCommission, setNewCommission] = useState(15);
  const [commissionReason, setCommissionReason] = useState('');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    suspended: 0,
    totalRevenue: 0,
    totalCommission: 0,
  });

  useEffect(() => {
    fetchSellers();
  }, [page, rowsPerPage, searchQuery, statusFilter, verificationFilter, tabValue]);

  const fetchSellers = async () => {
    setLoading(true);
    try {
      // Mock data
      const mockSellers: Seller[] = Array.from({ length: 100 }, (_, i) => ({
        id: `sel_${i + 1}`,
        userId: `usr_${i + 1}`,
        businessName: `Business ${i + 1}`,
        slug: `business-${i + 1}`,
        description: 'Quality products and excellent service',
        email: `seller${i + 1}@example.com`,
        phone: `+1555000${String(i).padStart(4, '0')}`,
        status: ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'UNDER_REVIEW', 'ON_VACATION'][
          Math.floor(Math.random() * 6)
        ] as Seller['status'],
        verificationStatus: ['pending', 'verified', 'rejected'][Math.floor(Math.random() * 3)] as Seller['verificationStatus'],
        commission: 0.15 - (Math.floor(Math.random() * 5) * 0.01), // 15% to 11%
        membershipTier: ['BASIC', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'][Math.floor(Math.random() * 5)] as Seller['membershipTier'],
        totalSales: Math.floor(Math.random() * 1000000),
        totalOrders: Math.floor(Math.random() * 1000),
        totalProducts: Math.floor(Math.random() * 100),
        rating: Math.random() * 2 + 3,
        reviewCount: Math.floor(Math.random() * 500),
        joinedAt: dayjs().subtract(Math.floor(Math.random() * 365), 'day').toISOString(),
        approvedAt: Math.random() > 0.3 ? dayjs().subtract(Math.floor(Math.random() * 300), 'day').toISOString() : undefined,
        suspendedAt: Math.random() > 0.9 ? dayjs().subtract(Math.floor(Math.random() * 30), 'day').toISOString() : undefined,
        suspendedReason: Math.random() > 0.9 ? 'Policy violation' : undefined,
        documents: {
          businessLicense: Math.random() > 0.2,
          taxId: Math.random() > 0.2,
          bankAccount: Math.random() > 0.2,
          identityProof: Math.random() > 0.2,
        },
        bankAccount: Math.random() > 0.5 ? {
          holder: `Business ${i + 1} LLC`,
          number: `****${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
          bank: ['Bank of America', 'Chase', 'Wells Fargo', 'Citibank'][Math.floor(Math.random() * 4)],
        } : undefined,
        metrics: {
          conversionRate: Math.random() * 5 + 1,
          responseTime: `${Math.floor(Math.random() * 24) + 1} hours`,
          fulfillmentRate: Math.random() * 10 + 90,
          returnRate: Math.random() * 5,
        },
      }));

      // Apply filters
      let filtered = mockSellers;
      if (searchQuery) {
        filtered = filtered.filter(
          (s) =>
            s.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.slug.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      if (statusFilter !== 'all') {
        filtered = filtered.filter((s) => s.status === statusFilter);
      }
      if (verificationFilter !== 'all') {
        filtered = filtered.filter((s) => s.verificationStatus === verificationFilter);
      }

      // Tab filters
      if (tabValue === 1) {
        filtered = filtered.filter((s) => s.status === 'PENDING');
      } else if (tabValue === 2) {
        filtered = filtered.filter((s) => s.status === 'ACTIVE');
      } else if (tabValue === 3) {
        filtered = filtered.filter((s) => s.status === 'SUSPENDED');
      }

      // Calculate stats
      const statsData = {
        total: mockSellers.length,
        active: mockSellers.filter((s) => s.status === 'ACTIVE').length,
        pending: mockSellers.filter((s) => s.status === 'PENDING').length,
        suspended: mockSellers.filter((s) => s.status === 'SUSPENDED').length,
        totalRevenue: mockSellers.reduce((sum, s) => sum + s.totalSales, 0),
        totalCommission: mockSellers.reduce((sum, s) => sum + s.totalSales * s.commission, 0),
      };
      setStats(statsData);

      setTotalSellers(filtered.length);
      setSellers(filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage));
    } catch (error) {
      console.error('Failed to fetch sellers:', error);
      setSnackbar({ open: true, message: 'Failed to load sellers', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedSeller || !newStatus) return;
    try {
      // API call here
      setSnackbar({
        open: true,
        message: `Seller status updated to ${newStatus}`,
        severity: 'success',
      });
      setStatusDialog(false);
      fetchSellers();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update status', severity: 'error' });
    }
  };

  const handleUpdateCommission = async () => {
    if (!selectedSeller) return;
    try {
      // API call here
      setSnackbar({
        open: true,
        message: `Commission rate updated to ${newCommission}%`,
        severity: 'success',
      });
      setCommissionDialog(false);
      fetchSellers();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update commission', severity: 'error' });
    }
  };

  const getStatusColor = (status: Seller['status']) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'SUSPENDED':
        return 'error';
      case 'REJECTED':
        return 'error';
      case 'UNDER_REVIEW':
        return 'info';
      case 'ON_VACATION':
        return 'default';
      default:
        return 'default';
    }
  };

  const getVerificationIcon = (status: Seller['verificationStatus']) => {
    switch (status) {
      case 'verified':
        return <Verified color="primary" />;
      case 'pending':
        return <PendingActions color="warning" />;
      case 'rejected':
        return <Cancel color="error" />;
      default:
        return null;
    }
  };

  const getMembershipColor = (tier: string) => {
    switch (tier) {
      case 'PLATINUM':
        return '#b8d4e3';
      case 'GOLD':
        return '#FFD700';
      case 'SILVER':
        return '#C0C0C0';
      case 'BRONZE':
        return '#CD7F32';
      default:
        return '#808080';
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
            Seller Management
          </Typography>

          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={2}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Sellers
                  </Typography>
                  <Typography variant="h4">{stats.total}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Active
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {stats.active}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
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
            <Grid item xs={12} sm={6} md={2}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Suspended
                  </Typography>
                  <Typography variant="h4" color="error.main">
                    {stats.suspended}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Revenue
                  </Typography>
                  <Typography variant="h5">
                    ${stats.totalRevenue.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Commission
                  </Typography>
                  <Typography variant="h5">
                    ${stats.totalCommission.toLocaleString()}
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
              <Tab label="All Sellers" />
              <Tab label="Pending Approval" />
              <Tab label="Active" />
              <Tab label="Suspended" />
            </Tabs>
            <Box sx={{ p: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Search by name, email, or slug..."
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
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      label="Status"
                    >
                      <MenuItem value="all">All Status</MenuItem>
                      <MenuItem value="PENDING">Pending</MenuItem>
                      <MenuItem value="ACTIVE">Active</MenuItem>
                      <MenuItem value="SUSPENDED">Suspended</MenuItem>
                      <MenuItem value="REJECTED">Rejected</MenuItem>
                      <MenuItem value="UNDER_REVIEW">Under Review</MenuItem>
                      <MenuItem value="ON_VACATION">On Vacation</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Verification</InputLabel>
                    <Select
                      value={verificationFilter}
                      onChange={(e) => setVerificationFilter(e.target.value)}
                      label="Verification"
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="verified">Verified</MenuItem>
                      <MenuItem value="rejected">Rejected</MenuItem>
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

          {/* Sellers Table */}
          {loading ? (
            <LinearProgress />
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Seller</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Verification</TableCell>
                    <TableCell align="center">Membership</TableCell>
                    <TableCell align="right">Revenue</TableCell>
                    <TableCell align="center">Commission</TableCell>
                    <TableCell align="center">Rating</TableCell>
                    <TableCell>Joined</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sellers.map((seller) => (
                    <TableRow
                      key={seller.id}
                      hover
                      onClick={() => {
                        setSelectedSeller(seller);
                        setDetailsDialog(true);
                      }}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {seller.businessName[0]}
                          </Avatar>
                          <Box>
                            <Typography variant="body1">{seller.businessName}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              @{seller.slug}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{seller.email}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {seller.phone}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={seller.status}
                          size="small"
                          color={getStatusColor(seller.status)}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                          {getVerificationIcon(seller.verificationStatus)}
                          <Typography variant="caption">
                            {seller.verificationStatus}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={seller.membershipTier}
                          size="small"
                          sx={{
                            bgcolor: getMembershipColor(seller.membershipTier),
                            color: 'white',
                            fontWeight: 'bold',
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          ${seller.totalSales.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {seller.totalOrders} orders
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">
                          {(seller.commission * 100).toFixed(0)}%
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                          <Star color="warning" fontSize="small" />
                          <Typography variant="body2">{seller.rating.toFixed(1)}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            ({seller.reviewCount})
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {dayjs(seller.joinedAt).format('MMM D, YYYY')}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAnchorEl(e.currentTarget);
                            setSelectedSeller(seller);
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
                rowsPerPageOptions={[10, 25, 50]}
                component="div"
                count={totalSellers}
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
              setNewStatus(selectedSeller?.status || '');
              setAnchorEl(null);
            }}
          >
            <Edit sx={{ mr: 1 }} /> Update Status
          </MenuItem>
          <MenuItem
            onClick={() => {
              setCommissionDialog(true);
              setNewCommission((selectedSeller?.commission || 0.15) * 100);
              setAnchorEl(null);
            }}
          >
            <AttachMoney sx={{ mr: 1 }} /> Update Commission
          </MenuItem>
          <MenuItem
            onClick={() => {
              // Send message logic
              setAnchorEl(null);
            }}
          >
            <Send sx={{ mr: 1 }} /> Send Message
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              // Suspend logic
              setAnchorEl(null);
            }}
            sx={{ color: 'error.main' }}
          >
            <Block sx={{ mr: 1 }} /> Suspend Seller
          </MenuItem>
        </Menu>

        {/* Seller Details Dialog */}
        <Dialog
          open={detailsDialog}
          onClose={() => setDetailsDialog(false)}
          maxWidth="lg"
          fullWidth
        >
          {selectedSeller && (
            <>
              <DialogTitle>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                      {selectedSeller.businessName[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="h6">{selectedSeller.businessName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        @{selectedSeller.slug}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      label={selectedSeller.status}
                      color={getStatusColor(selectedSeller.status)}
                    />
                    <Chip
                      label={selectedSeller.membershipTier}
                      sx={{
                        bgcolor: getMembershipColor(selectedSeller.membershipTier),
                        color: 'white',
                        fontWeight: 'bold',
                      }}
                    />
                  </Box>
                </Box>
              </DialogTitle>
              <DialogContent>
                <Grid container spacing={3}>
                  {/* Contact Information */}
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Contact Information
                      </Typography>
                      <List dense>
                        <ListItem>
                          <ListItemIcon>
                            <Email />
                          </ListItemIcon>
                          <ListItemText
                            primary="Email"
                            secondary={selectedSeller.email}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            <Phone />
                          </ListItemIcon>
                          <ListItemText
                            primary="Phone"
                            secondary={selectedSeller.phone}
                          />
                        </ListItem>
                      </List>
                    </Paper>
                  </Grid>

                  {/* Business Metrics */}
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Business Metrics
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Total Sales
                          </Typography>
                          <Typography variant="h6">
                            ${selectedSeller.totalSales.toLocaleString()}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Total Orders
                          </Typography>
                          <Typography variant="h6">
                            {selectedSeller.totalOrders}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Total Products
                          </Typography>
                          <Typography variant="h6">
                            {selectedSeller.totalProducts}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Commission Rate
                          </Typography>
                          <Typography variant="h6">
                            {(selectedSeller.commission * 100).toFixed(0)}%
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>

                  {/* Performance Metrics */}
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Performance Metrics
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Conversion Rate
                          </Typography>
                          <Typography variant="h6">
                            {selectedSeller.metrics.conversionRate.toFixed(1)}%
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Response Time
                          </Typography>
                          <Typography variant="h6">
                            {selectedSeller.metrics.responseTime}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Fulfillment Rate
                          </Typography>
                          <Typography variant="h6">
                            {selectedSeller.metrics.fulfillmentRate.toFixed(1)}%
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Return Rate
                          </Typography>
                          <Typography variant="h6">
                            {selectedSeller.metrics.returnRate.toFixed(1)}%
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>

                  {/* Documents */}
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Verification Documents
                      </Typography>
                      <List dense>
                        <ListItem>
                          <ListItemIcon>
                            {selectedSeller.documents.businessLicense ? (
                              <CheckCircle color="success" />
                            ) : (
                              <Cancel color="error" />
                            )}
                          </ListItemIcon>
                          <ListItemText primary="Business License" />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            {selectedSeller.documents.taxId ? (
                              <CheckCircle color="success" />
                            ) : (
                              <Cancel color="error" />
                            )}
                          </ListItemIcon>
                          <ListItemText primary="Tax ID" />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            {selectedSeller.documents.bankAccount ? (
                              <CheckCircle color="success" />
                            ) : (
                              <Cancel color="error" />
                            )}
                          </ListItemIcon>
                          <ListItemText primary="Bank Account" />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            {selectedSeller.documents.identityProof ? (
                              <CheckCircle color="success" />
                            ) : (
                              <Cancel color="error" />
                            )}
                          </ListItemIcon>
                          <ListItemText primary="Identity Proof" />
                        </ListItem>
                      </List>
                    </Paper>
                  </Grid>

                  {/* Bank Account */}
                  {selectedSeller.bankAccount && (
                    <Grid item xs={12}>
                      <Paper sx={{ p: 2 }}>
                        <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                          Bank Account Information
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <Typography variant="body2" color="text.secondary">
                              Account Holder
                            </Typography>
                            <Typography>{selectedSeller.bankAccount.holder}</Typography>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <Typography variant="body2" color="text.secondary">
                              Account Number
                            </Typography>
                            <Typography>{selectedSeller.bankAccount.number}</Typography>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <Typography variant="body2" color="text.secondary">
                              Bank Name
                            </Typography>
                            <Typography>{selectedSeller.bankAccount.bank}</Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>
                  )}

                  {/* Timeline */}
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Timeline
                      </Typography>
                      <List dense>
                        <ListItem>
                          <ListItemIcon>
                            <Schedule />
                          </ListItemIcon>
                          <ListItemText
                            primary="Joined"
                            secondary={dayjs(selectedSeller.joinedAt).format('MMMM D, YYYY h:mm A')}
                          />
                        </ListItem>
                        {selectedSeller.approvedAt && (
                          <ListItem>
                            <ListItemIcon>
                              <CheckCircle color="success" />
                            </ListItemIcon>
                            <ListItemText
                              primary="Approved"
                              secondary={dayjs(selectedSeller.approvedAt).format('MMMM D, YYYY h:mm A')}
                            />
                          </ListItem>
                        )}
                        {selectedSeller.suspendedAt && (
                          <ListItem>
                            <ListItemIcon>
                              <Block color="error" />
                            </ListItemIcon>
                            <ListItemText
                              primary="Suspended"
                              secondary={
                                <>
                                  {dayjs(selectedSeller.suspendedAt).format('MMMM D, YYYY h:mm A')}
                                  {selectedSeller.suspendedReason && (
                                    <Typography variant="caption" display="block">
                                      Reason: {selectedSeller.suspendedReason}
                                    </Typography>
                                  )}
                                </>
                              }
                            />
                          </ListItem>
                        )}
                      </List>
                    </Paper>
                  </Grid>
                </Grid>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDetailsDialog(false)}>Close</Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setStatusDialog(true);
                    setNewStatus(selectedSeller.status);
                    setDetailsDialog(false);
                  }}
                >
                  Update Status
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    // View full profile
                  }}
                >
                  View Full Profile
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>

        {/* Update Status Dialog */}
        <Dialog open={statusDialog} onClose={() => setStatusDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Update Seller Status</DialogTitle>
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
                  <MenuItem value="SUSPENDED">Suspended</MenuItem>
                  <MenuItem value="REJECTED">Rejected</MenuItem>
                  <MenuItem value="UNDER_REVIEW">Under Review</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Reason"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Provide a reason for this status change..."
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

        {/* Update Commission Dialog */}
        <Dialog open={commissionDialog} onClose={() => setCommissionDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Update Commission Rate</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Default platform commission is 15%. Lower rates can be offered to high-volume sellers or as part of membership benefits.
              </Typography>
              <Box sx={{ px: 2 }}>
                <Typography gutterBottom>Commission Rate: {newCommission}%</Typography>
                <Slider
                  value={newCommission}
                  onChange={(e, value) => setNewCommission(value as number)}
                  min={10}
                  max={20}
                  step={1}
                  marks={[
                    { value: 10, label: '10%' },
                    { value: 15, label: '15%' },
                    { value: 20, label: '20%' },
                  ]}
                  valueLabelDisplay="auto"
                />
              </Box>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Reason"
                value={commissionReason}
                onChange={(e) => setCommissionReason(e.target.value)}
                placeholder="Provide a reason for this commission change..."
              />
              <TextField
                fullWidth
                label="Effective From"
                type="date"
                InputLabelProps={{ shrink: true }}
                defaultValue={dayjs().format('YYYY-MM-DD')}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCommissionDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateCommission} variant="contained">
              Update Commission
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