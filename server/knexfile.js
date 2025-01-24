// Update with your config settings.
const path = require('path')
require('dotenv').config({path: path.resolve(__dirname, '../.env')})
/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {

  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB
  },
    migrations: {
      directory: __dirname + '/database/migrations'
    }
  },
};
