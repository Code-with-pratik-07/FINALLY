class IntelligentScheduler {
    constructor(pool) {
        this.pool = pool;
        this.roomCapacity = 120;
    }

    async generateStudentTimetables(timetableId, year = 1, semester = 1) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Get all timetable slots for this timetable
            const slotsQuery = `
                SELECT ts.id, ts.day_of_week, ts.start_time, ts.end_time,
                       ts.course_id, ts.room_id, c.name as course_name, 
                       r.room_number, r.capacity as room_capacity
                FROM timetable_slots ts
                JOIN courses c ON ts.course_id = c.id  
                JOIN rooms r ON ts.room_id = r.id
                WHERE ts.timetable_id = $1
                ORDER BY ts.day_of_week, ts.start_time
            `;
            const slotsResult = await client.query(slotsQuery, [timetableId]);

            // Get all students for this year/semester
            const studentsQuery = `
                SELECT id, name, roll_number, branch, section
                FROM students 
                WHERE year = $1 AND semester = $2
                ORDER BY branch, section
            `;
            const studentsResult = await client.query(studentsQuery, [year, semester]);

            const students = studentsResult.rows;
            const slots = slotsResult.rows;
            
            console.log(`📚 Processing ${students.length} students across ${slots.length} time slots`);

            // Group students by branch for intelligent allocation
            const studentsByBranch = this.groupStudentsByBranch(students);
            
            let totalAssignments = 0;

            // For each time slot, intelligently assign students
            for (const slot of slots) {
                const assignments = await this.assignStudentsToSlot(
                    client, slot, JSON.parse(JSON.stringify(studentsByBranch)), timetableId
                );
                totalAssignments += assignments;
            }

            await client.query('COMMIT');
            
            return {
                success: true,
                timetableId,
                totalStudents: students.length,
                totalSlots: slots.length,
                totalAssignments,
                message: `Generated individual timetables for ${students.length} students with ${totalAssignments} assignments`
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    groupStudentsByBranch(students) {
        const grouped = {};
        students.forEach(student => {
            if (!grouped[student.branch]) {
                grouped[student.branch] = [];
            }
            grouped[student.branch].push(student);
        });
        return grouped;
    }

    async assignStudentsToSlot(client, slot, studentsByBranch, timetableId) {
        const roomCapacity = slot.room_capacity || this.roomCapacity;
        let remainingCapacity = roomCapacity;
        let assignments = 0;
        
        // Smart allocation: Mix branches to fill room optimally
        const branchNames = Object.keys(studentsByBranch);
        const studentsToAssign = [];

        // Round-robin allocation to mix branches
        while (remainingCapacity > 0 && this.hasStudentsLeft(studentsByBranch)) {
            for (const branch of branchNames) {
                if (studentsByBranch[branch].length > 0 && remainingCapacity > 0) {
                    const student = studentsByBranch[branch].shift();
                    studentsToAssign.push(student);
                    remainingCapacity--;
                }
            }
        }

        // Insert assignments into database
        for (const student of studentsToAssign) {
            const insertQuery = `
                INSERT INTO student_timetable_assignments 
                (student_id, timetable_slot_id, room_id)
                VALUES ($1, $2, $3)
            `;
            await client.query(insertQuery, [student.id, slot.id, slot.room_id]);
            assignments++;
        }

        console.log(`🎯 Slot ${slot.day_of_week}-${slot.start_time}: ${assignments} students assigned to ${slot.room_number}`);
        return assignments;
    }

    hasStudentsLeft(studentsByBranch) {
        return Object.values(studentsByBranch).some(students => students.length > 0);
    }
}

module.exports = IntelligentScheduler;
