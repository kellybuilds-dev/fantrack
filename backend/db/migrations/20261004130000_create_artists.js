"use strict";

exports.up = (pgm) => {
    pgm.createTable("artists", {
        id: {
            type: "text",
            primaryKey: true,
            notNull: true,
            check: "length(trim(id)) > 0"
        },
        name: {
            type: "text",
            notNull: true,
            check: "length(trim(name)) > 0"
        },
        type: {
            type: "text",
            notNull: true
        },
        music: {
            type: "text",
            notNull: true,
            default: "''"
        },
        image: {
            type: "text"
        },
        created_at: {
            type: "timestamptz",
            notNull: true,
            default: pgm.func("now()")
        },
        updated_at: {
            type: "timestamptz",
            notNull: true,
            default: pgm.func("now()")
        }
    });
};

exports.down = (pgm) => {
    pgm.dropTable("artists");
};
