const express = require('express');
const { pool } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Mark attendance (faculty only)
router.post('/mark', authenticateToken, requireRole('faculty'), async (req, res) => {
  try {
    const { slotId, studentIds, date, status = 'present' } = req.body;

    if (!slotId || !studentIds || !Array.isArray(studentIds) || !date) {
      return res.status(400).json({ error: 'Slot ID, student IDs array, and date are required' });
    }

    // Get faculty ID
    const facultyResult = await pool.query('SELECT id FROM faculty WHERE user_id = $1', [req.user.id]);
    if (facultyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Faculty record not found' });
    }
    const facultyId = facultyResult.rows[0].id;

    // Verify faculty can mark attendance for this slot
    const slotResult = await pool.query('SELECT * FROM timetable_slots WHERE id = $1 AND faculty_id = $2', [slotId, facultyId]);
    if (slotResult.rows.length === 0) {
      return res.status(403).json({ error: 'You can only mark attendance for your own classes' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let markedCount = 0;
      const errors = [];

      for (const studentId of studentIds) {
        try {
          // Check if attendance already marked for this date/slot/student
          const existingResult = await client.query(
            'SELECT id FROM attendance WHERE student_id = $1 AND slot_id = $2 AND date = $3',
            [studentId, slotId, date]
          );

          if (existingResult.rows.length > 0) {
            // Update existing record
            await client.query(
              'UPDATE attendance SET status = $1, marked_by = $2, marked_at = CURRENT_TIMESTAMP WHERE id = $3',
              [status, facultyId, existingResult.rows[0].id]
            );
          } else {
            // Create new record
            await client.query(
              'INSERT INTO attendance (student_id, slot_id, date, status, marked_by) VALUES ($1, $2, $3, $4, $5)',
              [studentId, slotId, date, status, facultyId]
            );
          }
          markedCount++;
        } catch (error) {
          errors.push(`Error marking attendance for student ${studentId}: ${error.message}`);
        }
      }

      await client.query('COMMIT');
      
      res.json({
        message: `Marked attendance for ${markedCount} students`,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ error: 'Failed to mark attendance' });
  }
});

// Get student attendance report
router.get('/student/:id', authenticateToken, async (req, res) => {
  try {
    const studentId = req.params.id;

    // Check permissions - students can only view their own attendance, faculty/admin can view any
    if (req.user.role === 'student') {
      const studentResult = await pool.query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
      if (studentResult.rows.length === 0 || studentResult.rows[0].id != studentId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const result = await pool.query(`
      SELECT 
        a.*,
        c.name as course_name,
        c.code as course_code,
        u.name as faculty_name,
        r.room_number,
        ts.day_of_week,
        ts.start_time,
        ts.end_time
      FROM attendance a
      JOIN timetable_slots ts ON a.slot_id = ts.id
      JOIN courses c ON ts.course_id = c.id
      JOIN faculty f ON ts.faculty_id = f.id
      JOIN users u ON f.user_id = u.id
      JOIN rooms r ON ts.room_id = r.id
      WHERE a.student_id = $1
      ORDER BY a.date DESC, ts.start_time
    `, [studentId]);

    // Calculate attendance statistics
    const totalClasses = result.rows.length;
    const presentCount = result.rows.filter(row => row.status === 'present').length;
    const attendancePercentage = totalClasses > 0 ? (presentCount / totalClasses * 100).toFixed(2) : 0;

    res.json({
      studentId,
      totalClasses,
      presentCount,
      absentCount: totalClasses - presentCount,
      attendancePercentage: parseFloat(attendancePercentage),
      records: result.rows
    });

  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Failed to get attendance report' });
  }
});

// Get attendance for a specific slot and date (faculty only)
router.get('/slot/:slotId', authenticateToken, requireRole('faculty'), async (req, res) => {
  try {
    const { slotId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    // Get faculty ID and verify they can access this slot
    const facultyResult = await pool.query('SELECT id FROM faculty WHERE user_id = $1', [req.user.id]);
    if (facultyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Faculty record not found' });
    }
    const facultyId = facultyResult.rows[0].id;

    const slotResult = await pool.query('SELECT * FROM timetable_slots WHERE id = $1 AND faculty_id = $2', [slotId, facultyId]);
    if (slotResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied for this slot' });
    }

    // Get all students for this course and their attendance
    const result = await pool.query(`
      SELECT 
        s.id as student_id,
        u.name as student_name,
        s.roll_number,
        a.status,
        a.marked_at
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN courses c ON s.department_id = c.department_id
      JOIN timetable_slots ts ON c.id = ts.course_id
      LEFT JOIN attendance a ON s.id = a.student_id AND a.slot_id = ts.id AND a.date = $2
      WHERE ts.id = $1
      ORDER BY s.roll_number
    `, [slotId, date]);

    res.json(result.rows);

  } catch (error) {
    console.error('Get slot attendance error:', error);
    res.status(500).json({ error: 'Failed to get slot attendance' });
  }
});

module.exports = router;
