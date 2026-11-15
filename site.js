const video = document.querySelector("#workflow-video");
const chapters = [...document.querySelectorAll("[data-time]")];
function markChapter(time) {
  const current = chapters.findLastIndex((chapter) => Number(chapter.dataset.time) <= time);
  for (const [index, chapter] of chapters.entries()) {
    if (index === current) chapter.setAttribute("aria-current", "step");
    else chapter.removeAttribute("aria-current");
  }
}
for (const chapter of chapters) {
  chapter.addEventListener("click", () => {
    const time = Number(chapter.dataset.time);
    video.currentTime = time;
    markChapter(time);
    video.play().catch(() => {});
  });
}
video.addEventListener("timeupdate", () => markChapter(video.currentTime));

const library = document.querySelector("#asset-list");
const inspector = document.querySelector("#segments");
const sourceName = document.querySelector("#source-name");
const sourceVideo = document.querySelector("#source-video");
const sourceSelection = document.querySelector("#source-selection");
const evidence = document.querySelector("#captions");
let stopAt = null;

const players = [...document.querySelectorAll("video")];
for (const player of players) {
  player.addEventListener("play", () => {
    if (player.paused) return;
    for (const other of players) {
      if (other !== player && !other.paused) other.pause();
    }
  });
}

sourceVideo.addEventListener("timeupdate", () => {
  if (stopAt !== null && sourceVideo.currentTime >= stopAt) {
    const end = stopAt;
    stopAt = null;
    sourceVideo.pause();
    sourceVideo.currentTime = end;
  }
});

function element(tag, value) {
  const item = document.createElement(tag);
  if (value) item.textContent = value;
  return item;
}
function thumbnail(id, index) {
  const img = document.createElement("img");
  img.src = `assets/evidence-${id}-${index}.jpg`;
  img.alt = "";
  return img;
}
function rangeButton(start, end, label = "") {
  const play = element("button", `▶ ${label}${start.toFixed(1)}–${end.toFixed(1)}s`);
  play.className = "play-range";
  play.type = "button";
  play.addEventListener("click", () => {
    stopAt = end;
    sourceVideo.currentTime = start;
    sourceVideo.play().catch(() => { stopAt = null; });
  });
  return play;
}
function selectAsset(asset) {
  stopAt = null;
  sourceVideo.pause();
  sourceVideo.poster = `assets/evidence-${asset.id}-0.jpg`;
  sourceVideo.src = `assets/source-${asset.id}.mp4`;
  sourceName.textContent = `${asset.file} · ${asset.duration.toFixed(2)}s`;
  if (asset.finalEdit) {
    sourceSelection.replaceChildren(rangeButton(...asset.edit, "Draft · "), rangeButton(...asset.finalEdit, "Final cut · "));
  } else if (asset.edit) {
    sourceSelection.replaceChildren(rangeButton(...asset.edit, "Final cut · "));
  } else {
    sourceSelection.replaceChildren(element("span", "Reference footage · unused in the final cut"));
  }
  inspector.replaceChildren(...asset.evidence.map(([start, end, , caption], index) => {
    const card = element("figure");
    card.className = "segment";
    const description = element("figcaption");
    description.append(rangeButton(start, end), element("p", caption));
    card.append(thumbnail(asset.id, index), description);
    return card;
  }));
  for (const button of library.children) button.setAttribute("aria-pressed", String(button.dataset.id === asset.id));
}
for (const asset of window.thinkutSources) {
  const button = element("button");
  button.type = "button";
  button.className = "asset";
  button.dataset.id = asset.id;
  button.append(thumbnail(asset.id, 0), element("span", asset.file));
  button.addEventListener("click", () => selectAsset(asset));
  library.append(button);
}
selectAsset(window.thinkutSources.find((asset) => asset.id === "station"));

function openLinkedEvidence() {
  if (location.hash === "#captions") evidence.open = true;
  if (location.hash === "#captions-tamp") {
    evidence.open = true;
    const tamp = window.thinkutSources.find(asset => asset.id === "tamp");
    if (tamp) selectAsset(tamp);
    evidence.scrollIntoView();
  }
}
openLinkedEvidence();
window.addEventListener("hashchange", openLinkedEvidence);
document.querySelector('a[href="#captions-tamp"]').addEventListener("click", () => {
  if (location.hash === "#captions-tamp") openLinkedEvidence();
});
