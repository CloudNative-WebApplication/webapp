const fs = require('fs');
const bodyParser = require('body-parser');
const loadUserCSV = require('./loadusercsv');
const express = require('express');
const { Sequelize } = require('sequelize');
const bcrypt = require('bcrypt');
const UserModel = require('./models/UserModel.js'); 
const AssignmentModel = require('./models/AssignmentModel.js')
const app = express();
app.use(bodyParser.json());
const PORT = 8080;
const filePath = './user.csv'; 
loadUserCSV(filePath);
const dotenv = require('dotenv');


dotenv.config();

// Access environment variables
const DATABASE_URL = process.env.DATABASE_URL;
const DB_USERNAME = process.env.DB_USERNAME;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'mysql',
  username: DB_USERNAME,
  password: DB_PASSWORD,
});



async function buildDatabase() {
  try {
    await sequelize.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME};`);
    console.log('Database built successfully.');
  } catch (error) {
    console.error('Error building database:', error);
  }
}

buildDatabase().then(() => {
  // Now, you can attempt to authenticate and start the application
  checkDatabaseConnection().then(start);
});


async function checkDatabaseConnection() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
     // Exit the application if the database connection fails
  }
}

// Middleware to reject requests with a request body
const rejectBody = (req, res, next) => {
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength) > 0) {
    return res.status(400).json({ error: 'Request body is not allowed for this endpoint' });
  }

  if (Object.keys(req.query).length > 0) {
    return res.status(400).json({ error: 'Query parameters are not allowed for this endpoint' });
  }

  next();
};

async function addOrEditUser(user) {
  try {
    const existingUser = await UserModel.findOne({ where: { email: user.email } });

    if (existingUser) {
      console.log(`User with email ${user.email} already exists.`);
    } else {
      // Hash the user's password before storing it
      const BcryptedPassword = await BcryptPassword(user.password);

      // Create a new user record with the hashed password
      await UserModel.create({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        password: BcryptedPassword, // Store the hashed password
      });
      console.log(`User with email ${user.email} inserted.`);
    }
  } catch (error) {
    console.error('Error adding/editing user:', error.message);
  }
}

async function BcryptPassword(password) {
  // Use BCrypt to hash the password
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

async function start() {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const rows = fileContent.trim().split('\n');
    const headers = rows.shift().split(',');

    const users = rows.map((row) => {
      const values = row.split(',');
      const user = {};
      headers.forEach((header, index) => {
        user[header] = values[index].trim();
      });
      return user;
    });

    //console.log('Data loaded from CSV:', users);

    await UserModel.sync();
    console.log('User model synchronized with the database.');

    // Synchronize the AssignmentModel with the database
    await AssignmentModel.sync();
    console.log('Assignment model synchronized with the database.');

    for (const user of users) {
      if (!user.email || !user.password) {
        console.error('Invalid user data:', user);
        continue;
      }
      await addOrEditUser(user);
    }

    const fetchedUsers = await UserModel.findAll();
    fetchedUsers.forEach((user) => {
      console.log(`User ID: ${user.id}, First Name: ${user.first_name}, Last Name: ${user.last_name}, Email: ${user.email}`);
    });
  } catch (error) {
    console.error('Error loading and creating user accounts:', error.message);
  }
}

app.use(express.json());
     




app.route('/healthz')
  .get(rejectBody, async (req, res) => {
    try {
      if (req.method === 'GET') {
        if (req.body && Object.keys(req.body).length > 0) {
          // Reject the request with a 400 Bad Request status code
          res.status(400).send('GET requests should not include a request body');
        } else {
          // Handle GET request

          // Assuming you want to check if the database connection is successful
          await sequelize.authenticate();

          res.setHeader('Cache-Control', 'no-cache');
          res.status(200).send()
        }
      } else {
        res.status(405).json({ error: 'Method Not Allowed' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  })
  .all((req, res) => {
    res.status(405).json({ error: 'Method Not Allowed' });
  });




// Call the checkDatabaseConnection and start functions when your application starts
checkDatabaseConnection().then(start);

async function BcryptPassword(password) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}


// Middleware for basic authentication
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const encodedCredentials = authHeader.split(' ')[1];
  const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
  const [providedEmail, providedPassword] = decodedCredentials.split(':');

  if (!providedEmail || !providedPassword) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const user = await UserModel.findOne({ where: { email: providedEmail } });

    if (!user || !(await bcrypt.compare(providedPassword, user.password))) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Attach the user object to the request for later use, e.g., req.user
    req.user = user;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};



app.use(express.json());


// Create Assignment
app.post('/assignments', authenticate, async (req, res) => {
  try {
    // Specify the fields you want to accept
    const allowedFields = ['name', 'points', 'num_of_attempts', 'deadline'];

    // Extract only the allowed fields from the request body
    const assignmentData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) { // Check for the field's presence in the request body
        assignmentData[field] = req.body[field];

        // Additional validation for specific fields
        if (field === 'name' && typeof assignmentData.name !== 'string') {
          return res.status(400).json({ error: 'Invalid data type for name field' });
        }
        if (field === 'points' && (typeof assignmentData.points !== 'number' || assignmentData.points < 1 || assignmentData.points > 10)) {
          return res.status(400).json({ error: 'Invalid data for points field; it must be a number between 1 and 10' });
        }
      }
    }
    // Check for extra fields in the request body
    for (const field in req.body) {
      if (!allowedFields.includes(field)) {
        return res.status(400).json({ error: `Invalid field: ${field}` });
      }
    }

    // Ensure all required fields are present
    if (
      !assignmentData.name ||
      !assignmentData.points ||
      !assignmentData.num_of_attempts ||
      !assignmentData.deadline
    ) {
      return res.status(400).json({ error: 'All assignment fields are required' });
    }

    // Get the authenticated user's email from the request
    const authHeader = req.headers.authorization;
    const encodedCredentials = authHeader.split(' ')[1];
    const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
    const [providedEmail] = decodedCredentials.split(':');

    // Find the user in the database based on the provided email
    const user = await UserModel.findOne({ where: { email: providedEmail } });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Associate the assignment with the authenticated user
    assignmentData.user_id = user.id;

    const createdAssignment = await AssignmentModel.create(assignmentData);

    res.status(201).json(createdAssignment);
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get all Assignments of a user by authentication
app.get('/assignments',rejectBody, authenticate, async (req, res) => {
  try {
    // Use the authenticated user from the middleware
    const authenticatedUser = req.user;

    // Find all assignments associated with the authenticated user's id
    const userAssignments = await AssignmentModel.findAll({
      where: { user_id: authenticatedUser.id },
    });

    if (!userAssignments) {
      return res.status(404).json({ error: 'Assignments not found for this user' });
    }

    res.status(200).json(userAssignments);
  } catch (error) {
    console.error('Error getting assignments for user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Delete Assignment by ID
app.delete('/assignments/:id',rejectBody, authenticate, async (req, res) => {
  try {
    const assignmentId = req.params.id;

    // Find the assignment by ID
    const assignment = await AssignmentModel.findByPk(assignmentId);

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check if the authenticated user is the assignment owner
    if (assignment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Permission denied. You can only delete your own assignments.' });
    }

    // Delete the assignment
    await assignment.destroy();

    res.status(200).json({ message: 'Assignment successfully deleted' }); // Send success message
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.patch('/assignments/:id', (req, res) => {
  res.status(405).json({ error: 'Update (PATCH) is not allowed' });
});



// Get Assignment by ID
app.get('/assignments/:assignmentId', rejectBody, authenticate, async (req, res) => {
  try {
    const assignmentId = req.params.assignmentId;

    // Find the assignment by ID
    const assignment = await AssignmentModel.findByPk(assignmentId);

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check if the authenticated user is the assignment owner
    if (assignment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Permission denied. You can only access your own assignments.' });
    }

    res.status(200).json(assignment);
  } catch (error) {
    console.error('Error getting assignment by ID:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});




// Update Assignment by ID (Authenticated Users Only)
app.put('/assignments/:id', async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const updatedAssignmentData = req.body;

    const assignment = await AssignmentModel.findByPk(assignmentId);

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Validate and update each field
    if ('name' in updatedAssignmentData && updatedAssignmentData.name !== null) {
      assignment.name = updatedAssignmentData.name;
    } else {
      return res.status(400).json({ error: 'name is required and cannot be null.' });
    }

    if ('points' in updatedAssignmentData && updatedAssignmentData.points !== null) {
      const points = parseInt(updatedAssignmentData.points, 10);
      if (!isNaN(points) && points >= 1 && points <= 10) {
        assignment.points = points;
      } else {
        return res.status(400).json({ error: 'Invalid value for points. It must be an integer between 1 and 10.' });
      }
    } else {
      return res.status(400).json({ error: 'points is required and cannot be null.' });
    }

    if ('num_of_attempts' in updatedAssignmentData && updatedAssignmentData.num_of_attempts !== null) {
      const num_of_attempts = parseInt(updatedAssignmentData.num_of_attempts, 10);
      if (!isNaN(num_of_attempts) && num_of_attempts >= 1) {
        assignment.num_of_attempts = num_of_attempts;
      } else {
        return res.status(400).json({ error: 'Invalid value for num_of_attempts. It must be an integer greater than or equal to 1.' });
      }
    } else {
      return res.status(400).json({ error: 'num_of_attempts is required and cannot be null.' });
    }

    if ('deadline' in updatedAssignmentData && updatedAssignmentData.deadline !== null) {
      assignment.deadline = updatedAssignmentData.deadline;
    } else {
      return res.status(400).json({ error: 'deadline is required and cannot be null.' });
    }

    // Update the assignment_updated field
    assignment.assignment_updated = new Date();

    // Save the updated assignment
    await assignment.save();

    res.status(204).json('');
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



checkDatabaseConnection().then(() => {
  app.listen(PORT, () => {
    console.log('Server running on ' + PORT);
  });
});



module.exports = app;






