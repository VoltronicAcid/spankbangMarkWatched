
// ==UserScript==
// @name          SpankBang - Mark Watched Videos
// @description   Marks videos that you've previously seen as watched, across the entire site.
// @author        VoltronicAcid
// @version       0.2
// @match         http*://*.spankbang.com/*
// @exclude-match http*://*.spankbang.com/users/history
// @run-at        document-idle
// @grant         GM.setValue
// @grant         GM.getValue
// @grant         GM.listValues
// @grant         GM.deleteValues
// @grant         GM.xmlHttpRequest
// ==/UserScript==

const addStyles = () => {
    const style = document.createElement("style");
    style.textContent = `
        img.watched {
            filter: grayscale(100%);
        }
        div.centered{
            position: absolute;
            color: white;
            height: 100%;
            width: 100%;
            transform: translate(0, -100%);
            z-index: 999;
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

const setWatchedOverlay = (link) => {
    const image = link.querySelector("img");
    image.classList.add("watched");

    const pic = link.querySelector("picture");

    const div = document.createElement("div");
    div.classList.add("centered");

    const p = document.createElement("p");
    p.innerText = "Watched";

    div.appendChild(p);
    pic.appendChild(div);
};

const addWatchedVideos = async (response) => {
    const vids = Array.from(response.responseXML.getElementsByClassName("thumb"));

    for (const vid of vids) {
        const div = vid.closest(".video-item");
        await GM.setValue(div.dataset.id, vid.title);
    }
};

const addWatchHistory = async () => {
    let nextBttn;
    let pageNum = 1;

    do {
        const response = await GM.xmlHttpRequest({
            url: `${document.location.origin}/users/history?page=${pageNum++}`,
            responseType: 'document'
        });
        await addWatchedVideos(response);
        nextBttn = response.responseXML.querySelector("#user_panel > div > div > div.pagination > ul > li.next");
    } while (!nextBttn?.classList.contains("disabled"))

    return new Set(await GM.listValues());
};

const addCurrentVideoToHistory = () => {
    const video = document.querySelector("#main_video_player_html5_api");
    if (!video) return;

    video.addEventListener("playing", async () => {
        const vidId = document.getElementById("video").dataset.videoid;
        const title = document.querySelector("h1.main_content_title").innerText;
        await GM.setValue(vidId, title);
    });
};


const main = async () => {
    addStyles();
    if (document.location.pathname.match(/.*\/(playlist|video)\/.*/)) {
        addCurrentVideoToHistory();
        return;
    }

    const ids = await GM.listValues();
    const watched = ids.length
        ? new Set(ids)
        : await addWatchHistory();

    Array.from(document.getElementsByClassName("video-item"))
        .filter((div) => watched.has(div.dataset.id))
        .map(setWatchedOverlay);
};
main();
