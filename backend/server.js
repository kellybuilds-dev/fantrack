"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");
const { randomBytes, scrypt } = require("node:crypto");
const artists = require("../fantrack-artists.js");
const { artistUpdates } = require("../fantrack-updates.js");
const { query, checkConnection } = require("./db/connection.js");

const port = Number(process.env.PORT || 3000);
const scryptAsync = promisify(scrypt);
const registrationBodyLimit = 8 * 1024;
const passwordHashParameters = {
    N: 32768,
    r: 8,
    p: 1,
    keyLength: 64,
    maxmem: 64 * 1024 * 1024
};
const artistOrder = new Map(artists.map((artist, index) => [artist.id, index]));
const updateOrder = new Map(
    Object.entries(artistUpdates).flatMap(([artistId, updates]) =>
        updates.map((update, index) => [
            JSON.stringify([artistId, update.type, update.title]),
            index
        ])
    ).map(([key], index) => [key, index])
);

function createUpdateId(artistId, type, title) {
    return Buffer.from(
        JSON.stringify([artistId, type, title])
    ).toString("base64url");
}

function sendJson(response, statusCode, body, headers = {}) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        ...headers
    });
    response.end(JSON.stringify(body));
}

function sendMethodNotAllowed(response, allowedMethod) {
    sendJson(
        response,
        405,
        {
            success: false,
            error: "Method not allowed"
        },
        { Allow: allowedMethod }
    );
}

function decodeRouteId(encodedId, response) {
    try {
        return decodeURIComponent(encodedId);
    } catch {
        sendJson(response, 400, {
            success: false,
            error: "Bad request"
        });
        return null;
    }
}

function sendNotFound(response) {
    sendJson(response, 404, {
        success: false,
        error: "Not found"
    });
}

function sendServiceUnavailable(response) {
    sendJson(response, 503, {
        success: false,
        error: "Service unavailable"
    });
}

function sendInternalServerError(response) {
    sendJson(response, 500, {
        success: false,
        error: "Internal server error"
    });
}

class DatabaseQueryError extends Error {
    constructor(error) {
        super("Database query failed");
        this.name = "DatabaseQueryError";
        this.code = /^[0-9A-Z]{5}$/.test(error?.code) ? error.code : undefined;
    }
}

async function databaseQuery(text, values) {
    try {
        return await query(text, values);
    } catch (error) {
        throw new DatabaseQueryError(error);
    }
}

function sendBadRequest(response) {
    sendJson(response, 400, {
        success: false,
        error: "Bad request"
    });
}

function isJsonContentType(contentType) {
    return /^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(
        contentType || ""
    );
}

function readJsonBody(request, response) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        let tooLarge = false;

        request.on("data", (chunk) => {
            size += chunk.length;
            if (size > registrationBodyLimit) {
                tooLarge = true;
                chunks.length = 0;
                return;
            }
            if (!tooLarge) {
                chunks.push(chunk);
            }
        });

        request.on("error", reject);
        request.on("end", () => {
            if (tooLarge) {
                sendJson(response, 413, {
                    success: false,
                    error: "Request body too large"
                });
                resolve(undefined);
                return;
            }

            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            } catch {
                sendBadRequest(response);
                resolve(undefined);
            }
        });
    });
}

function normalizeRegistrationInput(body) {
    if (
        body === null ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        Object.keys(body).length !== 3 ||
        !Object.hasOwn(body, "email") ||
        !Object.hasOwn(body, "username") ||
        !Object.hasOwn(body, "password") ||
        typeof body.email !== "string" ||
        typeof body.username !== "string" ||
        typeof body.password !== "string"
    ) {
        return null;
    }

    const email = body.email.trim().toLowerCase();
    const username = body.username.trim().toLowerCase();
    const passwordLength = Array.from(body.password).length;
    const [localPart, domain] = email.split("@");
    const validEmail =
        email.length <= 254 &&
        localPart?.length <= 64 &&
        /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart || "") &&
        !localPart?.startsWith(".") &&
        !localPart?.endsWith(".") &&
        !localPart?.includes("..") &&
        /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
            domain || ""
        );

    if (
        !validEmail ||
        !/^[a-z0-9_]{3,30}$/.test(username) ||
        passwordLength < 12 ||
        passwordLength > 128
    ) {
        return null;
    }

    return { email, username, password: body.password };
}

async function hashPassword(password) {
    const salt = randomBytes(16);
    const derivedKey = await scryptAsync(
        password,
        salt,
        passwordHashParameters.keyLength,
        {
            N: passwordHashParameters.N,
            r: passwordHashParameters.r,
            p: passwordHashParameters.p,
            maxmem: passwordHashParameters.maxmem
        }
    );
    return [
        "scrypt",
        "v=1",
        `N=${passwordHashParameters.N}`,
        `r=${passwordHashParameters.r}`,
        `p=${passwordHashParameters.p}`,
        salt.toString("base64url"),
        Buffer.from(derivedKey).toString("base64url")
    ].join("$");
}

async function registerUser(input) {
    const passwordHash = await hashPassword(input.password);
    try {
        const result = await databaseQuery(
            `INSERT INTO users (email, username, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, email, username, created_at AS "createdAt"`,
            [input.email, input.username, passwordHash]
        );
        return result.rows[0];
    } catch (error) {
        if (error instanceof DatabaseQueryError && error.code === "23505") {
            return null;
        }
        throw error;
    }
}

function mapArtist(row) {
    const artist = {
        id: row.id,
        name: row.name,
        type: row.type,
        music: row.music
    };
    if (row.image !== null) {
        artist.image = row.image;
    }
    return artist;
}

function parsePublicUpdateId(id) {
    try {
        const identity = JSON.parse(
            Buffer.from(id, "base64url").toString("utf8")
        );
        if (
            !Array.isArray(identity) ||
            identity.length !== 3 ||
            identity.some((value) => typeof value !== "string") ||
            createUpdateId(...identity) !== id
        ) {
            return null;
        }
        return identity;
    } catch {
        return null;
    }
}

function compareArtists(left, right) {
    const leftOrder = artistOrder.get(left.id);
    const rightOrder = artistOrder.get(right.id);
    if (leftOrder !== undefined && rightOrder !== undefined) {
        return leftOrder - rightOrder;
    }
    if (leftOrder !== undefined) {
        return -1;
    }
    if (rightOrder !== undefined) {
        return 1;
    }
    return left.id.localeCompare(right.id);
}

function compareUpdates(left, right) {
    const leftKey = JSON.stringify([left.artistId, left.type, left.title]);
    const rightKey = JSON.stringify([right.artistId, right.type, right.title]);
    const leftOrder = updateOrder.get(leftKey);
    const rightOrder = updateOrder.get(rightKey);
    if (leftOrder !== undefined && rightOrder !== undefined) {
        return leftOrder - rightOrder;
    }
    if (leftOrder !== undefined) {
        return -1;
    }
    if (rightOrder !== undefined) {
        return 1;
    }
    return leftKey.localeCompare(rightKey);
}

function mapUpdate(row) {
    return {
        id: createUpdateId(row.artistId, row.type, row.title),
        artistId: row.artistId,
        artistName: row.artistName,
        type: row.type,
        title: row.title,
        description: row.description,
        date: row.date,
        link: row.link
    };
}

async function getArtists() {
    const result = await databaseQuery(
        "SELECT id, name, type, music, image FROM artists"
    );
    return result.rows.map(mapArtist).sort(compareArtists);
}

async function getArtist(id) {
    const result = await databaseQuery(
        "SELECT id, name, type, music, image FROM artists WHERE id = $1",
        [id]
    );
    return result.rows[0] ? mapArtist(result.rows[0]) : null;
}

async function getUpdates() {
    const result = await databaseQuery(
        `SELECT u.artist_id AS "artistId",
                a.name AS "artistName",
                u.type,
                u.title,
                u.description,
                u.date_label AS date,
                u.link
         FROM artist_updates AS u
         JOIN artists AS a ON a.id = u.artist_id`
    );
    return result.rows.map(mapUpdate).sort(compareUpdates);
}

async function getUpdate(identity) {
    const result = await databaseQuery(
        `SELECT u.artist_id AS "artistId",
                a.name AS "artistName",
                u.type,
                u.title,
                u.description,
                u.date_label AS date,
                u.link
         FROM artist_updates AS u
         JOIN artists AS a ON a.id = u.artist_id
         WHERE u.artist_id = $1 AND u.type = $2 AND u.title = $3`,
        identity
    );
    return result.rows[0] ? mapUpdate(result.rows[0]) : null;
}
const frontendRoot = path.join(__dirname, "..");

const frontendFiles = new Set([
    "/",
    "/index.html",
    "/artist.html",
    "/notifications.html",
    "/update.html",
    "/fantrack-state.js",
    "/fantrack-artists.js",
    "/fantrack-updates.js"
]);

const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
};

function sendStaticFile(response, pathname) {
    const requestedPath = pathname === "/" ? "/index.html" : pathname;

    const isAllowedFile =
        frontendFiles.has(requestedPath) ||
        /^\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(requestedPath);

    if (!isAllowedFile) {
        return false;
    }

    const filePath = path.join(frontendRoot, requestedPath.slice(1));

    if (!filePath.startsWith(frontendRoot + path.sep)) {
        return false;
    }

    if (!fs.existsSync(filePath)) {
        return false;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType =
        contentTypes[extension] || "application/octet-stream";

    response.writeHead(200, {
        "Content-Type": contentType
    });

    fs.createReadStream(filePath).pipe(response);

    return true;
}
async function handleRequest(request, response) {
    let requestUrl;

    try {
        requestUrl = new URL(request.url, "http://localhost");
    } catch {
        sendJson(response, 400, {
            success: false,
            error: "Bad request"
        });
        return;
    }

    if (requestUrl.pathname === "/api/auth/register") {
        if (request.method !== "POST") {
            sendMethodNotAllowed(response, "POST");
            return;
        }
        if (!isJsonContentType(request.headers["content-type"])) {
            sendJson(response, 415, {
                success: false,
                error: "Unsupported content type"
            });
            return;
        }
        const body = await readJsonBody(request, response);
        if (body === undefined) {
            return;
        }
        const input = normalizeRegistrationInput(body);
        if (!input) {
            sendBadRequest(response);
            return;
        }
        const user = await registerUser(input);
        if (!user) {
            sendJson(response, 409, {
                success: false,
                error: {
                    code: "REGISTRATION_CONFLICT",
                    message: "Unable to register with these details"
                }
            });
            return;
        }
        sendJson(response, 201, {
            success: true,
            data: user
        });
        return;
    }

    if (requestUrl.pathname === "/api/health") {
        if (request.method !== "GET") {
            sendMethodNotAllowed(response, "GET");
            return;
        }
        try {
            await checkConnection();
        } catch (error) {
            throw new DatabaseQueryError(error);
        }
        sendJson(response, 200, {
            success: true,
            service: "FANTRACK API",
            status: "ok"
        });
        return;
    }

    if (requestUrl.pathname === "/api/artists") {
        if (request.method !== "GET") {
            sendMethodNotAllowed(response, "GET");
            return;
        }
        const data = await getArtists();
        sendJson(response, 200, { success: true, data });
        return;
    }

    const artistRoute = requestUrl.pathname.match(/^\/api\/artists\/([^/]+)$/);
    if (artistRoute) {
        if (request.method !== "GET") {
            sendMethodNotAllowed(response, "GET");
            return;
        }
        const artistId = decodeRouteId(artistRoute[1], response);
        if (artistId === null) {
            return;
        }
        const artist = await getArtist(artistId);
        if (!artist) {
            sendNotFound(response);
            return;
        }
        sendJson(response, 200, {
            success: true,
            data: artist
        });
        return;
    }

    if (requestUrl.pathname === "/api/updates") {
        if (request.method !== "GET") {
            sendMethodNotAllowed(response, "GET");
            return;
        }
        const data = await getUpdates();
        sendJson(response, 200, { success: true, data });
        return;
    }

    const updateRoute = requestUrl.pathname.match(/^\/api\/updates\/([^/]+)$/);
    if (updateRoute) {
        if (request.method !== "GET") {
            sendMethodNotAllowed(response, "GET");
            return;
        }
        const encodedUpdateId = decodeRouteId(updateRoute[1], response);
        if (encodedUpdateId === null) {
            return;
        }
        const identity = parsePublicUpdateId(encodedUpdateId);
        if (!identity) {
            sendNotFound(response);
            return;
        }
        const update = await getUpdate(identity);
        if (!update) {
            sendNotFound(response);
            return;
        }
        sendJson(response, 200, {
            success: true,
            data: update
        });
        return;
    }

    if (request.method === "GET" && sendStaticFile(response, requestUrl.pathname)) {
        return;
    }

    sendNotFound(response);
}

const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
        if (error instanceof DatabaseQueryError) {
            console.error(
                "FANTRACK API database query failed:",
                error.code || "unclassified database error"
            );
            sendServiceUnavailable(response);
            return;
        }

        console.error(
            "FANTRACK API unexpected request failure:",
            error instanceof Error ? error.name : "unknown error"
        );
        sendInternalServerError(response);
    });
});

server.on("error", (error) => {
    console.error("FANTRACK API server error:", error.message);
    process.exitCode = 1;
});

server.listen(port, () => {
    console.log(`FANTRACK API listening on port ${port}`);
});

function shutdown() {
    server.close((error) => {
        if (error) {
            console.error("FANTRACK API shutdown error:", error.message);
            process.exitCode = 1;
        }
    });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
