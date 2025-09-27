const fs = require('fs');
const path = require('path');

// Ensure the output directory exists
const outputDir = 'example_csvs';
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Helper function to generate random names
const firstNames = [
    'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
    'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Rishabh', 'Ved', 'Aryan', 'Abhimanyu', 'Siddhant', 'Samarth',
    'Ananya', 'Diya', 'Priya', 'Kavya', 'Anika', 'Keya', 'Kiara', 'Myra', 'Sara', 'Zara',
    'Advika', 'Larisa', 'Riya', 'Ira', 'Tara', 'Navya', 'Avni', 'Ahana', 'Ishika', 'Shanaya',
    'Rajesh', 'Suresh', 'Ramesh', 'Mahesh', 'Ganesh'
];

const lastNames = [
    'Sharma', 'Verma', 'Singh', 'Kumar', 'Gupta', 'Agarwal', 'Jain', 'Bansal', 'Goyal', 'Mittal',
    'Chopra', 'Kapoor', 'Malhotra', 'Arora', 'Bhatia', 'Sethi', 'Khanna', 'Tiwari', 'Pandey', 'Mishra',
    'Yadav', 'Saxena', 'Srivastava', 'Tripathi', 'Dubey', 'Joshi', 'Nair', 'Menon', 'Iyer', 'Reddy',
    'Rao', 'Patel', 'Shah', 'Mehta', 'Desai', 'Modi', 'Thakur', 'Chauhan', 'Rajput', 'Bhatt',
    'Sinha', 'Ghosh', 'Mukherjee', 'Chatterjee', 'Das'
];

function getRandomName() {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    return `${firstName} ${lastName}`;
}

function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function getRandomElements(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

// Generate Faculty CSV with CORRECT schema
function generateFaculty() {
    let csvContent = 'name,email,employee_id,department_code,specialization\n';

    // Use actual department codes from your database
    const departments = ['CSE', 'ECE', 'ME', 'CE', 'IT'];
    
    for (let i = 0; i < 45; i++) {
        const name = getRandomName();
        const email = `${name.toLowerCase().replace(' ', '.')}@university.edu`;
        const employeeId = `FAC${(i + 1).toString().padStart(3, '0')}`;
        const departmentCode = getRandomElement(departments);
        const specialization = getRandomElement([
            'Computer Science', 'Electronics Engineering', 'Mechanical Engineering', 
            'Civil Engineering', 'Information Technology', 'Software Engineering'
        ]);

        csvContent += `"${name}","${email}","${employeeId}","${departmentCode}","${specialization}"\n`;
    }

    return csvContent;
}

// Generate Courses CSV (keep your existing function)
// Replace your generateCourses function with this complete version:
function generateCourses() {
    const departments = ['CSE', 'ECE', 'ME', 'CE', 'IT']; // Match your database
    
    const courseTemplates = {
        'CSE': ['Data Structures and Algorithms', 'Database Management Systems', 'Computer Networks', 'Operating Systems', 'Software Engineering'],
        'ECE': ['Digital Signal Processing', 'Microprocessors', 'VLSI Design', 'Communication Systems', 'Control Systems'],
        'ME': ['Thermodynamics', 'Fluid Mechanics', 'Machine Design', 'Manufacturing Processes', 'Heat Transfer'],
        'CE': ['Structural Analysis', 'Concrete Technology', 'Geotechnical Engineering', 'Transportation Engineering', 'Environmental Engineering'],
        'IT': ['Web Development', 'Mobile App Development', 'Cloud Computing', 'Cybersecurity', 'Data Analytics']
    };

    let csvContent = 'code,name,credits,department_code,semester,year\n';
    let courseCounter = 1;

    departments.forEach(dept => {
        const courses = courseTemplates[dept];
        courses.forEach((courseName, index) => {
            const code = `${dept}${courseCounter.toString().padStart(3, '0')}`;
            const credits = [3, 4, 2][Math.floor(Math.random() * 3)]; // Random 2,3,4 credits
            const semester = (index % 8) + 1; // Distribute 1-8
            const year = Math.ceil(semester / 2); // Calculate year (1-4)

            csvContent += `"${code}","${courseName}",${credits},"${dept}",${semester},${year}\n`;
            courseCounter++;
        });
    });

    return csvContent;
}


// Generate Rooms CSV (keep your existing function)
function generateRooms() {
    const roomTypes = ['lecture_hall', 'laboratory', 'seminar_hall', 'tutorial_room'];
    
    let csvContent = 'room_number,capacity,type\n';

    // 10 lecture halls with capacity 90
    for (let i = 1; i <= 10; i++) {
        const roomNumber = `LH${i.toString().padStart(2, '0')}`;
        const capacity = 90;
        const type = 'lecture_hall';
        csvContent += `"${roomNumber}",${capacity},"${type}"\n`;
    }

    // 5 smaller rooms with capacity 60
    for (let i = 11; i <= 15; i++) {
        const roomNumber = `LH${i.toString().padStart(2, '0')}`;
        const capacity = 60;
        const type = getRandomElement(roomTypes);
        csvContent += `"${roomNumber}",${capacity},"${type}"\n`;
    }

    return csvContent;
}
try {
    // Generate Faculty CSV
    const facultyData = generateFaculty();
    fs.writeFileSync(path.join(outputDir, 'faculty.csv'), facultyData);
    console.log('✅ Generated faculty.csv (45 faculty members)');

    // Generate Courses CSV
    const coursesData = generateCourses();
    fs.writeFileSync(path.join(outputDir, 'courses.csv'), coursesData);
    console.log('✅ Generated courses.csv (84 courses across 7 branches)');

    // Generate Rooms CSV - ADD THIS IF MISSING
    const roomsData = generateRooms();
    fs.writeFileSync(path.join(outputDir, 'rooms.csv'), roomsData);
    console.log('✅ Generated rooms.csv (15 lecture halls)');

} catch (error) {
    console.error('❌ Error generating CSV files:', error.message);
}
