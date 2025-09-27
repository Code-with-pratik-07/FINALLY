const express = require('express');
const cors = require('cors');
const config = require('./config');
const { initDB } = require('./db');

// Import routes
const authRoutes = require('./routes/auth');
const importRoutes = require('./routes/import');
const timetableRoutes = require('./routes/timetable');
const attendanceRoutes = require('./routes/attendance');
const notificationRoutes = require('./routes/notifications');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/import', importRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/notifications', notificationRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Schedulo Backend API',
    version: '1.0.0',
    description: 'AI-powered timetable management system',
    status: 'running',
    endpoints: {
      auth: '/api/auth',
      import: '/api/import',
      timetable: '/api/timetable',
      attendance: '/api/attendance',
      notifications: '/api/notifications',
      health: '/health'
    },
    documentation: {
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        profile: 'GET /api/auth/profile'
      },
      import: {
        students: 'POST /api/import/students',
        faculty: 'POST /api/import/faculty',
        courses: 'POST /api/import/courses',
        rooms: 'POST /api/import/rooms'
      },
      timetable: {
        generate: 'POST /api/timetable/generate',
        slots: 'GET /api/timetable/slots',
        exportICS: 'GET /api/timetable/export/ics',
        exportPDF: 'GET /api/timetable/export/pdf'
      },
      attendance: {
        mark: 'POST /api/attendance/mark',
        studentReport: 'GET /api/attendance/student/:id',
        slotAttendance: 'GET /api/attendance/slot/:slotId'
      },
      notifications: {
        send: 'POST /api/notifications/send',
        list: 'GET /api/notifications',
        markRead: 'PUT /api/notifications/:id/read',
        markAllRead: 'PUT /api/notifications/mark-all-read',
        delete: 'DELETE /api/notifications/:id'
      }
    }
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    const { pool } = require('./db');
    const result = await pool.query('SELECT NOW()');
    
    res.json({ 
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: 'connected',
        timestamp: result.rows[0].now
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message,
      database: {
        status: 'disconnected'
      }
    });
  }
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Schedulo API Documentation',
    version: '1.0.0',
    baseURL: `${req.protocol}://${req.get('host')}/api`,
    authentication: {
      type: 'JWT Bearer Token',
      header: 'Authorization: Bearer <token>',
      loginEndpoint: '/api/auth/login'
    },
    roles: ['admin', 'faculty', 'student'],
    defaultCredentials: {
      email: 'admin@schedulo.com',
      password: 'admin123',
      role: 'admin'
    },
    endpoints: {
      authentication: {
        'POST /auth/login': 'Login user and get JWT token',
        'POST /auth/register': 'Register new user (admin only)',
        'GET /auth/profile': 'Get current user profile'
      },
      dataImport: {
        'POST /import/students': 'Import students from CSV (admin only)',
        'POST /import/faculty': 'Import faculty from CSV (admin only)',
        'POST /import/courses': 'Import courses from CSV (admin only)',
        'POST /import/rooms': 'Import rooms from CSV (admin only)'
      },
      timetable: {
        'POST /timetable/generate': 'Generate AI timetable (admin only)',
        'GET /timetable/slots': 'Get personal timetable slots',
        'GET /timetable/export/ics': 'Export timetable as iCal file',
        'GET /timetable/export/pdf': 'Export timetable as PDF'
      },
      attendance: {
        'POST /attendance/mark': 'Mark student attendance (faculty only)',
        'GET /attendance/student/:id': 'Get student attendance report',
        'GET /attendance/slot/:slotId': 'Get attendance for specific slot'
      },
      notifications: {
        'POST /notifications/send': 'Send notifications (admin/faculty)',
        'GET /notifications': 'Get user notifications',
        'PUT /notifications/:id/read': 'Mark notification as read',
        'PUT /notifications/mark-all-read': 'Mark all notifications as read',
        'DELETE /notifications/:id': 'Delete notification'
      }
    },
    csvFormats: {
      students: 'name,email,roll_number,year,semester,department_code',
      faculty: 'name,email,employee_id,department_code,specialization',
      courses: 'code,name,credits,department_code,semester,year',
      rooms: 'room_number,capacity,type,building'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation Error',
      details: err.message 
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token' 
    });
  }

  // Default error response
  res.status(err.status || 500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler - must be last route
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableRoutes: [
      'GET /',
      'GET /health',
      'GET /api',
      'POST /api/auth/login',
      'GET /api/timetable/slots',
      'POST /api/timetable/generate',
      'POST /api/import/students',
      'POST /api/attendance/mark'
    ]
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    console.log('🔄 Initializing Schedulo backend...');
    console.log('📊 Environment:', process.env.NODE_ENV || 'development');
    
    // Initialize database
    await initDB();
    console.log('✅ Database initialized successfully');
    
    // Start server
    const port = config.port;
    const server = app.listen(port, '0.0.0.0', () => {
      console.log('\n🚀 Schedulo Backend Server Started!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📍 Server URL: http://localhost:${port}`);
      console.log(`🔗 API Base: http://localhost:${port}/api`);
      console.log(`💚 Health Check: http://localhost:${port}/health`);
      console.log(`📚 Documentation: http://localhost:${port}/api`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔑 Default Admin Credentials:');
      console.log('   Email: admin@schedulo.com');
      console.log('   Password: admin123');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

    // Server error handling
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
};

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  
  // Close database connections
  const { pool } = require('./db');
  pool.end(() => {
    console.log('📊 Database connections closed');
    console.log('✅ Server shutdown complete');
    process.exit(0);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.log('⚠️  Forced shutdown after 10 seconds');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;
