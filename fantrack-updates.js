(function () {
    const artistNames = {
        "burna-boy": "Burna Boy",
        "rema": "Rema",
        "tems": "Tems",
        "drake": "Drake",
        "wizkid": "Wizkid",
        "davido": "Davido"
    };

    const artistUpdates = {
        "burna-boy": [
            {
                type: "music",
                title: "Dai Dai",
                description: "Burna Boy has new music available.",
                date: "2026",
                link: "artist.html?artist=burna-boy"
            },
            {
                type: "event",
                title: "Upcoming Event",
                description: "Burna Boy has an upcoming live event.",
                date: "December 30, 2026",
                link: "artist.html?artist=burna-boy"
            },
            {
                type: "award",
                title: "Award Update",
                description: "Burna Boy has new award information.",
                date: "2026",
                link: "artist.html?artist=burna-boy"
            },
            {
                type: "news",
                title: "Artist News",
                description: "Burna Boy has a new announcement.",
                date: "2026",
                link: "artist.html?artist=burna-boy"
            },
            {
                type: "merch",
                title: "New Merch",
                description: "Burna Boy has new merchandise available.",
                date: "2026",
                link: "artist.html?artist=burna-boy"
            }
        ],

        "rema": [
            {
                type: "music",
                title: "HEIS",
                description: "Rema's latest album.",
                date: "2024",
                link: "artist.html?artist=rema"
            }
        ],

        "tems": [
            {
                type: "music",
                title: "What You Need",
                description: "Tems has new music available.",
                date: "2026",
                link: "artist.html?artist=tems"
            }
        ],

        "drake": [
            {
                type: "music",
                title: "HABIBTI (FOMO)",
                description: "Drake has a new music update.",
                date: "2026",
                link: "artist.html?artist=drake"
            }
        ],

        "wizkid": [
            {
                type: "music",
                title: "Morayo",
                description: "Wizkid's latest album.",
                date: "2024",
                link: "artist.html?artist=wizkid"
            }
        ],

        "davido": [
            {
                type: "music",
                title: "5ive",
                description: "Davido's latest album.",
                date: "2025",
                link: "artist.html?artist=davido"
            }
        ]
    };

    const fantrackUpdates = {
        artistNames: artistNames,
        artistUpdates: artistUpdates
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = fantrackUpdates;
    } else {
        window.FantrackUpdates = fantrackUpdates;
    }
})();
