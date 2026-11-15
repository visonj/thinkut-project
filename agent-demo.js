(() => {
  const sources = window.thinkutSources;
  const thread = document.querySelector("#agent-thread");
  const intro = thread.firstElementChild.cloneNode(true);
  const form = document.querySelector("#agent-form");
  const input = document.querySelector("#agent-prompt");
  const approval = document.querySelector("#agent-approval");
  const proposal = document.querySelector("#agent-proposal");
  const track = document.querySelector("#agent-track");
  const playhead = document.querySelector("#trace-playhead");
  const revisionLabel = document.querySelector("#agent-revision");
  const monitorLabel = document.querySelector("#trace-monitor-label");
  const monitorTime = document.querySelector("#trace-monitor-time");
  const image = document.querySelector("#trace-image");
  const video = document.querySelector("#trace-video");
  const rangePanel = document.querySelector("#agent-source-range");
  const rangeBar = document.querySelector("#agent-trim-span");
  const rangeLabel = document.querySelector("#agent-trim-label");
  const sourceDuration = document.querySelector("#agent-source-duration");
  const trimExample = document.querySelector("#agent-trim-example");
  const trackLength = 24;
  const ignored = new Set("a an at on of the in to it from for into show find search me place add insert put use shot clip footage v1 seconds sec and please".split(" "));
  let clips = [];
  let revision = 1;
  let selectedId = null;
  let pending = null;
  let playback = null;
  let nextClip = 1;

  const seconds = (value) => Number(value.toFixed(3));
  const rangeText = (start, end) => `${seconds(start)}–${seconds(end)}s`;
  const words = (text) => text.toLowerCase().match(/[a-z][a-z0-9]+/g) ?? [];
  const exampleTrimLength = 2.2;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function append(node) {
    thread.append(node);
    thread.scrollTop = thread.scrollHeight;
  }

  function message(role, text) {
    const bubble = element("div", "", `agent-message ${role.toLowerCase()}`);
    bubble.setAttribute("aria-label", role);
    bubble.append(element("p", text));
    append(bubble);
  }

  const toolLabels = {
    caption_search: "Searched sample captions",
    sample_frames: "Read sample frames",
    timeline_snapshot: "Read the timeline",
    timeline_edit: "Submitted the edit",
    clip_preview: "Queued the clip preview",
  };

  function receipt(tool, summary, args, result, thumbnails = []) {
    let group = thread.lastElementChild;
    if (!group?.classList.contains("agent-activity")) {
      group = element("details", "", "agent-activity");
      group.append(element("summary"));
      append(group);
    }
    const payload = element("section", "", "agent-payload");
    payload.append(element("code", tool, "agent-tool-name"), element("b", "Input"), element("pre", JSON.stringify(args, null, 2)),
      element("b", "Result"), element("pre", JSON.stringify(result, null, 2)));
    if (thumbnails.length) {
      const gallery = element("div", "", "agent-frames");
      for (const frame of thumbnails) {
        const figure = element("figure");
        const thumb = element("img");
        thumb.src = frame.image;
        thumb.alt = `Source frame at ${frame.time}s`;
        figure.append(thumb, element("figcaption", `${frame.time}s`));
        gallery.append(figure);
      }
      payload.append(gallery);
    }
    group.append(payload);
    const count = group.children.length - 1;
    group.firstElementChild.textContent = count === 1 ? `${toolLabels[tool]} · ${summary}` : `Ran ${count} browser operations`;
    thread.scrollTop = thread.scrollHeight;
  }

  function search(query) {
    const terms = [...new Set(words(query).filter((term) => !ignored.has(term)))];
    const namedAsset = sources.find(asset => query.toLowerCase().includes(asset.file.toLowerCase()));
    const candidates = sources.flatMap((asset) => {
      if (namedAsset && asset !== namedAsset) return [];
      const byId = terms.includes(asset.id) || asset === namedAsset;
      const observations = asset.evidence.map(([start, end, , caption], index) => {
        const captionWords = words(caption);
        const hits = terms.filter((term) => captionWords.some((word) =>
          word === term || (term.length >= 4 && word.startsWith(term)))).length;
        return {start, end, caption, index, score: hits + (byId ? 3 : 0)};
      });
      const best = observations.sort((left, right) => right.score - left.score)[0];
      return best.score ? [{asset, ...best}] : [];
    }).sort((left, right) => right.score - left.score).slice(0, 3);
    receipt("caption_search", `${candidates.length} candidates`, {query, limit: 3},
      candidates.map(({asset, start, end, caption}) =>
        ({assetId: asset.id, file: asset.file, rangeS: [start, end], caption})));
    return candidates;
  }

  function snapshot() {
    return {revision, tracks: {V1: clips.map(({id, asset, start, end, at}) => ({
      id, assetId: asset.id, sourceS: [start, end], sequenceS: [at, seconds(at + end - start)],
    }))}};
  }

  function readTimeline() {
    const state = snapshot();
    receipt("timeline_snapshot", `V1 · revision ${state.revision}`, {}, state);
    return state;
  }

  function stopPlayback() {
    playback = null;
    video.pause();
    video.hidden = true;
    image.hidden = false;
    playhead.hidden = true;
  }

  function showSource(asset, start, end, index) {
    stopPlayback();
    image.src = `assets/evidence-${asset.id}-${index}.jpg`;
    image.alt = `Source evidence from ${asset.file}`;
    monitorLabel.textContent = "SOURCE MONITOR";
    const sample = asset.evidence[index][2];
    const frameLabel = sample >= start && sample < end ? "frame" : "reference frame";
    monitorTime.textContent = `${asset.file} · ${frameLabel} ${sample}s`;
    rangePanel.hidden = false;
    rangeBar.style.left = `${Math.max(0, start) / asset.duration * 100}%`;
    rangeBar.style.width = `${Math.min(asset.duration, end - start) / asset.duration * 100}%`;
    rangeLabel.textContent = `Source range · ${rangeText(start, end)}`;
    sourceDuration.textContent = `${asset.duration}s`;
  }

  function inspectSource(asset, start, end) {
    const frames = asset.evidence.flatMap(([, , time], index) =>
      time >= start && time < end ? [{time, image: `assets/evidence-${asset.id}-${index}.jpg`}] : []);
    receipt("sample_frames", frames.length ? `${frames.length} sample frames` : "No sample frame in this range",
      {assetId: asset.id, timesS: frames.map(({time}) => time)}, {frames}, frames);
  }

  function previewClip(clip) {
    stopPlayback();
    playback = clip;
    monitorLabel.textContent = "TIMELINE PREVIEW";
    monitorTime.textContent = `V1 · ${rangeText(clip.at, clip.at + clip.end - clip.start)}`;
    video.src = `assets/source-${clip.asset.id}.mp4`;
    video.currentTime = clip.start;
    video.hidden = false;
    image.hidden = true;
    playhead.hidden = false;
    playhead.style.left = `${clip.at / trackLength * 100}%`;
    video.play().catch(() => {
      if (playback !== clip) return;
      stopPlayback();
      monitorTime.textContent = "Select the timeline clip to retry playback";
    });
  }

  video.addEventListener("timeupdate", () => {
    if (!playback) return;
    const {start, end, at} = playback;
    const time = Math.max(start, Math.min(end, video.currentTime));
    playhead.style.left = `${(at + time - start) / trackLength * 100}%`;
    if (video.currentTime >= end && !video.paused) {
      video.pause();
      video.currentTime = end;
    }
  });

  function updateTrimExample() {
    const clip = clips.find(({id}) => id === selectedId);
    trimExample.hidden = !clip || seconds(clip.end - clip.start) <= exampleTrimLength;
  }

  function evidenceIndex(asset, start, end) {
    return asset.evidence.findIndex(([, , sample]) => sample >= start && sample < end);
  }

  function chooseEvidence(asset, start, end, fallback) {
    const index = evidenceIndex(asset, start, end);
    return index < 0 ? fallback : index;
  }

  function drawTimeline() {
    revisionLabel.textContent = `Revision ${revision}`;
    updateTrimExample();
    const nodes = clips.map((clip) => {
      const button = element("button", clip.asset.file, "agent-clip");
      button.type = "button";
      button.style.left = `${clip.at / trackLength * 100}%`;
      button.style.width = `${(clip.end - clip.start) / trackLength * 100}%`;
      button.setAttribute("aria-pressed", String(selectedId === clip.id));
      button.setAttribute("aria-label", `Preview ${clip.asset.file}, ${rangeText(clip.at, clip.at + clip.end - clip.start)} on V1`);
      button.addEventListener("click", () => {
        selectedId = clip.id;
        updateTrimExample();
        for (const peer of track.querySelectorAll("button")) peer.setAttribute("aria-pressed", String(peer === button));
        previewClip(clip);
      });
      return button;
    });
    track.replaceChildren(...(nodes.length ? nodes : [element("span", "No clips yet", "agent-empty")]), playhead);
  }

  function propose(command, baseRevision) {
    pending = {command, baseRevision};
    const {asset, start, end, at, operation} = command;
    proposal.textContent = `${operation === "trim" ? "Trim" : "Place"} ${asset.file} · source ${rangeText(start, end)} → V1 at ${at}s`;
    approval.hidden = false;
  }

  function dismissProposal() {
    pending = null;
    approval.hidden = true;
  }

  function handlePrompt(text) {
    if (pending) {
      input.value = text;
      message("Agent", "Apply or cancel the pending edit before starting another.");
      return;
    }
    message("You", text);
    input.value = "";
    if (/^\s*(?:trim|shorten)\b/i.test(text)) {
      const clip = clips.find(({id}) => id === selectedId);
      const match = text.match(/\bto\s+([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(?:seconds?|secs?|s)\b/i);
      if (!clip || !match) {
        message("Agent", "Select a timeline clip, then try “Trim it to 2.2s.”");
        return;
      }
      const length = seconds(Number(match[1]));
      if (!(length > 0 && length < seconds(clip.end - clip.start))) {
        message("Agent", `Choose a duration shorter than the current ${seconds(clip.end - clip.start)}s clip.`);
        return;
      }
      const trimLeadIn = /\blead[ -]in\b/i.test(text);
      const start = trimLeadIn ? seconds(clip.end - length) : clip.start;
      const end = trimLeadIn ? clip.end : seconds(clip.start + length);
      message("Agent", trimLeadIn
        ? `I’ll move the source in-point to ${start}s and keep the clip at ${clip.at}s on V1.`
        : `I’ll keep the source in-point and timeline start, then move the out-point to ${end}s.`);
      const state = readTimeline();
      propose({...clip, start, end, operation: "trim"}, state.revision);
      return;
    }
    const editing = /^\s*(?:place|add|insert|put|use)\b/i.test(text);
    const searching = /^\s*(?:find|search|show)\b/i.test(text);
    if (!editing && !searching) {
      message("Agent", "Try “Find a milk pour”, “Place 2.7–5.7s of the tamp at 6s on V1”, or “Trim it to 2.2s”.");
      return;
    }
    if (editing && /\b[va](?!1\b)\d+\b|\ba1\b/i.test(text)) {
      message("Agent", "This demo can place video clips on V1.");
      return;
    }
    message("Agent", editing
      ? "I’ll find the source and check its range before placing it."
      : "I’ll look for matching observations in the source clips.");
    const candidates = search(text);
    if (!candidates.length) {
      message("Agent", "The sample captions returned no match. Try a visible action such as tamp, pour, or serve.");
      return;
    }
    const {asset, start, end, caption, index} = candidates[0];
    const requested = text.match(/([+−-]?(?:\d+(?:\.\d+)?|\.\d+))\s*[-–]\s*([+−-]?(?:\d+(?:\.\d+)?|\.\d+))(?:\s*(?:seconds?|secs?|s))?(?=\s|[,.!?]|$)/i);
    const bounds = requested ? [seconds(Number(requested[1])), seconds(Number(requested[2]))]
      : editing ? asset.edit ?? [start, end] : [start, end];
    if (!(bounds[0] >= 0 && bounds[1] > bounds[0] && bounds[1] <= asset.duration)) {
      message("Agent", `That range falls outside ${asset.file} (${asset.duration}s). Enter a valid source in and out.`);
      return;
    }
    const place = text.match(/\bat\s+([+−-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(?:seconds?|secs?|s)\b/i);
    if (editing && ((/\bat\b/i.test(text) && !place) || (place && !(
      Number(place[1]) >= 0 && seconds(Number(place[1]) + bounds[1] - bounds[0]) <= trackLength
    )))) {
      message("Agent", "Enter a nonnegative start in seconds and keep the edit within the 24-second timeline.");
      return;
    }
    const inRangeFrame = evidenceIndex(asset, ...bounds);
    const shown = inRangeFrame < 0 ? index : inRangeFrame;
    showSource(asset, ...bounds, shown);
    inspectSource(asset, ...bounds);
    const at = place ? seconds(Number(place[1])) : seconds(Math.max(0, ...clips.map((clip) => clip.at + clip.end - clip.start)));
    const observation = requested
      ? inRangeFrame < 0 ? "There’s no indexed frame inside the requested range. You can check it in the timeline preview."
        : asset.evidence[shown][3]
      : caption;
    message("Agent", `I found ${asset.file}. ${observation} ${editing ? "I’ll use" : "The matching range is"} ${rangeText(...bounds)}.`);
    if (editing) {
      const state = readTimeline();
      propose({operation: "insert", asset, start: bounds[0], end: bounds[1], at}, state.revision);
    }
  }

  document.querySelector("#agent-apply").addEventListener("click", () => {
    if (!pending) return;
    const {command, baseRevision} = pending;
    dismissProposal();
    append(element("p", "You approved the edit.", "agent-status"));
    const {id, asset, start, end, at, operation} = command;
    const finish = seconds(at + end - start);
    const args = {baseRevision, operation, clipId: id, assetId: asset.id, sourceS: [start, end], track: "V1", sequenceStartS: at};
    const overlap = clips.some((clip) => clip.id !== id &&
      at < seconds(clip.at + clip.end - clip.start) && finish > clip.at);
    const error = baseRevision !== revision ? "stale_revision"
      : at < 0 || finish > trackLength ? "outside_timeline" : overlap ? "clip_overlap" : null;
    if (error) {
      receipt("timeline_edit", "Rejected", args, {status: "rejected", error, revision});
      message("Agent", error === "clip_overlap" ? "That range overlaps an existing V1 clip. Choose a different start time."
        : error === "outside_timeline" ? "The edit must end within this demo’s 24-second timeline."
        : "The timeline changed. Please send the edit again.");
      return;
    }
    const clip = {id: id ?? `clip-${nextClip++}`, asset, start, end, at};
    clips = [...clips.filter((item) => item.id !== clip.id), clip].sort((a, b) => a.at - b.at);
    selectedId = clip.id;
    revision++;
    drawTimeline();
    const newClipButton = track.querySelector('[aria-pressed="true"]');
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      newClipButton.animate([{opacity: .25, transform: "translateY(-8px)"}, {opacity: 1, transform: "translateY(0)"}], {duration: 260});
    }
    receipt("timeline_edit", `Applied · r${baseRevision} → r${revision}`, args,
      {status: "applied", revision, clipId: clip.id, sequenceS: [at, finish]});
    readTimeline();
    receipt("clip_preview", `V1 · ${rangeText(at, finish)}`,
      {revision, sequenceS: [at, finish]}, {previewAssetId: asset.id, sourceS: [start, end]});
    const frameIndex = chooseEvidence(asset, start, end, 0);
    showSource(asset, start, end, frameIndex);
    previewClip(clip);
    message("Agent", `${operation === "trim" ? "Trimmed" : "Placed"} ${asset.file} on V1 at ${rangeText(at, finish)}.`);
  });
  document.querySelector("#agent-cancel").addEventListener("click", () => {
    dismissProposal();
    message("Agent", `Edit cancelled. Timeline is at revision ${revision}.`);
  });
  document.querySelector("#agent-reset").addEventListener("click", () => {
    dismissProposal();
    stopPlayback();
    clips = [];
    revision = 1;
    nextClip = 1;
    selectedId = null;
    input.value = "";
    rangePanel.hidden = true;
    monitorLabel.textContent = "SOURCE MONITOR";
    monitorTime.textContent = "Select a clip";
    image.src = "assets/evidence-tamp-1.jpg";
    image.alt = "Coffee preparation preview";
    thread.replaceChildren(intro.cloneNode(true));
    drawTimeline();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (text) handlePrompt(text);
  });
  for (const button of document.querySelectorAll("[data-agent-prompt]")) {
    button.addEventListener("click", () => handlePrompt(button.dataset.agentPrompt));
  }
})();
