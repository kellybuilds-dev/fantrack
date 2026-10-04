"use strict";

exports.up = (pgm) => {
    pgm.createTable("artist_updates", {
        id: {
            type: "uuid",
            primaryKey: true,
            notNull: true,
            default: pgm.func("gen_random_uuid()")
        },
        artist_id: {
            type: "text",
            notNull: true,
            references: "artists(id)",
            onDelete: "CASCADE"
        },
        type: {
            type: "text",
            notNull: true,
            check: "type IN ('music', 'event', 'award', 'news', 'merch')"
        },
        title: {
            type: "text",
            notNull: true,
            check: "length(trim(title)) > 0"
        },
        description: {
            type: "text",
            notNull: true
        },
        date_label: {
            type: "text",
            notNull: true
        },
        published_at: {
            type: "timestamptz"
        },
        link: {
            type: "text",
            notNull: true
        },
        source: {
            type: "text"
        },
        source_record_id: {
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

    pgm.createIndex("artist_updates", ["artist_id", { name: "published_at", sort: "DESC" }]);
    pgm.createIndex("artist_updates", ["type", { name: "published_at", sort: "DESC" }]);
    pgm.createIndex(
        "artist_updates",
        ["source", "source_record_id"],
        {
            name: "artist_updates_source_record_unique",
            unique: true,
            where: "source IS NOT NULL AND source_record_id IS NOT NULL"
        }
    );
};

exports.down = (pgm) => {
    pgm.dropTable("artist_updates");
};
