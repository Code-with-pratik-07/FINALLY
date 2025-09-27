const jwt = require('jsonwebtoken');
const config = require('../config');
const { pool } = require('../db');

// Verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, config.jwt.secret, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    try {
      // Get user details from database
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      req.user = result.rows[0];
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  });
};

// Role-based access control
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Get user profile with additional details
const getUserProfile = async (userId, role) => {
  let profileQuery;

  switch (role) {
    case 'student':
      profileQuery = `
        SELECT s.*, d.name as department_name, d.code as department_code
        FROM students s
        LEFT JOIN departments d ON s.department_id = d.id
        WHERE s.user_id = $1
      `;
      break;
    case 'faculty':
      profileQuery = `
        SELECT f.*, d.name as department_name, d.code as department_code
        FROM faculty f
        LEFT JOIN departments d ON f.department_id = d.id
        WHERE f.user_id = $1
      `;
      break;
    default:
      return null;
  }

  if (profileQuery) {
    const result = await pool.query(profileQuery, [userId]);
    return result.rows[0] || null;
  }
  return null;
};

module.exports = {
  authenticateToken,
  requireRole,
  getUserProfile
};
