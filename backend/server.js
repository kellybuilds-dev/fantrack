"use strict";

const http = require("node:http");
const artists = require("../fantrack-artists.js");
const { artistUpdates } = require("../fantrack-updates.js");

const port = Number(process.env.PORT || 3000);
const artistsById = new Map(artists.map((artist) => [artist.id, artist]));

function createUpdateId(artistId, update) {
    return Buffer.from(
        JSON.stringify([artistId, update.type, update.title])
    ).toString("base64url");
}

const updates = Object.entries(artistUpdates).flatMap(
    ([artistId, artistRecords]) => artistRecords.map((update) => ({
        id: createUpdateId(artistId, update),
        artistId,
        artistName: artistsById.get(artistId).name,
        type: update.type,
        title: update.title,
        description: update.description,
        date: update.date,
        link: update.link
    }))
);
const updatesById = new Map(updates.map((update) => [update.id, update]));

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

const server = http.createServer((request, response) => {
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

    if (requestUrl.pathname === "/api/health") {
        if (request.method !== "GET") {
            sendMethodNotAllowed(response, "GET");
            return;
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
        sendJson(response, 200, {
            success: true,
            data: artists
        });
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
        const artist = artistsById.get(artistId);
        if (!artist) {
            sendJson(response, 404, {
                success: false,
                error: "Not found"
            });
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
        sendJson(response, 200, {
            success: true,
            data: updates
        });
        return;
    }

    const updateRoute = requestUrl.pathname.match(/^\/api\/updates\/([^/]+)$/);
    if (updateRoute) {
        if (request.method !== "GET") {
            sendMethodNotAllowed(response, "GET");
            return;
        }
        const updateId = decodeRouteId(updateRoute[1], response);
        if (updateId === null) {
            return;
        }
        const update = updatesById.get(updateId);
        if (!update) {
            sendJson(response, 404, {
                success: false,
                error: "Not found"
            });
            return;
        }
        sendJson(response, 200, {
            success: true,
            data: update
        });
        return;
    }

    sendJson(response, 404, {
        success: false,
        error: "Not found"
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
