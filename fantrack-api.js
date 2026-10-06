(function (root) {
    "use strict";

    class FantrackApiError extends Error {
        constructor(message, code, status) {
            super(message);
            this.name = "FantrackApiError";
            this.code = code;
            this.status = status;
        }
    }

    function isRecord(value) {
        return value !== null &&
            typeof value === "object" &&
            !Array.isArray(value);
    }

    function hasExactKeys(value, expectedKeys) {
        return isRecord(value) &&
            Object.keys(value).length === expectedKeys.length &&
            expectedKeys.every((key) =>
                Object.prototype.hasOwnProperty.call(value, key)
            );
    }

    function apiErrorForStatus(status) {
        const errors = {
            401: ["UNAUTHORIZED", "Authentication is required."],
            404: ["NOT_FOUND", "The requested FANTRACK resource was not found."],
            405: ["METHOD_NOT_ALLOWED", "That action is not supported by the FANTRACK API."],
            503: ["SERVICE_UNAVAILABLE", "FANTRACK is temporarily unavailable. Please try again."]
        };
        const [code, message] = errors[status] || [
            "HTTP_ERROR",
            `FANTRACK API request failed (HTTP ${status}).`
        ];
        return new FantrackApiError(message, code, status);
    }

    async function requestData(path, method) {
        let response;
        try {
            response = await root.fetch(path, {
                method,
                credentials: "same-origin",
                headers: { Accept: "application/json" }
            });
        } catch {
            throw new FantrackApiError(
                "Unable to reach FANTRACK. Check your connection and try again.",
                "NETWORK_ERROR"
            );
        }

        let payload;
        try {
            payload = await response.json();
        } catch {
            throw new FantrackApiError(
                "FANTRACK API returned invalid JSON.",
                "INVALID_JSON",
                response.status
            );
        }

        if (!isRecord(payload)) {
            throw new FantrackApiError(
                "FANTRACK API returned an invalid response.",
                "INVALID_ENVELOPE",
                response.status
            );
        }

        if (!response.ok) {
            if (
                payload.success !== false ||
                !Object.prototype.hasOwnProperty.call(payload, "error") ||
                !(typeof payload.error === "string" ||
                    (isRecord(payload.error) && Object.keys(payload.error).length > 0))
            ) {
                throw new FantrackApiError(
                    "FANTRACK API returned an invalid error response.",
                    "INVALID_ENVELOPE",
                    response.status
                );
            }
            throw apiErrorForStatus(response.status);
        }

        if (
            payload.success !== true ||
            !Object.prototype.hasOwnProperty.call(payload, "data")
        ) {
            throw new FantrackApiError(
                "FANTRACK API returned an invalid success response.",
                "INVALID_ENVELOPE",
                response.status
            );
        }
        return payload.data;
    }

    function validateArtistId(artistId) {
        if (typeof artistId !== "string" || artistId.trim() === "") {
            throw new FantrackApiError(
                "An artist ID is required.",
                "INVALID_ARGUMENT"
            );
        }
    }

    function validateUser(data) {
        if (
            !hasExactKeys(data, ["id", "email", "username"]) ||
            !Object.values(data).every(
                (value) => typeof value === "string" && value.trim() !== ""
            )
        ) {
            throw new FantrackApiError(
                "FANTRACK API returned an unexpected user identity.",
                "INVALID_DATA"
            );
        }
        return data;
    }

    function validateArtist(data) {
        if (
            !isRecord(data) ||
            !["id", "name", "type", "music"].every((key) =>
                typeof data[key] === "string" &&
                (key !== "id" || data[key].trim() !== "")
            ) ||
            Object.keys(data).some(
                (key) => !["id", "name", "type", "music", "image"].includes(key)
            ) ||
            (data.image !== undefined && typeof data.image !== "string")
        ) {
            throw new FantrackApiError(
                "FANTRACK API returned an unexpected artist.",
                "INVALID_DATA"
            );
        }
        return data;
    }

    function validateFollowStatus(data, expectedArtistId) {
        if (
            !hasExactKeys(data, ["artistId", "followed"]) ||
            data.artistId !== expectedArtistId ||
            typeof data.followed !== "boolean"
        ) {
            throw new FantrackApiError(
                "FANTRACK API returned an unexpected follow status.",
                "INVALID_DATA"
            );
        }
        return data;
    }

    function validateUpdate(data) {
        const updateTypes = ["music", "event", "award", "news", "merch"];
        if (
            !hasExactKeys(data, [
                "id",
                "artistId",
                "artistName",
                "type",
                "title",
                "description",
                "date",
                "link"
            ]) ||
            !["id", "artistId", "artistName", "title"]
                .every((key) =>
                    typeof data[key] === "string" && data[key].trim() !== ""
                ) ||
            typeof data.description !== "string" ||
            typeof data.date !== "string" ||
            typeof data.link !== "string" ||
            !updateTypes.includes(data.type)
        ) {
            throw new FantrackApiError(
                "FANTRACK API returned an unexpected update.",
                "INVALID_DATA"
            );
        }
        return data;
    }

    const api = {
        FantrackApiError,
        async getMe() {
            return validateUser(await requestData("/api/me", "GET"));
        },
        async getUpdates() {
            const updates = await requestData("/api/updates", "GET");
            if (!Array.isArray(updates)) {
                throw new FantrackApiError(
                    "FANTRACK API returned an unexpected update list.",
                    "INVALID_DATA"
                );
            }
            const validatedUpdates = updates.map(validateUpdate);
            if (new Set(validatedUpdates.map((update) => update.id)).size !==
                validatedUpdates.length) {
                throw new FantrackApiError(
                    "FANTRACK API returned duplicate updates.",
                    "INVALID_DATA"
                );
            }
            return validatedUpdates;
        },
        async getFollowedArtists() {
            const artists = await requestData("/api/me/follows", "GET");
            if (!Array.isArray(artists)) {
                throw new FantrackApiError(
                    "FANTRACK API returned an unexpected followed-artist list.",
                    "INVALID_DATA"
                );
            }
            const validatedArtists = artists.map(validateArtist);
            if (new Set(validatedArtists.map((artist) => artist.id)).size !==
                validatedArtists.length) {
                throw new FantrackApiError(
                    "FANTRACK API returned duplicate followed artists.",
                    "INVALID_DATA"
                );
            }
            return validatedArtists;
        },
        async getFollowStatus(artistId) {
            validateArtistId(artistId);
            const encodedId = encodeURIComponent(artistId);
            return validateFollowStatus(
                await requestData(`/api/me/follows/${encodedId}`, "GET"),
                artistId
            );
        },
        async followArtist(artistId) {
            validateArtistId(artistId);
            const encodedId = encodeURIComponent(artistId);
            const status = validateFollowStatus(
                await requestData(`/api/me/follows/${encodedId}`, "PUT"),
                artistId
            );
            if (!status.followed) {
                throw new FantrackApiError(
                    "FANTRACK API did not confirm the follow.",
                    "INVALID_DATA"
                );
            }
            return status;
        },
        async unfollowArtist(artistId) {
            validateArtistId(artistId);
            const encodedId = encodeURIComponent(artistId);
            const status = validateFollowStatus(
                await requestData(`/api/me/follows/${encodedId}`, "DELETE"),
                artistId
            );
            if (status.followed) {
                throw new FantrackApiError(
                    "FANTRACK API did not confirm the unfollow.",
                    "INVALID_DATA"
                );
            }
            return status;
        }
    };

    root.FantrackApi = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis);
