(() => {
  const models = {
    vision: {
      runtime: "Local · on demand",
      title: "Describe sampled frames",
      note: "Visual observations help review complex actions and supplement the searchable index.",
      flow: ["Sampled source frames", "Visual captioning", "Observations with source ranges"],
      constraint: "Observations cover the frames seen. Review a candidate against the source before choosing a cut.",
    },
    speech: {
      runtime: "Local · on demand",
      title: "Index what was said",
      note: "Run speech recognition on selected audio or a video’s audio track. Save each completed chunk with source time.",
      flow: ["Selected audio range", "Chunked speech recognition", "Transcript segments on the source clock"],
      constraint: "Transcript boundaries can locate a candidate. Word-level cutting requires additional alignment.",
    },
    text: {
      runtime: "Local · optional semantic search",
      title: "Find clips by meaning",
      note: "Combine keyword matching with cosine similarity over local embeddings of captions, transcripts and notes.",
      flow: ["Query and indexed text", "Normalized 1,024-D embeddings", "Ranked candidates with source ranges where available"],
      constraint: "Keyword search remains available without the optional embedding model. Only entries with source times can identify a clip range.",
    },
    image: {
      runtime: "Frame retrieval baseline · patch16/224",
      title: "Compare text against frames",
      note: "Encode sampled frames and a text query in the same space, then rank frames by similarity to the query.",
      flow: ["Sampled frames and text query", "Image and text encoders", "Frame candidates for source review"],
      constraint: "Offline evaluation on sample footage. Frame similarity can find a promising shot, while a precise cut still needs a source range.",
    },
  };

  const modelButtons = [...document.querySelectorAll("[data-model]")];
  const modelFields = ["runtime", "title", "note", "input", "process", "output", "constraint"]
    .map((name) => document.querySelector("#model-" + name));
  for (const button of modelButtons) {
    button.addEventListener("click", () => {
      const {runtime, title, note, flow, constraint} = models[button.dataset.model];
      [runtime, title, note, ...flow, constraint].forEach((value, index) => {
        modelFields[index].textContent = value;
      });
      modelButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    });
  }
})();
