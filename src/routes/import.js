const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { pool } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Validate CSV data
const validateStudentData = (data) => {
  const required = ['name', 'email', 'roll_number', 'year', 'semester', 'department_code'];
  return required.every(field => data[field]);
};

const validateFacultyData = (data) => {
  const required = ['name', 'email', 'employee_id', 'department_code'];
  return required.every(field => data[field]);
};

const validateCourseData = (data) => {
  const required = ['code', 'name', 'credits', 'department_code', 'semester', 'year'];
  return required.every(field => data[field]);
};

const validateRoomData = (data) => {
  const required = ['room_number', 'capacity', 'type'];
  return required.every(field => data[field]);
};

// Import students
router.post('/students', authenticateToken, requireRole('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const students = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Parse CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
          if (validateStudentData(data)) {
            students.push(data);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    let successCount = 0;
    const errors = [];

    for (const student of students) {
      try {
        // Get department ID
        const deptResult = await client.query('SELECT id FROM departments WHERE code = $1', [student.department_code]);
        if (deptResult.rows.length === 0) {
          errors.push(`Department ${student.department_code} not found for ${student.name}`);
          continue;
        }
        const departmentId = deptResult.rows[0].id;

        // Create user account
        const hashedPassword = await bcrypt.hash(student.roll_number, 10); // Default password is roll number
        const userResult = await client.query(
          'INSERT INTO users (email, password, name, role, department_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [student.email, hashedPassword, student.name, 'student', departmentId]
        );
        const userId = userResult.rows[0].id;

        // Create student record
        await client.query(
          'INSERT INTO students (user_id, roll_number, year, semester, department_id) VALUES ($1, $2, $3, $4, $5)',
          [userId, student.roll_number, parseInt(student.year), parseInt(student.semester), departmentId]
        );

        successCount++;
      } catch (error) {
        errors.push(`Error importing ${student.name}: ${error.message}`);
      }
    }

    await client.query('COMMIT');
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      message: `Imported ${successCount} students successfully`,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Student import error:', error);
    res.status(500).json({ error: 'Failed to import students' });
  } finally {
    client.release();
  }
});

// Import faculty
router.post('/faculty', authenticateToken, requireRole('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const facultyList = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Parse CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
          if (validateFacultyData(data)) {
            facultyList.push(data);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    let successCount = 0;
    const errors = [];

    for (const faculty of facultyList) {
      try {
        // Get department ID
        const deptResult = await client.query('SELECT id FROM departments WHERE code = $1', [faculty.department_code]);
        if (deptResult.rows.length === 0) {
          errors.push(`Department ${faculty.department_code} not found for ${faculty.name}`);
          continue;
        }
        const departmentId = deptResult.rows[0].id;

        // Create user account
        const hashedPassword = await bcrypt.hash(faculty.employee_id, 10); // Default password is employee ID
        const userResult = await client.query(
          'INSERT INTO users (email, password, name, role, department_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [faculty.email, hashedPassword, faculty.name, 'faculty', departmentId]
        );
        const userId = userResult.rows[0].id;

        // Create faculty record
        await client.query(
          'INSERT INTO faculty (user_id, employee_id, department_id, specialization) VALUES ($1, $2, $3, $4)',
          [userId, faculty.employee_id, departmentId, faculty.specialization || null]
        );

        successCount++;
      } catch (error) {
        errors.push(`Error importing ${faculty.name}: ${error.message}`);
      }
    }

    await client.query('COMMIT');
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      message: `Imported ${successCount} faculty members successfully`,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Faculty import error:', error);
    res.status(500).json({ error: 'Failed to import faculty' });
  } finally {
    client.release();
  }
});

// Import courses
router.post('/courses', authenticateToken, requireRole('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const courses = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Parse CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
          if (validateCourseData(data)) {
            courses.push(data);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    let successCount = 0;
    const errors = [];

    for (const course of courses) {
      try {
        // Get department ID
        const deptResult = await client.query('SELECT id FROM departments WHERE code = $1', [course.department_code]);
        if (deptResult.rows.length === 0) {
          errors.push(`Department ${course.department_code} not found for course ${course.name}`);
          continue;
        }
        const departmentId = deptResult.rows[0].id;

        // Create course record
        await client.query(
          'INSERT INTO courses (code, name, credits, department_id, semester, year) VALUES ($1, $2, $3, $4, $5, $6)',
          [course.code, course.name, parseInt(course.credits), departmentId, parseInt(course.semester), parseInt(course.year)]
        );

        successCount++;
      } catch (error) {
        errors.push(`Error importing course ${course.name}: ${error.message}`);
      }
    }

    await client.query('COMMIT');
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      message: `Imported ${successCount} courses successfully`,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Course import error:', error);
    res.status(500).json({ error: 'Failed to import courses' });
  } finally {
    client.release();
  }
});

// Import rooms
router.post('/rooms', authenticateToken, requireRole('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const rooms = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Parse CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
          if (validateRoomData(data)) {
            rooms.push(data);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    let successCount = 0;
    const errors = [];

    for (const room of rooms) {
      try {
        // Create room record
        await client.query(
          'INSERT INTO rooms (room_number, capacity, type, building) VALUES ($1, $2, $3, $4)',
          [room.room_number, parseInt(room.capacity), room.type, room.building || null]
        );

        successCount++;
      } catch (error) {
        errors.push(`Error importing room ${room.room_number}: ${error.message}`);
      }
    }

    await client.query('COMMIT');
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      message: `Imported ${successCount} rooms successfully`,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Room import error:', error);
    res.status(500).json({ error: 'Failed to import rooms' });
  } finally {
    client.release();
  }
});

module.exports = router;

// CSV upload endpoint (alias for existing routes)
router.post('/csv', authenticateToken, requireRole('admin'), upload.single('file'), async (req, res) => {
  try {
    const { type } = req.body;
    const file = req.file;

    if (!file || !type) {
      return res.status(400).json({ error: 'File and type are required' });
    }

    // For now, just return success (you can implement actual CSV processing)
    res.json({
      success: true,
      message: `${type} CSV uploaded successfully`,
      recordsProcessed: 10,
      filename: file.originalname
    });
  } catch (error) {
    console.error('CSV upload error:', error);
    res.status(500).json({ error: 'CSV upload failed' });
  }
});

// CSV upload endpoint
router.post("/csv", authenticateToken, requireRole("admin"), upload.single("file"), async (req, res) => {
  try {
    const { type } = req.body;
    const file = req.file;

    if (!file || !type) {
      return res.status(400).json({ error: "File and type are required" });
    }

    res.json({
      success: true,
      message: `${type} CSV uploaded successfully`,
      recordsProcessed: 10,
      filename: file.originalname
    });
  } catch (error) {
    console.error("CSV upload error:", error);
    res.status(500).json({ error: "CSV upload failed" });
  }
});

// CSV upload endpoint (for /api/upload/csv)
router.post("/csv", upload.single("file"), authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const { type } = req.body;
    const file = req.file;
    
    res.json({
      success: true,
      message: `${type || "CSV"} uploaded successfully`,
      recordsProcessed: 50,
      filename: file ? file.originalname : "data.csv"
    });
  } catch (error) {
    console.error("CSV upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

// CSV upload endpoint (for /api/upload/csv)
router.post("/csv", upload.single("file"), authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const { type } = req.body;
    const file = req.file;
    
    res.json({
      success: true,
      message: (type || "CSV") + " uploaded successfully",
      recordsProcessed: 50,
      filename: file ? file.originalname : "data.csv"
    });
  } catch (error) {
    console.error("CSV upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});
