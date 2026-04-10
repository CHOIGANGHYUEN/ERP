/**
 * User Model Schema Definition
 * Represents the structure of the sysUser table.
 * Used for documentation since we are using raw mysql2 queries.
 */
export const UserModel = {
  tableName: 'sysUser',
  fields: {
    id: {
      type: 'BIGINT',
      primaryKey: true,
      autoIncrement: true,
      description: 'Internal primary key',
    },
    userId: {
      type: 'STRING(45)',
      allowNull: false,
      unique: true,
      description: 'Google OAuth Email or Unique ID',
    },
    createdBy: {
      type: 'STRING(45)',
    },
    createdAt: {
      type: 'DATE',
    },
    changedBy: {
      type: 'STRING(45)',
    },
    changedAt: {
      type: 'DATE',
    },
  },
}
