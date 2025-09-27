-- Schedulo Enhanced Database Schema
-- Drop existing tables to avoid conflicts (optional)
-- DROP TABLE IF EXISTS attendance, notifications, slots, timetables, rooms, courses, faculty, students, users CASCADE;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'faculty', 'student')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    roll VARCHAR(20) UNIQUE NOT NULL,
    year INTEGER NOT NULL CHECK (year BETWEEN 1 AND 4),
    branch VARCHAR(10) NOT NULL, -- CSE, ECE, ME, etc.
    section CHAR(1) NOT NULL CHECK (section IN ('A', 'B', 'C', 'D', 'E')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_student UNIQUE (user_id)
);

-- Faculty table
CREATE TABLE IF NOT EXISTS faculty (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    subjects TEXT[] NOT NULL DEFAULT '{}', -- Array of subject names
    availability JSONB DEFAULT '{}', -- JSON: {"monday": ["09:00-10:00", "11:00-12:00"], ...}
    specialization VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_faculty UNIQUE (user_id)
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('theory', 'lab')),
    credits INTEGER NOT NULL CHECK (credits BETWEEN 1 AND 6),
    weekly_slots INTEGER NOT NULL CHECK (weekly_slots BETWEEN 1 AND 10),
    year INTEGER NOT NULL CHECK (year BETWEEN 1 AND 4),
    branch VARCHAR(10) NOT NULL,
    semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL, -- e.g., "CSE-101", "Lab-A"
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    equipment JSONB DEFAULT '{}', -- JSON: {"projector": true, "ac": true, "computers": 30}
    room_type VARCHAR(20) DEFAULT 'classroom' CHECK (room_type IN ('classroom', 'lab', 'auditorium', 'seminar')),
    building VARCHAR(100),
    floor INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Timetables table
CREATE TABLE IF NOT EXISTS timetables (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL, -- e.g., "Fall-2025-v1.0"
    academic_year VARCHAR(20) NOT NULL, -- e.g., "2025-26"
    semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
    is_active BOOLEAN DEFAULT false,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    start_date DATE,
    end_date DATE,
    CONSTRAINT unique_active_timetable UNIQUE (academic_year, semester, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- Slots table (individual time slots in timetable)
CREATE TABLE IF NOT EXISTS slots (
    id SERIAL PRIMARY KEY,
    timetable_id INTEGER NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    faculty_id INTEGER NOT NULL REFERENCES faculty(id),
    room_id INTEGER NOT NULL REFERENCES rooms(id),
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Monday
    slot_type VARCHAR(20) DEFAULT 'regular' CHECK (slot_type IN ('regular', 'makeup', 'extra')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Prevent double booking
    CONSTRAINT unique_faculty_slot UNIQUE (faculty_id, slot_date, start_time),
    CONSTRAINT unique_room_slot UNIQUE (room_id, slot_date, start_time),
    -- Ensure end_time > start_time
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    title VARCHAR(255),
    type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
    read_status BOOLEAN DEFAULT false,
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    slot_id INTEGER NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status VARCHAR(10) NOT NULL CHECK (status IN ('present', 'absent', 'excused', 'late')),
    taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    marked_by INTEGER REFERENCES faculty(id),
    notes TEXT,
    CONSTRAINT unique_attendance UNIQUE (slot_id, student_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_students_roll ON students(roll);
CREATE INDEX IF NOT EXISTS idx_students_year_branch ON students(year, branch, section);
CREATE INDEX IF NOT EXISTS idx_faculty_subjects ON faculty USING GIN(subjects);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);
CREATE INDEX IF NOT EXISTS idx_courses_year_branch ON courses(year, branch, semester);
CREATE INDEX IF NOT EXISTS idx_slots_date ON slots(slot_date, day_of_week);
CREATE INDEX IF NOT EXISTS idx_slots_timetable ON slots(timetable_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_status);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_slot ON attendance(slot_id);

-- Insert sample data
INSERT INTO users (name, email, password_hash, role) VALUES 
    ('System Administrator', 'admin@schedulo.com', '$2b$10$rOzKqNbHkzYPtJFzFcR8KOYlwqX.DzD7hI7cK3lWdNqR9kcHQgF8W', 'admin'),
    ('Dr. John Smith', 'john.smith@college.edu', '$2b$10$rOzKqNbHkzYPtJFzFcR8KOYlwqX.DzD7hI7cK3lWdNqR9kcHQgF8W', 'faculty'),
    ('Alice Johnson', 'alice@student.edu', '$2b$10$rOzKqNbHkzYPtJFzFcR8KOYlwqX.DzD7hI7cK3lWdNqR9kcHQgF8W', 'student')
ON CONFLICT (email) DO NOTHING;

-- Insert sample faculty
INSERT INTO faculty (user_id, employee_id, subjects, availability, specialization) VALUES 
    (2, 'FAC001', ARRAY['Computer Networks', 'Database Systems'], 
     '{"monday": ["09:00-12:00", "14:00-17:00"], "tuesday": ["10:00-13:00"], "wednesday": ["09:00-12:00"]}',
     'Computer Science')
ON CONFLICT (user_id) DO NOTHING;

-- Insert sample student
INSERT INTO students (user_id, roll, year, branch, section) VALUES 
    (3, '2021CSE001', 3, 'CSE', 'A')
ON CONFLICT (user_id) DO NOTHING;

-- Insert sample courses
INSERT INTO courses (code, name, type, credits, weekly_slots, year, branch, semester) VALUES 
    ('CS301', 'Database Management Systems', 'theory', 4, 4, 3, 'CSE', 5),
    ('CS302', 'Database Lab', 'lab', 2, 2, 3, 'CSE', 5),
    ('CS303', 'Computer Networks', 'theory', 3, 3, 3, 'CSE', 5)
ON CONFLICT (code) DO NOTHING;

-- Insert sample rooms
INSERT INTO rooms (name, capacity, equipment, room_type) VALUES 
    ('CSE-101', 60, '{"projector": true, "ac": true, "whiteboard": true}', 'classroom'),
    ('CSE-Lab-A', 30, '{"computers": 30, "projector": true, "ac": true}', 'lab'),
    ('Auditorium', 200, '{"projector": true, "ac": true, "sound_system": true}', 'auditorium')
ON CONFLICT (name) DO NOTHING;

-- Create a function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE OR REPLACE VIEW student_details AS
SELECT 
    u.id, u.name, u.email, s.roll, s.year, s.branch, s.section,
    u.created_at
FROM users u
JOIN students s ON u.id = s.user_id
WHERE u.role = 'student';

CREATE OR REPLACE VIEW faculty_details AS
SELECT 
    u.id, u.name, u.email, f.employee_id, f.subjects, 
    f.availability, f.specialization, u.created_at
FROM users u
JOIN faculty f ON u.id = f.user_id
WHERE u.role = 'faculty';

-- Function to get weekly timetable for a student
CREATE OR REPLACE FUNCTION get_student_timetable(student_user_id INTEGER)
RETURNS TABLE (
    slot_id INTEGER,
    course_code VARCHAR,
    course_name VARCHAR,
    faculty_name VARCHAR,
    room_name VARCHAR,
    day_of_week INTEGER,
    start_time TIME,
    end_time TIME,
    slot_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sl.id,
        c.code,
        c.name,
        u.name,
        r.name,
        sl.day_of_week,
        sl.start_time,
        sl.end_time,
        sl.slot_date
    FROM slots sl
    JOIN courses c ON sl.course_id = c.id
    JOIN faculty f ON sl.faculty_id = f.id
    JOIN users u ON f.user_id = u.id
    JOIN rooms r ON sl.room_id = r.id
    JOIN students s ON s.year = c.year AND s.branch = c.branch
    JOIN timetables t ON sl.timetable_id = t.id
    WHERE s.user_id = student_user_id 
    AND t.is_active = true
    ORDER BY sl.day_of_week, sl.start_time;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
