const express = require('express');
const { pool } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Admin analytics endpoint
router.get('/analytics', authenticateToken, requireRole('admin'), async (req, res) => {
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

module.exports = router;
