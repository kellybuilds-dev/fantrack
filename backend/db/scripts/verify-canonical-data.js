"use strict";

const assert = require("node:assert/strict");
const artists = require("../../../fantrack-artists.js");
const { artistUpdates } = require("../../../fantrack-updates.js");
const { pool, close } = require("../connection.js");

async function main() {
    try {
        const artistCount = await pool.query("SELECT count(*)::int AS count FROM artists");
        const updateCount = await pool.query("SELECT count(*)::int AS count FROM artist_updates");
        assert.equal(artistCount.rows[0].count, artists.length, "artist row count");

        const expectedUpdates = Object.entries(artistUpdates).flatMap(
            ([artistId, records]) => records.map((update) => ({ artistId, update }))
        );
        assert.equal(updateCount.rows[0].count, expectedUpdates.length, "update row count");

        for (const artist of artists) {
            const result = await pool.query(
                "SELECT id, name, type, music, image FROM artists WHERE id = $1",
                [artist.id]
            );
            assert.equal(result.rowCount, 1, `artist ${artist.id} exists exactly once`);
            assert.deepEqual(
                result.rows[0],
                {
                    id: artist.id,
                    name: artist.name,
                    type: artist.type,
                    music: artist.music,
                    image: artist.image ?? null
                },
                `artist ${artist.id} matches canonical fields`
            );
        }

        for (const { artistId, update } of expectedUpdates) {
            const result = await pool.query(
                `SELECT artist_id, type, title, description, date_label, link, source
                 FROM artist_updates
                 WHERE artist_id = $1 AND type = $2 AND title = $3`,
                [artistId, update.type, update.title]
            );
            assert.equal(result.rowCount, 1, `update ${artistId}/${update.title} exists exactly once`);
            assert.deepEqual(
                result.rows[0],
                {
                    artist_id: artistId,
                    type: update.type,
                    title: update.title,
                    description: update.description,
                    date_label: update.date,
                    link: update.link,
                    source: update.source ?? null
                },
                `update ${artistId}/${update.title} matches canonical fields`
            );
        }

        console.log(
            `Canonical data verified: ${artists.length} artists and ${expectedUpdates.length} updates.`
        );
    } finally {
        await close();
    }
}

main().catch((error) => {
    console.error("Canonical data verification failed:", error.message);
    process.exitCode = 1;
});
