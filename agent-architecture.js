const architectureStages = {
  context: {
    title: "Retrieve candidates with source time",
    description: "Search the project index for likely shots, inspect source frames if allowed, and read the current sequence before placing clips.",
    tools: ["search_assets", "request_source_frames", "read_editing_state"],
  },
  plan: {
    title: "Turn a decision into typed commands",
    description: "The runtime queries the editor’s command definitions. Each proposed operation carries the relevant clip or asset reference, track and timing.",
    tools: ["describe_editing", "timeline.place", "timeline.trim", "timeline.move"],
  },
  apply: {
    title: "Validate the edit against the current sequence",
    description: "The service checks the command schema and permitted references. If a manual edit changed the sequence revision, the editor rejects the old command batch. A successful write returns a receipt.",
    tools: ["apply_editing"],
  },
  check: {
    title: "Read back what the editor actually changed",
    description: "Read the updated sequence and inspect program frames when available and authorized. Report the changes that the editor confirmed.",
    tools: ["read_editing_state", "inspect_timeline", "review_task_goal"],
  },
};

const architectureCases = {
  draft: {
    request: "Cut a 21-second coffee film, from beans to the finished cup.",
    context: [["Source select", "C0047.MP4 · 2.7–5.7s"], ["Timeline state", "V1 is empty"]],
    plan: [["Command", "Place the tamp excerpt on V1"], ["Sequence range", "6.0–9.0s"]],
    apply: [["Write", "Place excerpts on V1, with titles and audio on separate tracks"], ["Receipt", "New timeline revision with clip references"]],
    check: [["Readback", "Tamp is on V1 at 6.0–9.0s"], ["Preview", "Check the press and release in the assembled cut"]],
  },
  revise: {
    request: "The tamp shot feels a little long. Can you shorten it?",
    context: [["Existing clip", "V1 at 6.0–9.0s"], ["Linked source range", "C0047.MP4 · 2.7–5.7s"]],
    plan: [["Source in-point", "2.7s → 3.5s"], ["Sequence change", "Bring later clips forward by 0.8s"]],
    apply: [["Write", "Trim the existing clip and close the gap"], ["On revision mismatch", "Read the current sequence again before proposing a new edit"]],
    check: [["Readback", "Tamp is on V1 at 6.0–8.2s"], ["Preview", "Check the cut into espresso at 8.2s"]],
  },
};

const map = document.querySelector("#agent-design");
const stageButtons = [...map.querySelectorAll("[data-architecture-stage]")];
const caseButtons = [...map.querySelectorAll("[data-architecture-case]")];
const request = map.querySelector("#architecture-request");
const detailTitle = map.querySelector("#architecture-detail-title");
const detailCopy = map.querySelector("#architecture-detail-copy");
const toolList = map.querySelector("#architecture-tools");
const exampleList = map.querySelector("#architecture-example");
let stage = "context";
let scenario = "draft";

function setArchitectureDetail() {
  const {title, description, tools} = architectureStages[stage];
  const example = architectureCases[scenario];
  request.textContent = example.request;
  detailTitle.textContent = title;
  detailCopy.textContent = description;
  toolList.replaceChildren(...tools.map(name => {
    const item = document.createElement("li");
    const code = document.createElement("code");
    code.textContent = name;
    item.append(code);
    return item;
  }));
  exampleList.replaceChildren(...example[stage].map(([label, value]) => {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const definition = document.createElement("dd");
    term.textContent = label;
    definition.textContent = value;
    row.append(term, definition);
    return row;
  }));
}

for (const button of stageButtons) {
  button.addEventListener("click", () => {
    stage = button.dataset.architectureStage;
    stageButtons.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    setArchitectureDetail();
  });
}

for (const button of caseButtons) {
  button.addEventListener("click", () => {
    scenario = button.dataset.architectureCase;
    caseButtons.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    setArchitectureDetail();
  });
}
