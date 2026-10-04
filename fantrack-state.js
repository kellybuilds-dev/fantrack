// Shared state helpers for follows, alerts, notifications, and demo follower counts.
// The existing localStorage keys are kept so previously saved FANTRACK data still works.
(function () {
    const ALERT_TYPES = ["music", "event", "award", "news", "merch"];
    const fallbackStorage = {};
    let storageWarningShown = false;

    function warnAboutStorage(error) {
        if (!storageWarningShown) {
            console.warn(
                "FANTRACK could not access localStorage; changes will only last until this page is closed.",
                error
            );
            storageWarningShown = true;
        }
    }

    function getItem(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (error) {
            warnAboutStorage(error);
            return Object.prototype.hasOwnProperty.call(fallbackStorage, key)
                ? fallbackStorage[key]
                : null;
        }
    }

    function setItem(key, value) {
        const stringValue = String(value);

        try {
            window.localStorage.setItem(key, stringValue);
        } catch (error) {
            warnAboutStorage(error);
            fallbackStorage[key] = stringValue;
        }
    }

    function removeItem(key) {
        try {
            window.localStorage.removeItem(key);
        } catch (error) {
            warnAboutStorage(error);
            delete fallbackStorage[key];
        }
    }

    function isValidId(value) {
        return typeof value === "string" && value.trim() !== "";
    }

    function isFollowing(artistId) {
        return isValidId(artistId) &&
            getItem("followed_" + artistId) === "true";
    }

    function readFollowerCount(artistId, defaultValue) {
        const savedCount = getItem("followers_" + artistId);

        if (savedCount !== null && /^\d+$/.test(savedCount)) {
            const count = Number(savedCount);
            if (Number.isSafeInteger(count)) {
                return count;
            }
        }

        return defaultValue;
    }

    function getFollowerCount(artistId) {
        if (!isValidId(artistId)) {
            return 0;
        }

        const count = readFollowerCount(artistId, isFollowing(artistId) ? 1 : 0);
        setItem("followers_" + artistId, count);
        return count;
    }

    function setFollowing(artistId, shouldFollow) {
        if (!isValidId(artistId)) {
            return false;
        }

        const wasFollowing = isFollowing(artistId);
        let followerCount = readFollowerCount(
            artistId,
            wasFollowing ? 1 : 0
        );

        // Adjust the count only when the saved follow state actually changes.
        if (wasFollowing !== Boolean(shouldFollow)) {
            followerCount += shouldFollow ? 1 : -1;
        }

        if (shouldFollow) {
            setItem("followed_" + artistId, "true");
        } else {
            removeItem("followed_" + artistId);
        }

        setItem("followers_" + artistId, Math.max(0, followerCount));
        return Boolean(shouldFollow);
    }

    function getFollowedArtists(artists) {
        return artists.filter(function (artist) {
            return isFollowing(artist.id);
        });
    }

    function areAlertsEnabled(artistId) {
        return isValidId(artistId) &&
            getItem("alerts_" + artistId) === "true";
    }

    function setAlertsEnabled(artistId, enabled) {
        if (!isValidId(artistId)) {
            return false;
        }

        if (enabled) {
            setItem("alerts_" + artistId, "true");
        } else {
            removeItem("alerts_" + artistId);
        }
        return Boolean(enabled);
    }

    function isAlertPreferenceEnabled(artistId, alertType) {
        return isValidId(artistId) &&
            ALERT_TYPES.indexOf(alertType) !== -1 &&
            getItem("alert_" + alertType + "_" + artistId) === "true";
    }

    function setAlertPreference(artistId, alertType, enabled) {
        if (!isValidId(artistId) || ALERT_TYPES.indexOf(alertType) === -1) {
            return false;
        }

        const key = "alert_" + alertType + "_" + artistId;
        if (enabled) {
            setItem(key, "true");
        } else {
            removeItem(key);
        }
        return Boolean(enabled);
    }

    function isAlertEnabled(artistId, alertType) {
        return areAlertsEnabled(artistId) &&
            isAlertPreferenceEnabled(artistId, alertType);
    }

    function notificationReadKey(artistId, alertType, title) {
        return "read_" + artistId + "_" + alertType + "_" + title;
    }

    function isNotificationRead(artistId, alertType, title) {
        return getItem(notificationReadKey(artistId, alertType, title)) === "true";
    }

    function markNotificationRead(artistId, alertType, title) {
        if (!isValidId(artistId) ||
            ALERT_TYPES.indexOf(alertType) === -1 ||
            typeof title !== "string") {
            return;
        }

        setItem(notificationReadKey(artistId, alertType, title), "true");
    }

    function getNotifications(artists, artistUpdates) {
        const notifications = [];
        const followedArtists = getFollowedArtists(artists);

        followedArtists.forEach(function (artist) {
            const updates = artistUpdates[artist.id] || [];

            updates.forEach(function (update) {
                if (!isAlertEnabled(artist.id, update.type)) {
                    return;
                }

                notifications.push({
                    artist: artist,
                    update: update,
                    isRead: isNotificationRead(
                        artist.id,
                        update.type,
                        update.title
                    )
                });
            });
        });

        return notifications;
    }

    function getUnreadCount(artists, artistUpdates) {
        return getNotifications(artists, artistUpdates).filter(function (item) {
            return !item.isRead;
        }).length;
    }

    function markAllNotificationsRead(artists, artistUpdates) {
        getNotifications(artists, artistUpdates).forEach(function (item) {
            markNotificationRead(
                item.artist.id,
                item.update.type,
                item.update.title
            );
        });
    }

    window.FantrackState = {
        isFollowing: isFollowing,
        setFollowing: setFollowing,
        getFollowedArtists: getFollowedArtists,
        getFollowerCount: getFollowerCount,
        areAlertsEnabled: areAlertsEnabled,
        setAlertsEnabled: setAlertsEnabled,
        isAlertPreferenceEnabled: isAlertPreferenceEnabled,
        setAlertPreference: setAlertPreference,
        isAlertEnabled: isAlertEnabled,
        isNotificationRead: isNotificationRead,
        markNotificationRead: markNotificationRead,
        getNotifications: getNotifications,
        getUnreadCount: getUnreadCount,
        markAllNotificationsRead: markAllNotificationsRead
    };
})();
