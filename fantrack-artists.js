(function (root) {
    const artists = [
        {
            id: "burna-boy",
            name: "Burna Boy",
            type: "Afrobeats • Nigeria",
            music: "Dai Dai",
            image: "burna-boy.jpg"
        },
        {
            id: "rema",
            name: "Rema",
            type: "Afrobeats • Nigeria",
            music: "HEIS",
            image: "rema.jpg"
        },
        {
            id: "tems",
            name: "Tems",
            type: "R&B • Nigeria",
            music: "What You Need",
            image: "tems.jpg"
        },
        {
            id: "drake",
            name: "Drake",
            type: "Hip-Hop • Canada",
            music: "HABIBTI (FOMO)",
            image: "drake.jpg"
        },
        {
            id: "wizkid",
            name: "Wizkid",
            type: "Afrobeats • Nigeria",
            music: "Morayo",
            image: "wizkid.jpg"
        },
        {
            id: "davido",
            name: "Davido",
            type: "Afrobeats • Nigeria",
            music: "5ive",
            image: "davido.jpg"
        },
        {
            id: "asake",
            name: "Asake",
            type: "Afrobeats • Nigeria",
            music: ""
        },
        {
            id: "ayra-starr",
            name: "Ayra Starr",
            type: "Afrobeats • Nigeria",
            music: ""
        },
        {
            id: "omah-lay",
            name: "Omah Lay",
            type: "Afrobeats • Nigeria",
            music: ""
        },
        {
            id: "fireboy-dml",
            name: "Fireboy DML",
            type: "Afrobeats • Nigeria",
            music: ""
        },
        {
            id: "seyi-vibez",
            name: "Seyi Vibez",
            type: "Afrobeats • Nigeria",
            music: ""
        },
        {
            id: "shallipopi",
            name: "Shallipopi",
            type: "Afrobeats • Nigeria",
            music: ""
        },
        {
            id: "the-weeknd",
            name: "The Weeknd",
            type: "R&B • Canada",
            music: ""
        },
        {
            id: "sza",
            name: "SZA",
            type: "R&B • USA",
            music: ""
        },
        {
            id: "travis-scott",
            name: "Travis Scott",
            type: "Hip-Hop • USA",
            music: ""
        },
        {
            id: "future",
            name: "Future",
            type: "Hip-Hop • USA",
            music: ""
        }
    ];

    if (typeof module !== "undefined" && module.exports) {
        module.exports = artists;
    } else {
        root.FantrackArtists = artists;
    }
})(typeof window !== "undefined" ? window : globalThis);
