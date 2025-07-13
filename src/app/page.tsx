'use client';

import { motion } from 'framer-motion';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Avatar,
  Chip,
  IconButton,
} from '@mui/material';
import {
  TrendingUp,
  People,
  ShoppingCart,
  AttachMoney,
  Store,
  Analytics,
  Notifications,
  Settings,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const staggerChildren = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

// Mock data
const revenueData = [
  { month: 'Ene', revenue: 125000, orders: 450 },
  { month: 'Feb', revenue: 142000, orders: 520 },
  { month: 'Mar', revenue: 138000, orders: 490 },
  { month: 'Abr', revenue: 165000, orders: 580 },
  { month: 'May', revenue: 178000, orders: 620 },
  { month: 'Jun', revenue: 192000, orders: 680 },
];

const categoryData = [
  { name: 'Electrónicos', value: 35, color: '#7C3AED' },
  { name: 'Ropa', value: 25, color: '#F59E0B' },
  { name: 'Hogar', value: 20, color: '#10B981' },
  { name: 'Deportes', value: 12, color: '#EF4444' },
  { name: 'Otros', value: 8, color: '#6B7280' },
];

const StatCard = ({ title, value, change, icon: Icon, color }: any) => (
  <motion.div variants={fadeInUp}>
    <Card sx={{ height: '100%', background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)` }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div" fontWeight="bold">
              {value}
            </Typography>
            <Box display="flex" alignItems="center" mt={1}>
              <TrendingUp sx={{ color: '#10B981', fontSize: 16, mr: 0.5 }} />
              <Typography variant="body2" color="#10B981">
                +{change}%
              </Typography>
            </Box>
          </Box>
          <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>
            <Icon sx={{ color: 'white' }} />
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  </motion.div>
);

export default function Dashboard() {
  return (
    <Box sx={{ flexGrow: 1, bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Header */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 0 }}>
        <Container maxWidth="xl">
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h4" fontWeight="bold" color="primary">
                OrdenDirecta Admin
              </Typography>
              <Typography variant="body1" color="textSecondary">
                Panel de Control Principal
              </Typography>
            </Box>
            <Box display="flex" gap={1}>
              <IconButton>
                <Notifications />
              </IconButton>
              <IconButton>
                <Settings />
              </IconButton>
            </Box>
          </Box>
        </Container>
      </Paper>

      <Container maxWidth="xl">
        <motion.div
          initial="initial"
          animate="animate"
          variants={staggerChildren}
        >
          {/* Stats Overview */}
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Ingresos Totales"
                value="$192.5K"
                change="12.5"
                icon={AttachMoney}
                color="#7C3AED"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Órdenes"
                value="2,847"
                change="8.2"
                icon={ShoppingCart}
                color="#F59E0B"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Usuarios Activos"
                value="8,924"
                change="15.3"
                icon={People}
                color="#10B981"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Vendedores"
                value="342"
                change="6.8"
                icon={Store}
                color="#EF4444"
              />
            </Grid>
          </Grid>

          {/* Charts Section */}
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12} lg={8}>
              <motion.div variants={fadeInUp}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" fontWeight="bold" mb={3}>
                      Ingresos y Órdenes por Mes
                    </Typography>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Bar yAxisId="right" dataKey="orders" fill="#F59E0B" opacity={0.3} />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="revenue"
                          stroke="#7C3AED"
                          strokeWidth={3}
                          dot={{ fill: '#7C3AED', strokeWidth: 2, r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>

            <Grid item xs={12} lg={4}>
              <motion.div variants={fadeInUp}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight="bold" mb={3}>
                      Ventas por Categoría
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <Box mt={2}>
                      {categoryData.map((item, index) => (
                        <Box
                          key={index}
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          mb={1}
                        >
                          <Box display="flex" alignItems="center">
                            <Box
                              width={12}
                              height={12}
                              borderRadius="50%"
                              bgcolor={item.color}
                              mr={1}
                            />
                            <Typography variant="body2">{item.name}</Typography>
                          </Box>
                          <Typography variant="body2" fontWeight="bold">
                            {item.value}%
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          </Grid>

          {/* Recent Activity & Quick Actions */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <motion.div variants={fadeInUp}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" fontWeight="bold" mb={3}>
                      Actividad Reciente
                    </Typography>
                    {[
                      { action: 'Nueva orden', user: 'Juan Pérez', time: 'Hace 5 min', status: 'completed' },
                      { action: 'Vendedor registrado', user: 'TiendaDigital', time: 'Hace 12 min', status: 'pending' },
                      { action: 'Producto aprobado', user: 'ElectroMax', time: 'Hace 18 min', status: 'completed' },
                      { action: 'Disputa creada', user: 'María González', time: 'Hace 25 min', status: 'warning' },
                      { action: 'Pago procesado', user: 'TechStore', time: 'Hace 32 min', status: 'completed' },
                    ].map((item, index) => (
                      <Box
                        key={index}
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        py={1.5}
                        borderBottom="1px solid #F1F5F9"
                      >
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {item.action}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {item.user}
                          </Typography>
                        </Box>
                        <Box textAlign="right">
                          <Chip
                            size="small"
                            label={item.status === 'completed' ? 'Completado' : 
                                   item.status === 'pending' ? 'Pendiente' : 'Atención'}
                            color={item.status === 'completed' ? 'success' : 
                                   item.status === 'pending' ? 'warning' : 'error'}
                          />
                          <Typography variant="caption" display="block" color="textSecondary">
                            {item.time}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>

            <Grid item xs={12} md={6}>
              <motion.div variants={fadeInUp}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" fontWeight="bold" mb={3}>
                      Estado del Sistema
                    </Typography>
                    {[
                      { service: 'API Principal', status: 99.9, color: '#10B981' },
                      { service: 'Base de Datos', status: 98.5, color: '#F59E0B' },
                      { service: 'Pagos', status: 99.7, color: '#10B981' },
                      { service: 'Notificaciones', status: 97.2, color: '#EF4444' },
                      { service: 'Búsqueda', status: 99.1, color: '#10B981' },
                    ].map((item, index) => (
                      <Box key={index} mb={2}>
                        <Box display="flex" justifyContent="space-between" mb={1}>
                          <Typography variant="body2">{item.service}</Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {item.status}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={item.status}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: '#E2E8F0',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: item.color,
                              borderRadius: 3,
                            },
                          }}
                        />
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          </Grid>
        </motion.div>
      </Container>
    </Box>
  );
}