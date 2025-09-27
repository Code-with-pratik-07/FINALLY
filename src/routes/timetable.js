const express = require('express');
const ics = require('ics');
const puppeteer = require('puppeteer');
const { pool } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const GreedyScheduler = require('../scheduler/greedyScheduler');

const router = express.Router();

// Generate timetable
router.post('/generate', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { semester, year, name } = req.body;

    if (!semester || !year || !name) {
      return res.status(400).json({ error: 'Semester, year, and name are required' });
    }

    const scheduler = new GreedyScheduler();
    const result = await scheduler.generateTimetable(semester, year, name);

    res.json(result);
  } catch (error) {
    console.error('Timetable generation error:', error);
    res.status(500).json({ error: 'Failed to generate timetable' });
  }
});

// Get personal timetable slots
router.get('/slots', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.query;
    const targetUserId = userId || req.user.id;

    let query;
    let params;

    if (req.user.role === 'student') {
      query = `
        SELECT 
          ts.*, 
          c.name as course_name, 
          c.code as course_code,
          r.room_number,
          u.name as faculty_name,
          t.name as timetable_name
        FROM timetable_slots ts
        JOIN timetables t ON ts.timetable_id = t.id
        JOIN courses c ON ts.course_id = c.id
        JOIN rooms r ON ts.room_id = r.id
        JOIN faculty f ON ts.faculty_id = f.id
        JOIN users u ON f.user_id = u.id
        JOIN students s ON s.department_id = c.department_id
        WHERE s.user_id = $1 AND t.is_active = true
        ORDER BY ts.day_of_week, ts.start_time
      `;
      params = [targetUserId];
    } else if (req.user.role === 'faculty') {
      query = `
        SELECT 
          ts.*, 
          c.name as course_name, 
          c.code as course_code,
          r.room_number,
          t.name as timetable_name
        FROM timetable_slots ts
        JOIN timetables t ON ts.timetable_id = t.id
        JOIN courses c ON ts.course_id = c.id
        JOIN rooms r ON ts.room_id = r.id
        JOIN faculty f ON ts.faculty_id = f.id
        WHERE f.user_id = $1 AND t.is_active = true
        ORDER BY ts.day_of_week, ts.start_time
      `;
      params = [targetUserId];
    } else {
      // Admin can see all slots
      query = `
        SELECT 
          ts.*, 
          c.name as course_name, 
          c.code as course_code,
          r.room_number,
          u.name as faculty_name,
          t.name as timetable_name
        FROM timetable_slots ts
        JOIN timetables t ON ts.timetable_id = t.id
        JOIN courses c ON ts.course_id = c.id
        JOIN rooms r ON ts.room_id = r.id
        JOIN faculty f ON ts.faculty_id = f.id
        JOIN users u ON f.user_id = u.id
        WHERE t.is_active = true
        ORDER BY ts.day_of_week, ts.start_time
      `;
      params = [];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get slots error:', error);
    res.status(500).json({ error: 'Failed to get timetable slots' });
  }
});

// Export timetable as ICS
router.get('/export/ics', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.query;
    const targetUserId = userId || req.user.id;

    // Get user's timetable slots
    const slotsResult = await pool.query(`
      SELECT 
        ts.*, 
        c.name as course_name, 
        c.code as course_code,
        r.room_number,
        u.name as faculty_name
      FROM timetable_slots ts
      JOIN timetables t ON ts.timetable_id = t.id
      JOIN courses c ON ts.course_id = c.id
      JOIN rooms r ON ts.room_id = r.id
      JOIN faculty f ON ts.faculty_id = f.id
      JOIN users u ON f.user_id = u.id
      WHERE (
        (SELECT role FROM users WHERE id = $1) = 'faculty' AND f.user_id = $1
        OR
        (SELECT role FROM users WHERE id = $1) = 'student' AND EXISTS (
          SELECT 1 FROM students s WHERE s.user_id = $1 AND s.department_id = c.department_id
        )
      )
      AND t.is_active = true
    `, [targetUserId]);

    const events = slotsResult.rows.map(slot => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + (slot.day_of_week - startDate.getDay()));
      const [startHour, startMinute] = slot.start_time.split(':');
      startDate.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);

      const endDate = new Date(startDate);
      const [endHour, endMinute] = slot.end_time.split(':');
      endDate.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);

      return {
        start: [startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate(), startDate.getHours(), startDate.getMinutes()],
        end: [endDate.getFullYear(), endDate.getMonth() + 1, endDate.getDate(), endDate.getHours(), endDate.getMinutes()],
        title: `${slot.course_code} - ${slot.course_name}`,
        description: `Faculty: ${slot.faculty_name}\nRoom: ${slot.room_number}`,
        location: slot.room_number
      };
    });

    const { error, value } = ics.createEvents(events);
    if (error) {
      throw error;
    }

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', 'attachment; filename=timetable.ics');
    res.send(value);
  } catch (error) {
    console.error('ICS export error:', error);
    res.status(500).json({ error: 'Failed to export calendar' });
  }
});

// Export timetable as PDF
router.get('/export/pdf', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.query;
    const targetUserId = userId || req.user.id;

    // Get user's timetable slots
    const slotsResult = await pool.query(`
      SELECT 
        ts.*, 
        c.name as course_name, 
        c.code as course_code,
        r.room_number,
        u.name as faculty_name
      FROM timetable_slots ts
      JOIN timetables t ON ts.timetable_id = t.id
      JOIN courses c ON ts.course_id = c.id
      JOIN rooms r ON ts.room_id = r.id
      JOIN faculty f ON ts.faculty_id = f.id
      JOIN users u ON f.user_id = u.id
      WHERE (
        (SELECT role FROM users WHERE id = $1) = 'faculty' AND f.user_id = $1
        OR
        (SELECT role FROM users WHERE id = $1) = 'student' AND EXISTS (
          SELECT 1 FROM students s WHERE s.user_id = $1 AND s.department_id = c.department_id
        )
      )
      AND t.is_active = true
      ORDER BY ts.day_of_week, ts.start_time
    `, [targetUserId]);

    // Generate HTML for PDF
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Timetable</title>
        <style>
          body { font-family: Arial, sans-serif; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f2f2f2; }
          .day { font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Personal Timetable</h1>
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>Time</th>
              <th>Course</th>
              <th>Faculty</th>
              <th>Room</th>
            </tr>
          </thead>
          <tbody>
            ${slotsResult.rows.map(slot => {
              const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
              return `
                <tr>
                  <td class="day">${days[slot.day_of_week]}</td>
                  <td>${slot.start_time} - ${slot.end_time}</td>
                  <td>${slot.course_code} - ${slot.course_name}</td>
                  <td>${slot.faculty_name}</td>
                  <td>${slot.room_number}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html);
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=timetable.pdf');
    res.send(pdf);
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
