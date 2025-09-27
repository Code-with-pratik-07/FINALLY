const express = require('express');
const nodemailer = require('nodemailer');
const { pool } = require('../db');
const config = require('../config');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Configure nodemailer
const transporter = nodemailer.createTransport(config.email);


// Send notification
router.post('/send', authenticateToken, requireRole('admin', 'faculty'), async (req, res) => {
  try {
    const { recipientIds, title, message, type = 'info', sendEmail = false } = req.body;

    if (!recipientIds || !Array.isArray(recipientIds) || !title || !message) {
      return res.status(400).json({ error: 'Recipient IDs, title, and message are required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let successCount = 0;
      const errors = [];

      for (const userId of recipientIds) {
        try {
          // Insert notification into database
          await client.query(
            'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
            [userId, title, message, type]
          );

          // Send email if requested
          if (sendEmail && config.email.auth.user) {
            const userResult = await client.query('SELECT email, name FROM users WHERE id = $1', [userId]);
            if (userResult.rows.length > 0) {
              const user = userResult.rows[0];
              
              const mailOptions = {
                from: config.email.auth.user,
                to: user.email,
                subject: title,
                html: `
                  <h2>${title}</h2>
                  <p>Dear ${user.name},</p>
                  <p>${message}</p>
                  <br>
                  <p>Best regards,<br>Schedulo Team</p>
                `
              };

              await transporter.sendMail(mailOptions);
            }
          }

          successCount++;
        } catch (error) {
          errors.push(`Error sending notification to user ${userId}: ${error.message}`);
        }
      }

      await client.query('COMMIT');

      res.json({
        message: `Sent ${successCount} notifications successfully`,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

// Get user notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { userId, limit = 50, offset = 0, unreadOnly = false } = req.query;
    const targetUserId = userId || req.user.id;

    // Users can only access their own notifications unless they're admin
    if (req.user.role !== 'admin' && targetUserId != req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let query = `
      SELECT * FROM notifications 
      WHERE user_id = $1
    `;
    const params = [targetUserId];

    if (unreadOnly === 'true') {
      query += ' AND is_read = false';
    }

    query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get unread count
    const unreadResult = await pool.query(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = false',
      [targetUserId]
    );

    res.json({
      notifications: result.rows,
      unreadCount: parseInt(unreadResult.rows[0].unread_count)
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;

    const result = await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [notificationId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read' });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1',
      [req.user.id]
    );

    res.json({ message: 'All notifications marked as read' });

  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;

    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [notificationId, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
