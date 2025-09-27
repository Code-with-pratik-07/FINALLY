const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.database);

// Database initialization
const initDB = async () => {
  const client = await pool.connect();
  try {
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'faculty', 'student')),
        name VARCHAR(255) NOT NULL,
        department_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Departments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(10) UNIQUE NOT NULL
      )
    `);

    // Students table
    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        roll_number VARCHAR(20) UNIQUE NOT NULL,
        year INTEGER NOT NULL,
        semester INTEGER NOT NULL,
        department_id INTEGER REFERENCES departments(id)
      )
    `);

    // Faculty table
    await client.query(`
      CREATE TABLE IF NOT EXISTS faculty (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        employee_id VARCHAR(20) UNIQUE NOT NULL,
        department_id INTEGER REFERENCES departments(id),
        specialization VARCHAR(255)
      )
    `);

    // Rooms table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        room_number VARCHAR(20) UNIQUE NOT NULL,
        capacity INTEGER NOT NULL,
        type VARCHAR(50) DEFAULT 'classroom',
        building VARCHAR(100)
      )
    `);

    // Courses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        credits INTEGER DEFAULT 3,
        department_id INTEGER REFERENCES departments(id),
        semester INTEGER,
        year INTEGER
      )
    `);

    // Timetables table
    await client.query(`
      CREATE TABLE IF NOT EXISTS timetables (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        semester INTEGER NOT NULL,
        year INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Timetable slots table
    await client.query(`
      CREATE TABLE IF NOT EXISTS timetable_slots (
        id SERIAL PRIMARY KEY,
        timetable_id INTEGER REFERENCES timetables(id) ON DELETE CASCADE,
        course_id INTEGER REFERENCES courses(id),
        faculty_id INTEGER REFERENCES faculty(id),
        room_id INTEGER REFERENCES rooms(id),
        day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Attendance table
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id),
        slot_id INTEGER REFERENCES timetable_slots(id),
        date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'late')),
        marked_by INTEGER REFERENCES faculty(id),
        marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info',
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create default admin user if not exists
    const adminResult = await client.query('SELECT * FROM users WHERE email = $1', ['admin@schedulo.com']);
    if (adminResult.rows.length === 0) {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await client.query(
        'INSERT INTO users (email, password, role, name) VALUES ($1, $2, $3, $4)',
        ['admin@schedulo.com', hashedPassword, 'admin', 'System Administrator']
      );
    }

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization error:', err);
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };
