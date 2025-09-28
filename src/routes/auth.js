const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const config = require('../config');
const { authenticateToken, getUserProfile } = require('../middleware/authMiddleware');

const router = express.Router();

// Login endpoint
// Login endpoint with debugging
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔑 Login attempt:', { email, password: '***' });

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    console.log('👤 User query result:', userResult.rows.length, 'users found');
    
    if (userResult.rows.length === 0) {
      console.log('❌ No user found with email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    console.log('👤 User found:', { id: user.id, email: user.email, role: user.role });
    console.log('🔐 Password hash from DB:', user.password ? 'exists' : 'NULL');

    // Verify password
    console.log('🔍 Comparing passwords...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('✅ Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('❌ Password comparison failed');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('🎉 Login successful, generating token...');

    // Get user profile based on role
    const profile = await getUserProfile(user.id, user.role);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    console.log('🚀 Token generated, sending response');

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        profile
      }
    });
  } catch (error) {
    console.error('💥 Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});


// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role, departmentId } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userResult = await pool.query(
      'INSERT INTO users (email, password, name, role, department_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [email, hashedPassword, name, role, departmentId]
    );

    const user = userResult.rows[0];

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id, req.user.role);
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        profile
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});


// Role-based access control middleware
function requireRole(role) {
  return (req, res, next) => {
    if (req.user && req.user.role === role) {
      next();
    } else {
      res.status(403).json({ error: 'Insufficient permissions' });
    }
  };
}

// Admin analytics endpoint
router.get('/admin/analytics', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const studentsResult = await pool.query('SELECT COUNT(*) FROM students');
    const facultyResult = await pool.query('SELECT COUNT(*) FROM faculty');
    const coursesResult = await pool.query('SELECT COUNT(*) FROM courses');

    res.json({
      students: parseInt(studentsResult.rows[0].count),
      faculty: parseInt(facultyResult.rows[0].count),
      courses: parseInt(coursesResult.rows[0].count),
      message: 'Analytics data retrieved successfully'
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;

// Admin analytics endpoint
router.get('/admin/analytics', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    res.json({
      students: 600,
      faculty: 45,
      courses: 120,
      rooms: 35
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});
