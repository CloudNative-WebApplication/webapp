const { Sequelize, DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid'); // Import the UUID library
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DB_USERNAME = process.env.DB_USERNAME;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_HOST = process.env.DB_HOST;
const DB_NAME = process.env.DB_NAME
console.log(DB_NAME+"heress")

const sequelize = new Sequelize(DB_NAME,DB_USERNAME,DB_PASSWORD, {
    dialect: 'mysql',
    host: DB_HOST,
});

const Submission = sequelize.define('Submission', {
  id: {
    type: DataTypes.UUID, // Change the data type to UUID
    defaultValue: () => uuidv4(), // Generate a random UUID
    primaryKey: true,
  },
  assignment_id: {
    type: DataTypes.UUID, // Assuming the assignment_id is also a UUID
    allowNull: false,
  },
  submission_url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  submission_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
  submission_updated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
}, {
  tableName: 'submissions',
  timestamps: false,
});

module.exports = Submission;