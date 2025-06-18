
// ==UserScript==
// @name          SpankBang - Mark Watched Videos
// @description   Marks videos that you've previously seen as watched, across the entire site.
// @author        VoltronicAcid
// @version       0.2.4
// @match         http*://*.spankbang.com/*
// @exclude-match http*://*.spankbang.com/users/history
// @run-at        document-idle
// @grant         GM.setValue
// @grant         GM.listValues
// @grant         GM.xmlHttpRequest
// ==/UserScript==

const addStyles = () => {
    const style = document.createElement("style");
    style.textContent = `
        .watched {
            filter: grayscale(100%);
        }
        div.centered{
            position: absolute;
            color: white;
            height: 100%;
            width: 100%;
            transform: translate(0, -100%);
            z-index: 3;
            text-align: center;
        }
        div.centered p {
            position: relative;
            top: 40%;
            font-size: 1.5rem;
            background: rgba(0,0,0,0.5);
            display: inline;
            padding: 2%;
        }`;
    document.head.appendChild(style);
};

const setPreviewAsWatched = (vidDiv) => {
    const observer = new MutationObserver((mutations) => {
        for (const record of mutations) {
            if (record.oldValue === "video-item") {
                const vid = record.target.querySelector("video");
                vid.classList.add("watched");
            }
        }
    });
    observer.observe(vidDiv, { attributes: true, attributeOldValue: true, });

    return vidDiv;
};

const setWatchedOverlay = (vidDiv) => {
    vidDiv.querySelector("img").classList.add("watched");

    const link = vidDiv.querySelector("a.thumb");

    const watchedDiv = document.createElement("div");
    watchedDiv.classList.add("centered");

    const p = document.createElement("p");
    p.innerText = "Watched";

    watchedDiv.appendChild(p);
    link.appendChild(watchedDiv);

    return vidDiv;
};

const updateThumbnails = (watched) => {
    Array.from(document.getElementsByClassName("video-item"))
        .filter((div) => watched.has(div.dataset.id))
        .map(setWatchedOverlay)
        .map(setPreviewAsWatched);
};

const saveVideosFromPage = async (response) => {
    const watched = new Set();
    const vids = Array.from(response.responseXML.getElementsByClassName("thumb"));

    for (const vid of vids) {
        const div = vid.closest(".video-item");
        await GM.setValue(div.dataset.id, vid.title);
        watched.add(div.dataset.id);
    }

    updateThumbnails(watched);
};

const saveWatchHistory = async () => {
    let nextBttn;
    let pageNum = 1;

    do {
        const response = await GM.xmlHttpRequest({
            url: `${document.location.origin}/users/history?page=${pageNum++}`,
            responseType: 'document'
        });
        await saveVideosFromPage(response);
        nextBttn = response.responseXML.querySelector("#user_panel > div > div > div.pagination > ul > li.next");
    } while (!nextBttn?.classList.contains("disabled"));
};

const addVideoToHistory = () => {
    const video = document.querySelector("#main_video_player_html5_api");
    if (!video) return;

    video.addEventListener("playing", async () => {
        const vidId = document.getElementById("video").dataset.videoid;
        const title = document.querySelector("h1.main_content_title").innerText;
        await GM.setValue(vidId, title);
    });
};

const logError = (err) => {
    console.error(err);
    console.trace(err);
};

addStyles();
GM.listValues()
    .then((watched) => {
        if (watched.length) updateThumbnails(new Set(watched));
        else saveWatchHistory().catch(logError);
    })
    .catch(logError);

if (document.location.pathname.match(/^\/.*\/(playlist|video)\/.*/)) {
    addVideoToHistory();
}
