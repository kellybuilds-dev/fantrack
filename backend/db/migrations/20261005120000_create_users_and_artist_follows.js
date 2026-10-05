"use strict";

exports.up = (pgm) => {
    pgm.createTable("users", {
        id: {
            type: "uuid",
            primaryKey: true,
            notNull: true,
            default: pgm.func("gen_random_uuid()")
        },
        email: {
            type: "text",
            notNull: true,
            unique: true,
            check: "length(trim(email)) > 0"
        },
        username: {
            type: "text",
            notNull: true,
            unique: true,
            check: "length(trim(username)) > 0"
        },
        password_hash: {
            type: "text",
            notNull: true,
            check: "length(trim(password_hash)) > 0"
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

    pgm.createTable("artist_follows", {
        user_id: {
            type: "uuid",
            notNull: true,
            references: "users(id)",
            onDelete: "CASCADE"
        },
        artist_id: {
            type: "text",
            notNull: true,
            references: "artists(id)",
            onDelete: "CASCADE"
        },
        created_at: {
            type: "timestamptz",
            notNull: true,
            default: pgm.func("now()")
        }
    });

    pgm.addConstraint(
        "artist_follows",
        "artist_follows_pkey",
        {
            primaryKey: ["user_id", "artist_id"]
        }
    );

    pgm.createIndex("artist_follows", ["artist_id"]);
};

exports.down = (pgm) => {
    pgm.dropTable("artist_follows");
    pgm.dropTable("users");
};
