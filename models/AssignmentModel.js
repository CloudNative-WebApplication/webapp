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


const Assignment = sequelize.define('Assignment', {
  id: {
    type: DataTypes.UUID, // Change the data type to UUID
    defaultValue: () => uuidv4(), // Generate a random UUID
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  points: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 10,
    },
  },
  num_of_attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  deadline: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  assignment_created: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
    readOnly: true,
  },
  assignment_updated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
    readOnly: true,
  },
  user_id: {
    type: DataTypes.UUID, // You can also use UUID for foreign keys
    allowNull: false,
  },
}, {
  tableName: 'assignments',
  timestamps: false,
});

module.exports = Assignment;