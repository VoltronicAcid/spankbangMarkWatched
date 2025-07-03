
// ==UserScript==
// @name          SpankBang - Mark Watched Videos
// @description   Marks videos that you've previously seen as watched, across the entire site.
// @author        VoltronicAcid
// @homepageURL   https://github.com/VoltronicAcid/spankbangMarkWatched
// @supportURL    https://github.com/VoltronicAcid/spankbangMarkWatched/issues
// @version       0.3.0
// @match         http*://*spankbang.com/*
// @exclude-match http*://*spankbang.com/users/history
// @run-at        document-idle
// ==/UserScript==

(() => {
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
})();

const logError = (err) => {
    console.error(err);
    console.trace(err);
};

const elementToVideo = (element) => {
    const video = {};

    if (element.tagName === "DIV") {
        video.id = element.dataset.id;
        video.title = element.querySelector("a[title]").title;
    }

    if (element.tagName === "VIDEO") {
        video.id = document.getElementById("video").dataset.videoid;
        video.title = document.querySelector("h1.main_content_title").innerText;
    }

    return video;
};

const openDb = () => {
    const name = "WatchedVideos";
    const version = 1;
    const store = "videos";

    return new Promise((resolve, reject) => {
        const open = indexedDB.open(name, version);

        open.onupgradeneeded = function () {
            open.result.createObjectStore(store, { keyPath: "id", })
                .createIndex("id", "id", { unique: true });
        };

        open.onsuccess = function () {
            const { result: db } = open;
            db.onclose = function () {
                logMessage("Database closed.");
            }
            db.onerror = function (event) {
                console.error(event.target.error);
            };
            resolve(db);
        };

        open.onerror = function (event) {
            logError(`Error with open database request.`);
            reject(event.target.error);
        }
    });
};

const addVideoPlayingListener = (db) => {
    return new Promise((resolve) => {
        const videoElem = document.getElementById("main_video_player_html5_api");
        if (!videoElem) resolve(db);
        const video = elementToVideo(videoElem);

        const getPlayingHandler = (video) => {
            let hasRun = false;

            return () => {
                if (!hasRun) {
                    setTimeout(() => {
                        const store = db.objectStoreNames[0];
                        db.transaction(store, "readwrite")
                            .objectStore(store)
                            .put(video);

                    }, 10000);

                    hasRun = true;
                }
            };
        };
        const handler = getPlayingHandler(video)

        videoElem.addEventListener("playing", handler);

        resolve(db);
    });
};

async function* getHistoryPages() {
    let url = `${origin}/users/history?page=1`;

    while (url) {
        const response = await fetch(url);
        if (!response.ok) break;

        const page = new DOMParser().parseFromString(await response.text(), "text/html");
        yield page;

        url = page.querySelector("li.next > a")?.href;
    }
};

const getCount = (db) => {
    const storeName = db.objectStoreNames[0];

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const count = store.count();

        count.onsuccess = function (event) {
            const { target: { result } } = event;
            resolve(result);
        }
        count.onerror = function (event) {
            const { target: { error } } = event;
            reject(error);
        }
    });
}

const saveWatchHistory = async (db) => {
    const lastPopulated = localStorage.getItem("watchedLastPopulated");
    if (lastPopulated && new Date().getTime() - parseInt(lastPopulated, 10) < 1000 * 60 * 60 * 24 * 7) return db;

    const storeName = db.objectStoreNames[0];

    for await (const page of getHistoryPages()) {
        const pageCount = parseInt(page.querySelector("span.sub_text").innerText, 10);
        const dbCount = await getCount(db);

        if (dbCount === pageCount) break;
        const store = db.transaction(storeName, "readwrite")
            .objectStore(storeName);

        page.querySelectorAll("div.video-item").forEach((div) => {
            const video = elementToVideo(div);
            const getQuery = store.get(video.id);

            getQuery.onsuccess = function (event) {
                const { target: { result } } = event;
                if (!result) {
                    store.add(video);
                }
            }
        });
    }

    localStorage.setItem("watchedLastPopulated", new Date().getTime());
    return db;
};

const setPreviewAsWatched = (vidDiv) => {
    const observer = new MutationObserver((mutations) => {
        for (const record of mutations) {
            const vid = record.target.querySelector("video");
            if (vid) vid.classList.add("watched");
        }
    });
    observer.observe(vidDiv, { attributes: true, attributeFilter: ["class"], });

    return vidDiv;
};

const setWatchedOverlay = (vidDiv) => {
    vidDiv.querySelector("img").classList.add("watched");

    const link = vidDiv.querySelector("a.thumb");

    const watchedDiv = document.createElement("div");
    watchedDiv.classList.add("centered");

    const p = document.createElement("p");
    p.innerText = "WATCHED";

    watchedDiv.appendChild(p);
    link.appendChild(watchedDiv);

    return vidDiv;
};

const getAllVideos = (db) => {
    const store = db.objectStoreNames[0];

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(store, "readonly");
        transaction.oncomplete = function (event) {
            // console.log(event.target);
        };
        transaction.onerror = function (event) {
            event.stopPropagation();
            reject(event.target.error);
        };

        const objStore = transaction.objectStore(store);
        const allKeys = objStore.getAllKeys();
        allKeys.onsuccess = function (event) {
            const { target: { result } } = event;
            resolve(new Set(result));
        };
        allKeys.onerror = function (event) {
            event.stopPropagation();
            reject(event.target.error);
        }
    });
};

const markWatchedThumbnails = async (db) => {
    const watched = await getAllVideos(db);
    Array.from(document.getElementsByClassName("video-item"))
        .filter((div) => watched.has(div.dataset.id))
        .map(setWatchedOverlay)
        .map(setPreviewAsWatched);
};

openDb()
    .then(addVideoPlayingListener)
    .then(saveWatchHistory)
    .then(markWatchedThumbnails)
    .catch((err) => logError(err));
