const dotenv = require('dotenv');
dotenv.config();

const fs = require('fs');
const bodyParser = require('body-parser');
const loadUserCSV = require('./loadusercsv');
const express = require('express');
const { Sequelize } = require('sequelize');
const bcrypt = require('bcrypt');
const UserModel = require('./models/UserModel.js'); 
const AssignmentModel = require('./models/AssignmentModel.js')
const Submission = require('./models/Submission.js'); // Import Sequelize models
const AWS = require('aws-sdk');
const app = express();
app.use(bodyParser.json());
const PORT = 8080;
const filePath = './user.csv'; 
loadUserCSV(filePath);
// const morgan = require('morgan');
// const customFormat = ':method :url :status :response-time ms';
const winston = require('winston');
const StatsD = require('node-statsd');
const sns = new AWS.SNS({ apiVersion: '2010-03-31' });


const client = new StatsD({
  errorHandler: function (error) {
    console.error("StatsD error: ", error);
  }
});

// Create a logger
const logger = winston.createLogger({
  level: 'silly',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console(), // Log to console
    new winston.transports.File({ filename: 'webapp.log' }), 
  ],
});
app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  next();
});

// app.use(morgan('combined'));

// Function to check if environment variables are set
function areCredentialsAvailable() {
  return process.env.DATABASE_URL && process.env.DB_USERNAME && process.env.DB_PASSWORD && process.env.DB_NAME;
}

const checkInterval = 10000; // Check every 10 seconds

function waitForCredentials() {
const intervalId = setInterval(() => {
  if (areCredentialsAvailable()) {
    console.log('Credentials are available. Proceeding to start the application.');
    clearInterval(intervalId);
    start();
  } else {
    console.log('Waiting for credentials...');
  }
}, checkInterval);
}

waitForCredentials();

// Access environment variables
const DATABASE_URL = process.env.DATABASE_URL;
const DB_USERNAME = process.env.DB_USERNAME;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME
const SNS_ARN = process.env.SNS_ARN

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'mysql',
  username: DB_USERNAME,
  password: DB_PASSWORD,
});

UserModel.hasMany(AssignmentModel, { foreignKey: 'user_id' });
AssignmentModel.belongsTo(UserModel, { foreignKey: 'user_id' });

AssignmentModel.hasMany(Submission, { foreignKey: 'assignment_id' });
Submission.belongsTo(AssignmentModel, { foreignKey: 'assignment_id' });


async function buildDatabase() {
  try {
    await sequelize.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME};`);
    console.log('Database built successfully.');
    logger.info('Database built successfully');
  } catch (error) {
    console.error('Error building database:', error);
    logger.error(' Error building database');
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
    logger.info('Database connection has been established successfully');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    logger.error('Unable to connect to the database');
     // Exit the application if the database connection fails
  }
}

// Middleware to reject requests with a request body
const rejectBody = (req, res, next) => {
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength) > 0) {
    logger.error('Request body was not allowed');
    return res.status(400).json({ error: 'Request body is not allowed for this endpoint' });
  }

  if (Object.keys(req.query).length > 0) {
    logger.error('Query parameter was not allowed');
    return res.status(400).json({ error: 'Query parameters are not allowed for this endpoint' });
  }

  next();
};

async function addOrEditUser(user) {
  try {
    const existingUser = await UserModel.findOne({ where: { email: user.email } });

    if (existingUser) {
      console.log(`User with email ${user.email} already exists.`);
      logger.info(`User with email ${user.email} already exists.`);
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
      logger.info(`User with email ${user.email} inserted.`);
    }
  } catch (error) {
    console.error('Error adding/editing user:', error.message);
    logger.error('Error adding/editing user');
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
    logger.info('User model synchronized with the database.');

    // Synchronize the AssignmentModel with the database
    await AssignmentModel.sync();
    console.log('Assignment model synchronized with the database.');
    logger.info('Assignment model synchronized with the database.');
     
    await Submission.sync();
    for (const user of users) {
      if (!user.email || !user.password) {
        logger.error('Invalid user data');
        console.error('Invalid user data:', user);
        continue;
      }
      await addOrEditUser(user);
    }

    const fetchedUsers = await UserModel.findAll();
    fetchedUsers.forEach((user) => {
      console.log(`User ID: ${user.id}, First Name: ${user.first_name}, Last Name: ${user.last_name}, Email: ${user.email}`);
      logger.info('User found');
    });
  } catch (error) {
    console.error('Error loading and creating user accounts:', error.message);
    logger.error('Error loading and creating user accounts');
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
          logger.warn('GET request with a request body received');
        } else {
          // Handle GET request

          // Assuming you want to check if the database connection is successful
          await sequelize.authenticate();

          res.setHeader('Cache-Control', 'no-cache');
          res.status(200).send()
          logger.http('Method allowed.');
          client.increment('healthzendpoint')
        }
      } 
    } catch (error) {
      console.error(error);
      res.status(503).json({ error: 'Service Unavailable' });
      logger.error('Internal Server Error');
    }
  })
  .all((req, res) => {
    res.status(405).json({ error: 'Method Not Allowed' });
    logger.error('Method Not Allowed');

  });

// Call the checkDatabaseConnection and start functions when your application starts
checkDatabaseConnection().then(start);

async function BcryptPassword(password) {
  const saltRounds = 10;
  logger.info('Password hashed successfully');
  return bcrypt.hash(password, saltRounds);
}


// Middleware for basic authentication
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'Unauthorized' });
    logger.error('Unauthorized');
    return;
  }

  const encodedCredentials = authHeader.split(' ')[1];
  const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
  const [providedEmail, providedPassword] = decodedCredentials.split(':');

  if (!providedEmail || !providedPassword) {
    res.status(401).json({ error: 'Unauthorized' });
    logger.error('Unauthorized');
    return;
  }

  try {
    const user = await UserModel.findOne({ where: { email: providedEmail } });

    if (!user || !(await bcrypt.compare(providedPassword, user.password))) {
      res.status(401).json({ error: 'Unauthorized' });
      logger.error('Unauthorized');
      return;
    }

    // Attach the user object to the request for later use, e.g., req.user
    req.user = user;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    logger.error('Authentication error');
    res.status(503).json({ error: 'Service Unavailable' });
  }
};



app.use(express.json());


// Create Assignment
app.post('/v1/assignments', authenticate, async (req, res) => {
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
          logger.error('Invalid data type for name field');
          return res.status(400).json({ error: 'Invalid data type for name field' });
        }
        if (field === 'points' && (typeof assignmentData.points !== 'number' || assignmentData.points < 1 || assignmentData.points > 10)) {
          logger.error('Invalid data type for points field');
          return res.status(400).json({ error: 'Invalid data for points field; it must be a number between 1 and 10' });
  
        }
      }
    }
    // Check for extra fields in the request body
    for (const field in req.body) {
      if (!allowedFields.includes(field)) {
        logger.error('Invalid field');
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
      logger.error('All assignment fields are required');
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
      logger.error('User not found');
      return res.status(401).json({ error: 'User not found' });
    }

    // Associate the assignment with the authenticated user
    assignmentData.user_id = user.id;

    const createdAssignment = await AssignmentModel.create(assignmentData);

    res.status(201).json(createdAssignment);
    logger.http('Assignment created');
    client.increment('assignmentscreateendpoint')
  } catch (error) {
    console.error('Error creating assignment:', error);
    logger.error('Error creating assignment:', error);
    res.status(503).json({ error: 'Service Unavailable' });
  }
});

// Get all Assignments of a user by authentication
app.get('/v1/assignments',rejectBody, authenticate, async (req, res) => {
  try {
    // Use the authenticated user from the middleware
    const authenticatedUser = req.user;

    // Find all assignments associated with the authenticated user's id
    const userAssignments = await AssignmentModel.findAll({
      where: { user_id: authenticatedUser.id },
    });

    if (!userAssignments) {
      logger.error('Assignments not found for user');
      return res.status(404).json({ error: 'Assignments not found for this user' });
    }

    res.status(200).json(userAssignments);
    logger.http('Got Assignments');
    client.increment('assignmentsgetendpoint')
  } catch (error) {
    console.error('Error getting assignments for user:', error);
    logger.error('Error getting assignments for user');
    res.status(503).json({ error: 'Service Unavailable' });
  }
});


// Delete Assignment by ID
app.delete('/v1/assignments/:id',rejectBody, authenticate, async (req, res) => {
  try {
    const assignmentId = req.params.id;

    // Find the assignment by ID
    const assignment = await AssignmentModel.findByPk(assignmentId);

    if (!assignment) {
      logger.error('Assignment not found');
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check if the authenticated user is the assignment owner
    if (assignment.user_id !== req.user.id) {
      logger.error('Permission denied');
      return res.status(403).json({ error: 'Permission denied. You can only delete your own assignments.' });
    }

    // Delete the assignment
    await assignment.destroy();

    res.status(200).json({ message: 'Assignment successfully deleted' }); // Send success message
    logger.http('Assignment successfully deleted');
    client.increment('assignmentsdeleteendpoint')
  } catch (error) {
    console.error('Error deleting assignment:', error);
    logger.error('Error deleting assignment');
    res.status(503).json({ error: 'Service Unavailable' });
  }
});


app.patch('/v1/assignments/:id', (req, res) => {
  res.status(405).json({ error: 'Update (PATCH) is not allowed' });
  logger.error('Update (PATCH) is not allowed');
  client.increment('assignmentspatchendpoint')
});



// Get Assignment by ID
app.get('/v1/assignments/:assignmentId', rejectBody, authenticate, async (req, res) => {
  try {
    const assignmentId = req.params.assignmentId;

    // Find the assignment by ID
    const assignment = await AssignmentModel.findByPk(assignmentId);

    if (!assignment) {
      logger.error('Assignment not found');
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check if the authenticated user is the assignment owner
    if (assignment.user_id !== req.user.id) {
      logger.error('Permission denied');
      return res.status(403).json({ error: 'Permission denied. You can only access your own assignments.' });
    }

    res.status(200).json(assignment);
    logger.http('Got User Assignments');
    client.increment('assignmentsgetbyidendpoint')
  } catch (error) {
    console.error('Error getting assignment by ID:', error);
    logger.error('Error getting assignments by ID');
    res.status(503).json({ error: 'Service Unavailable' });
  }
});




// Update Assignment by ID (Authenticated Users Only)
app.put('/v1/assignments/:id', async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const updatedAssignmentData = req.body;

    const assignment = await AssignmentModel.findByPk(assignmentId);

    if (!assignment) {
      logger.error('Assignment not found');
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Validate and update each field
    if ('name' in updatedAssignmentData && updatedAssignmentData.name !== null) {
      assignment.name = updatedAssignmentData.name;
    } else {
      logger.error('Name is null');
      return res.status(400).json({ error: 'name is required and cannot be null.' });
    }

    if ('points' in updatedAssignmentData && updatedAssignmentData.points !== null) {
      const points = parseInt(updatedAssignmentData.points, 10);
      if (!isNaN(points) && points >= 1 && points <= 10) {
        assignment.points = points;
      } else {
        logger.error('Invalid value for points');
        return res.status(400).json({ error: 'Invalid value for points. It must be an integer between 1 and 10.' });
      }
    } else {
      logger.error('Points are null');
      return res.status(400).json({ error: 'points is required and cannot be null.' });
    }

    if ('num_of_attempts' in updatedAssignmentData && updatedAssignmentData.num_of_attempts !== null) {
      const num_of_attempts = parseInt(updatedAssignmentData.num_of_attempts, 10);
      if (!isNaN(num_of_attempts) && num_of_attempts >= 1) {
        assignment.num_of_attempts = num_of_attempts;
      } else {
        logger.error('Invalid value for num_of_attempts');
        return res.status(400).json({ error: 'Invalid value for num_of_attempts. It must be an integer greater than or equal to 1.' });
      }
    } else {
      logger.error('num_of_attempts value are null');
      return res.status(400).json({ error: 'num_of_attempts is required and cannot be null.' });
    }

    if ('deadline' in updatedAssignmentData && updatedAssignmentData.deadline !== null) {
      assignment.deadline = updatedAssignmentData.deadline;
    } else {
      logger.error('Deadline is null');
      return res.status(400).json({ error: 'deadline is required and cannot be null.' });
    }

    // Update the assignment_updated field
    assignment.assignment_updated = new Date();

    // Save the updated assignment
    await assignment.save();

    res.status(204).json('');
    logger.http('Assignments updated');
    client.increment('assignmentsputendpoint')
  } catch (error) {
    console.error('Error updating assignment:', error);
    logger.error('Error updating assignment');
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
const isValidUrl = (url) => {
  // Regular expression for URL validation
  const urlPattern = /^(https?:\/\/)?([\w.-]+)\.([a-zA-Z]{2,6})(\/[\w.-]*)*\/?$/;
  return urlPattern.test(url);
};

AWS.config.update({
  region: 'us-east-1',  
});

function publishToSNSTopic(message, topicArn) {
  // AWS SDK will automatically use the IAM role associated with the EC2 instance
  const sns = new AWS.SNS();

  const params = {
    Message: JSON.stringify(message),
    TopicArn: topicArn,
  };

  return sns.publish(params).promise();
}

app.post('/v1/assignments/:id/submission', authenticate, async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const { submission_url } = req.body;
    const userEmail = req.user.email; 

    // Check if submission_url exists and is a non-empty string
    if (!submission_url || typeof submission_url !== 'string' || !submission_url.trim()) {
      return res.status(400).json({ error: 'Submission URL is missing or empty' });
    }

    // Check if submission_url is a valid URL format
    if (!isValidUrl(submission_url)) {
      return res.status(400).json({ error: 'Invalid submission URL format' });
    }

    // Check if the assignment's deadline has passed
    const assignment = await AssignmentModel.findByPk(assignmentId);
    if (new Date() > new Date(assignment.deadline)) {
      return res.status(400).json({ error: 'Deadline for this assignment has passed' });
    }

    // Check for existing submissions and retry limit
    const existingSubmissions = await Submission.findAll({
      include: [{
        model: AssignmentModel,
        include: [{
          model: UserModel,
          where: { email: userEmail }
        }]
      }],
      where: { assignment_id: assignmentId }
    });

    if (existingSubmissions.length >= assignment.num_of_attempts) {
      return res.status(400).json({ error: 'Retry limit exceeded' });
    }

    // Create new submission
    const newSubmission = await Submission.create({
      assignment_id: assignmentId,
      submission_url
    });


    // Prepare the message for SNS
    const message = {
      assignmentId: assignmentId,
      submissionUrl: submission_url,
      userEmail: userEmail
    };



  
    const topicArn = SNS_ARN;

    // Publish the message to the SNS topic
    await publishToSNSTopic(message, topicArn);

    res.status(201).json(newSubmission);
  } catch (error) {
    console.error('Error:', error);
    res.status(503).json({ error: 'Service Unavailable' });
  }
});


checkDatabaseConnection().then(() => {
  app.listen(PORT, () => {
    console.log('Server running on ' + PORT);
    logger.info('Server running on ' + PORT);
  });
});



module.exports = app;


