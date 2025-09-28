const fs = require('fs');
const path = require('path');

function generateStudents() {
    const branches = {
        'AIML': { count: 150, prefix: 'AM' },
        'AI': { count: 150, prefix: 'AI' },
        'DS': { count: 150, prefix: 'DS' },
        'CSE': { count: 150, prefix: 'CS' }
    };

    const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
                       'Ananya', 'Diya', 'Priya', 'Kavya', 'Anika', 'Riya', 'Sara', 'Isha', 'Meera', 'Aditi'];
    
    const lastNames = ['Sharma', 'Verma', 'Singh', 'Kumar', 'Gupta', 'Agarwal', 'Jain', 'Patel', 'Shah', 'Mehta',
                      'Reddy', 'Nair', 'Iyer', 'Rao', 'Das', 'Ghosh', 'Banerjee', 'Chakraborty', 'Mukherjee', 'Roy'];

    let csvContent = 'name,email,roll_number,year,semester,department_code,branch,section\n';
    let rollCounter = 1;

    Object.entries(branches).forEach(([branchName, branchData]) => {
        const studentsPerSection = Math.ceil(branchData.count / Math.ceil(branchData.count / 120));
        let sectionCounter = 1;
        
        for (let i = 0; i < branchData.count; i++) {
            const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
            const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
            const name = `${firstName} ${lastName}`;
            
            const rollNumber = `2025${branchData.prefix}${rollCounter.toString().padStart(4, '0')}`;
            const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${rollCounter}@student.university.edu`;
            
            // Assign section (A, B, C, etc.)
            const sectionLetter = String.fromCharCode(65 + Math.floor(i / studentsPerSection));
            const section = `${branchName}-${sectionLetter}`;
            
            csvContent += `"${name}","${email}","${rollNumber}",1,1,"CSE","${branchName}","${section}"\n`;
            rollCounter++;
        }
    });

    return csvContent;
}

// Generate and save
const outputDir = './example_csvs';
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

try {
    const studentsData = generateStudents();
    fs.writeFileSync(path.join(outputDir, 'students_enhanced.csv'), studentsData);
    console.log('✅ Generated students_enhanced.csv (600 B.Tech CSE students across 4 branches)');
    
    // Show summary
    console.log('\n📊 Student Distribution:');
    console.log('🔸 AIML: 150 students (sections AIML-A, AIML-B)');
    console.log('🔸 AI: 150 students (sections AI-A, AI-B)'); 
    console.log('🔸 DS: 150 students (sections DS-A, DS-B)');
    console.log('🔸 CSE: 150 students (sections CSE-A, CSE-B)');
    console.log('🏢 Total: 600 students in CSE Department');

} catch (error) {
    console.error('❌ Error:', error.message);
}
