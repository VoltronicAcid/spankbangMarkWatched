
// ==UserScript==
// @name          SpankBang - Mark Watched Videos
// @description   Marks videos that you've previously seen as watched, across the entire site.
// @author        VoltronicAcid
// @version       0.1
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
    style.textContent = `img.watched {
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
    document.body.appendChild(style);
};

const setWatched = (link) => {
    const image = link.querySelector("img");
    image.classList.add("watched");

    const div = document.createElement("div");
    div.classList.add("centered");

    const p = document.createElement("p");
    p.innerText = "Watched";

    div.appendChild(p);
    link.appendChild(div);
};

const addWatchedVideos = async (response) => {
    const page = response.responseXML;
    const nextSelector = "#user_panel > div > div > div.pagination > ul > li.next";
    const vidSelector = "thumb";

    const nextBttn = page.querySelector(nextSelector);
    const vids = Array.from(page.getElementsByClassName(vidSelector));

    for (const vidObj of vids) {
        await GM.setValue(vidObj.href, vidObj.title);
    }

    return nextBttn;
};

const initializeHistory = async () => {
    let nextBttn;
    let pageNum = 1;

    do {
        const response = await GM.xmlHttpRequest({
            url: `${document.location.origin}/users/history?page=${pageNum++}`,
            responseType: 'document'
        });
        nextBttn = await addWatchedVideos(response);
    } while (!nextBttn.classList.contains("disabled"))

    return new Set(await GM.listValues());
};

const addCurrentVideoToHistory = () => {
    const video = document.querySelector("#main_video_player_html5_api");
    if (!video) return;

    video.addEventListener("playing", async () => {
        const title = document.querySelector("h1.main_content_title").innerText;
        await GM.setValue(document.location.pathname, title);
    });
};


const main = async () => {
    addStyles();
    const urls = await GM.listValues();
    addCurrentVideoToHistory();
    const watched = urls.length
        ? new Set(urls)
        : await initializeHistory();

    Array.from(document.getElementsByClassName("thumb"))
        .filter((vid) => watched.has(vid.pathname))
        .map(setWatched);
};
// GM.listValues().then(keys => GM.deleteValues(keys).then(() => main()));
main();
