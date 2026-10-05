"use strict";

exports.up = (pgm) => {
    pgm.createTable("sessions", {
        id: {
            type: "uuid",
            primaryKey: true,
            notNull: true,
            default: pgm.func("gen_random_uuid()")
        },
        user_id: {
            type: "uuid",
            notNull: true,
            references: "users(id)",
            onDelete: "CASCADE"
        },
        token_hash: {
            type: "text",
            notNull: true,
            unique: true,
            check: "length(trim(token_hash)) > 0"
        },
        created_at: {
            type: "timestamptz",
            notNull: true,
            default: pgm.func("now()")
        },
        expires_at: {
            type: "timestamptz",
            notNull: true
        }
    });

    pgm.addConstraint("sessions", "sessions_expiry_after_creation_check", {
        check: "expires_at > created_at"
    });

    pgm.createIndex("sessions", ["expires_at"]);
};

exports.down = (pgm) => {
    pgm.dropTable("sessions");
};
