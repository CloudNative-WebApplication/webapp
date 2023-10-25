const { Sequelize, DataTypes } = require('sequelize');
const User = require('./UserModel'); // Import the User model
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DB_USERNAME = process.env.DB_USERNAME;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_HOST = process.env.DB_HOST;
const DB_NAME = process.env.DB_NAME


const sequelize = new Sequelize(DB_NAME,DB_USERNAME,DB_PASSWORD, {
  dialect: 'mysql',
  host: DB_HOST,
});

//ko

const Assignment = sequelize.define('Assignment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
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
  user_id: { // Add this column for the user who created the assignment
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'assignments',
  timestamps: false,
});

Assignment.belongsTo(User, { foreignKey: 'user_id' });


module.exports = Assignment;
