/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable('chats', (table) => {
        table.increments();
        table.string('author').notNullable();
        table.string('msg').notNullable();
        table.uuid('userUuid').notNullable();
        table.string('time').notNullable();
    })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('chats');
};
