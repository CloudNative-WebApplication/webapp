const fs = require('fs');

// Function to load and log the content of the CSV file
function loadUserCSV(filePath) {
  if (fs.existsSync(filePath)) {
    console.log('File exists.');

    // Read and log the content of the CSV file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    console.log('CSV File Content:');
    console.log(fileContent);
  } else {
    console.log('File does not exist. Please check the file path.');
    process.exit(1); // Exit the application if the file doesn't exist
  }
}

// Export the function to be used in your main application
module.exports = loadUserCSV;
