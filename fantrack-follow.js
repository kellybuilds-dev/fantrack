(function (root) {
    "use strict";

    let mode = "uninitialized";
    let initializationPromise = null;
    let initializationError = null;
    let followedArtistIds = new Set();
    const pendingMutations = new Map();

    function unavailable(message, code) {
        const error = new Error(message);
        error.name = "FantrackFollowError";
        error.code = code;
        return error;
    }

    function requireReady() {
        if (mode === "unavailable" && initializationError) {
            throw initializationError;
        }
        if (mode !== "anonymous" && mode !== "authenticated") {
            throw unavailable(
                "Follow state has not finished initializing.",
                "NOT_INITIALIZED"
            );
        }
    }

    function initialize() {
        if (mode === "anonymous" || mode === "authenticated") {
            return Promise.resolve(mode);
        }
        if (initializationPromise) {
            return initializationPromise;
        }

        mode = "initializing";
        initializationError = null;
        const pending = (async () => {
            try {
                await root.FantrackApi.getMe();
            } catch (error) {
                if (error.status === 401) {
                    mode = "anonymous";
                    return mode;
                }
                mode = "unavailable";
                initializationError = error;
                throw error;
            }

            try {
                const artists = await root.FantrackApi.getFollowedArtists();
                followedArtistIds = new Set(artists.map((artist) => artist.id));
                mode = "authenticated";
                return mode;
            } catch (error) {
                followedArtistIds = new Set();
                mode = "unavailable";
                initializationError = error;
                throw error;
            }
        })();
        initializationPromise = pending;
        pending.then(
            () => {
                if (initializationPromise === pending) {
                    initializationPromise = null;
                }
            },
            () => {
                if (initializationPromise === pending) {
                    initializationPromise = null;
                }
            }
        );
        return pending;
    }

    function isAuthenticated() {
        return mode === "authenticated";
    }

    function getMode() {
        return mode;
    }

    function isFollowing(artistId) {
        requireReady();
        if (mode === "anonymous") {
            return root.FantrackState.isFollowing(artistId);
        }
        return followedArtistIds.has(artistId);
    }

    function getFollowedArtistIds(artists) {
        requireReady();
        if (mode === "anonymous") {
            if (!Array.isArray(artists)) {
                throw new TypeError(
                    "An artist list is required to read anonymous follows."
                );
            }
            return root.FantrackState.getFollowedArtists(artists)
                .map((artist) => artist.id);
        }
        return Array.from(followedArtistIds);
    }

    function mutate(artistId, shouldFollow) {
        requireReady();
        if (mode === "anonymous") {
            return root.FantrackState.setFollowing(artistId, shouldFollow);
        }
        if (typeof artistId !== "string" || artistId.trim() === "") {
            return Promise.reject(unavailable(
                "An artist ID is required.",
                "INVALID_ARGUMENT"
            ));
        }

        const previous = pendingMutations.get(artistId) || Promise.resolve();
        const operation = previous.catch(() => {}).then(async () => {
            const response = shouldFollow
                ? await root.FantrackApi.followArtist(artistId)
                : await root.FantrackApi.unfollowArtist(artistId);
            if (
                response.artistId !== artistId ||
                response.followed !== shouldFollow
            ) {
                throw unavailable(
                    "FANTRACK API returned an unexpected follow status.",
                    "INVALID_DATA"
                );
            }
            if (shouldFollow) {
                followedArtistIds.add(artistId);
            } else {
                followedArtistIds.delete(artistId);
            }
            return shouldFollow;
        });
        pendingMutations.set(artistId, operation);
        operation.then(
            () => {
                if (pendingMutations.get(artistId) === operation) {
                    pendingMutations.delete(artistId);
                }
            },
            () => {
                if (pendingMutations.get(artistId) === operation) {
                    pendingMutations.delete(artistId);
                }
            }
        );
        return operation;
    }

    root.FantrackFollow = Object.freeze({
        initialize,
        getMode,
        isAuthenticated,
        isFollowing,
        getFollowedArtistIds,
        follow(artistId) {
            return mutate(artistId, true);
        },
        unfollow(artistId) {
            return mutate(artistId, false);
        }
    });
})(typeof window !== "undefined" ? window : globalThis);
