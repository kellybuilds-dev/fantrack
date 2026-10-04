"use strict";

const artists = require("../../../fantrack-artists.js");
const { artistUpdates } = require("../../../fantrack-updates.js");
const { pool, close } = require("../connection.js");

function normalizeImage(image) {
    return image === undefined ? null : image;
}

function canonicalUpdates() {
    return Object.entries(artistUpdates).flatMap(([artistId, records]) =>
        records.map((update) => ({
            artistId,
            type: update.type,
            title: update.title,
            description: update.description,
            dateLabel: update.date,
            link: update.link,
            source: update.source ?? null,
            sourceRecordId: update.source_record_id ?? null,
            publishedAt: update.published_at ?? null
        }))
    );
}

function requireEqual(field, actual, expected, record) {
    if (actual !== expected) {
        throw new Error(
            `Canonical ${record} conflict in ${field}: database=${JSON.stringify(actual)}, source=${JSON.stringify(expected)}`
        );
    }
}

async function importArtists(client) {
    for (const artist of artists) {
        const values = [
            artist.id,
            artist.name,
            artist.type,
            artist.music,
            normalizeImage(artist.image)
        ];
        const existing = await client.query(
            `SELECT id, name, type, music, image
             FROM artists
             WHERE id = $1
             FOR UPDATE`,
            [artist.id]
        );

        if (existing.rowCount === 0) {
            await client.query(
                `INSERT INTO artists (id, name, type, music, image)
                 VALUES ($1, $2, $3, $4, $5)`,
                values
            );
            continue;
        }

        const row = existing.rows[0];
        for (const [index, field] of ["id", "name", "type", "music", "image"].entries()) {
            requireEqual(field, row[field], values[index], `artist ${artist.id}`);
        }
    }
}

async function importUpdates(client) {
    for (const update of canonicalUpdates()) {
        const existing = await client.query(
            `SELECT id, description, date_label, link, source, source_record_id, published_at
             FROM artist_updates
             WHERE artist_id = $1 AND type = $2 AND title = $3
             FOR UPDATE`,
            [update.artistId, update.type, update.title]
        );

        if (existing.rowCount > 1) {
            throw new Error(
                `Multiple database updates match canonical identity ${update.artistId}/${update.type}/${update.title}`
            );
        }

        if (existing.rowCount === 0) {
            await client.query(
                `INSERT INTO artist_updates (
                    artist_id, type, title, description, date_label, published_at,
                    link, source, source_record_id
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    update.artistId,
                    update.type,
                    update.title,
                    update.description,
                    update.dateLabel,
                    update.publishedAt,
                    update.link,
                    update.source,
                    update.sourceRecordId
                ]
            );
            continue;
        }

        const row = existing.rows[0];
        for (const field of [
            "description",
            "date_label",
            "link",
            "source",
            "source_record_id",
            "published_at"
        ]) {
            const expectedField = {
                date_label: "dateLabel",
                source_record_id: "sourceRecordId",
                published_at: "publishedAt"
            }[field] || field;
            requireEqual(
                field,
                row[field],
                update[expectedField],
                `update ${update.artistId}/${update.type}/${update.title}`
            );
        }
    }
}

async function verifyCanonicalData(client) {
    const artistCount = await client.query("SELECT count(*)::int AS count FROM artists");
    const updateCount = await client.query("SELECT count(*)::int AS count FROM artist_updates");
    if (artistCount.rows[0].count !== artists.length) {
        throw new Error(
            `Expected exactly ${artists.length} canonical artists, found ${artistCount.rows[0].count}`
        );
    }

    const expectedUpdates = canonicalUpdates();
    if (updateCount.rows[0].count !== expectedUpdates.length) {
        throw new Error(
            `Expected exactly ${expectedUpdates.length} canonical updates, found ${updateCount.rows[0].count}`
        );
    }

    for (const artist of artists) {
        const result = await client.query(
            "SELECT id, name, type, music, image FROM artists WHERE id = $1",
            [artist.id]
        );
        if (result.rowCount !== 1) {
            throw new Error(`Expected one database artist with ID ${artist.id}`);
        }
        const row = result.rows[0];
        for (const [field, expected] of Object.entries({
            id: artist.id,
            name: artist.name,
            type: artist.type,
            music: artist.music,
            image: normalizeImage(artist.image)
        })) {
            requireEqual(field, row[field], expected, `artist ${artist.id}`);
        }
    }

    for (const update of expectedUpdates) {
        const result = await client.query(
            `SELECT artist_id, type, title, description, date_label, link,
                    source, source_record_id, published_at
             FROM artist_updates
             WHERE artist_id = $1 AND type = $2 AND title = $3`,
            [update.artistId, update.type, update.title]
        );
        if (result.rowCount !== 1) {
            throw new Error(
                `Expected exactly one database update for ${update.artistId}/${update.type}/${update.title}`
            );
        }
        const row = result.rows[0];
        for (const [field, expected] of Object.entries({
            artist_id: update.artistId,
            type: update.type,
            title: update.title,
            description: update.description,
            date_label: update.dateLabel,
            link: update.link,
            source: update.source,
            source_record_id: update.sourceRecordId,
            published_at: update.publishedAt
        })) {
            requireEqual(field, row[field], expected, `update ${update.artistId}/${update.type}/${update.title}`);
        }
    }
}

async function main() {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(78120411, 1)");
        await importArtists(client);
        await importUpdates(client);
        await verifyCanonicalData(client);
        await client.query("COMMIT");
        console.log(
            `Canonical import verified: ${artists.length} artists and ${canonicalUpdates().length} updates; no conflicting records.`
        );
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
        await close();
    }
}

main().catch((error) => {
    console.error("Canonical import failed:", error.message);
    process.exitCode = 1;
});
