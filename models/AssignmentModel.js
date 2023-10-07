const { Sequelize, DataTypes } = require('sequelize');
const User = require('./UserModel'); // Import the User model

const sequelize = new Sequelize('usersdb', 'root', 'Sqlsru@19', {
  host: '127.0.0.1',
  dialect: 'mysql',
  dialectOptions: {
    createDatabaseIfNotExists: true,
  },
});

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
