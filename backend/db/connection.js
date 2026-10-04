"use strict";

const { Pool } = require("pg");

const pool = new Pool({
    ...(process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL }
        : {
            host: process.env.PGHOST || "127.0.0.1",
            port: Number(process.env.PGPORT || 5432),
            database: process.env.PGDATABASE || "fantrack",
            user: process.env.PGUSER || "fantrack",
            password: process.env.PGPASSWORD
        }),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 5,
    application_name: "fantrack"
});

pool.on("error", (error) => {
    console.error(
        "FANTRACK database pool error:",
        error.code || "unclassified database error"
    );
});

module.exports = {
    pool,
    query: (text, values) => pool.query(text, values),
    checkConnection: () => pool.query("SELECT 1"),
    close: () => pool.end()
};
