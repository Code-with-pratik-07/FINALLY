const { pool } = require('../db');

class GreedyScheduler {
  constructor() {
    this.timeSlots = [
      { start: '09:00', end: '10:00' },
      { start: '10:00', end: '11:00' },
      { start: '11:00', end: '12:00' },
      { start: '12:00', end: '13:00' },
      { start: '14:00', end: '15:00' },
      { start: '15:00', end: '16:00' },
      { start: '16:00', end: '17:00' },
      { start: '17:00', end: '18:00' }
    ];
    this.daysOfWeek = [1, 2, 3, 4, 5]; // Monday to Friday
  }

  async generateTimetable(semester, year, timetableName) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create new timetable
      const timetableResult = await client.query(
        'INSERT INTO timetables (name, semester, year, is_active) VALUES ($1, $2, $3, $4) RETURNING id',
        [timetableName, semester, year, true]
      );
      const timetableId = timetableResult.rows[0].id;

      // Deactivate other timetables for the same semester/year
      await client.query(
        'UPDATE timetables SET is_active = false WHERE semester = $1 AND year = $2 AND id != $3',
        [semester, year, timetableId]
      );

      // Get courses for the semester/year
      const coursesResult = await client.query(
        'SELECT c.*, d.name as department_name FROM courses c JOIN departments d ON c.department_id = d.id WHERE c.semester = $1 AND c.year = $2',
        [semester, year]
      );
      const courses = coursesResult.rows;

      // Get available faculty
      const facultyResult = await client.query(
        'SELECT f.*, u.name FROM faculty f JOIN users u ON f.user_id = u.id'
      );
      const faculty = facultyResult.rows;

      // Get available rooms
      const roomsResult = await client.query('SELECT * FROM rooms ORDER BY capacity DESC');
      const rooms = roomsResult.rows;

      // Track assignments to avoid conflicts
      const facultySchedule = new Map(); // faculty_id -> Set of time slots
      const roomSchedule = new Map(); // room_id -> Set of time slots

      const assignments = [];

      // Initialize schedules
      faculty.forEach(f => facultySchedule.set(f.id, new Set()));
      rooms.forEach(r => roomSchedule.set(r.id, new Set()));

      // Assign each course to slots
      for (const course of courses) {
        const creditsToSchedule = course.credits;
        let scheduledCredits = 0;

        while (scheduledCredits < creditsToSchedule) {
          let assigned = false;

          // Try to find a suitable slot
          for (const day of this.daysOfWeek) {
            if (assigned) break;

            for (const timeSlot of this.timeSlots) {
              if (assigned) break;

              const slotKey = `${day}-${timeSlot.start}`;

              // Find available faculty (prefer same department)
              const availableFaculty = faculty.filter(f => {
                return !facultySchedule.get(f.id).has(slotKey) &&
                       (f.department_id === course.department_id || !f.department_id);
              });

              if (availableFaculty.length === 0) continue;

              // Find available room
              const availableRooms = rooms.filter(r => 
                !roomSchedule.get(r.id).has(slotKey)
              );

              if (availableRooms.length === 0) continue;

              // Make assignment
              const selectedFaculty = availableFaculty[0];
              const selectedRoom = availableRooms[0];

              // Record the assignment
              facultySchedule.get(selectedFaculty.id).add(slotKey);
              roomSchedule.get(selectedRoom.id).add(slotKey);

              assignments.push({
                timetableId,
                courseId: course.id,
                facultyId: selectedFaculty.id,
                roomId: selectedRoom.id,
                dayOfWeek: day,
                startTime: timeSlot.start,
                endTime: timeSlot.end
              });

              scheduledCredits++;
              assigned = true;
            }
          }

          // If no slot found, break to avoid infinite loop
          if (!assigned) {
            console.warn(`Could not schedule all credits for course ${course.name}`);
            break;
          }
        }
      }

      // Insert all assignments into database
      for (const assignment of assignments) {
        await client.query(
          'INSERT INTO timetable_slots (timetable_id, course_id, faculty_id, room_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [assignment.timetableId, assignment.courseId, assignment.facultyId, assignment.roomId, assignment.dayOfWeek, assignment.startTime, assignment.endTime]
        );
      }

      await client.query('COMMIT');

      return {
        timetableId,
        assignmentsCount: assignments.length,
        message: `Generated timetable with ${assignments.length} slots`
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = GreedyScheduler;
