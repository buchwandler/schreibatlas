// SPDX-License-Identifier: Apache-2.0
const svgNamespace = "http://www.w3.org/2000/svg";
const illustrativeDurationMs = 650;

function setupStrokeRenderers(root: ParentNode = document): void {
  for (const renderer of root.querySelectorAll<HTMLElement>("[data-stroke-renderer]")) setupRenderer(renderer);
}

function setupRenderer(renderer: HTMLElement): void {
  if (renderer.dataset.strokeReady === "true") return;
  const button = renderer.querySelector<HTMLButtonElement>("[data-stroke-play]");
  const stage = renderer.querySelector<SVGSVGElement>("[data-stroke-animation]");
  const status = renderer.querySelector<HTMLElement>("[data-stroke-status]");
  const steps = [...renderer.querySelectorAll<HTMLLIElement>("[data-stroke-step]")];
  if (!button || !stage || !status || steps.length === 0) return;

  renderer.dataset.strokeReady = "true";
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let runId = 0;
  let activeAnimations: Animation[] = [];

  const setMotionState = () => {
    if (motionPreference.matches) {
      runId += 1;
      activeAnimations.forEach((animation) => animation.cancel());
      activeAnimations = [];
      stage.replaceChildren();
      stage.dataset.visible = "false";
      button.hidden = true;
      button.disabled = false;
      status.textContent = renderer.dataset.reduced ?? "";
    } else {
      button.hidden = false;
      status.textContent = renderer.dataset.initial ?? "";
    }
  };

  motionPreference.addEventListener("change", setMotionState);
  button.addEventListener("click", async () => {
    if (motionPreference.matches || button.disabled) return;
    const thisRun = ++runId;
    button.disabled = true;
    status.textContent = renderer.dataset.playing ?? "";
    stage.replaceChildren();
    stage.dataset.visible = "true";

    try {
      for (const step of steps) {
        if (thisRun !== runId || motionPreference.matches) return;
        const group = document.createElementNS(svgNamespace, "g");
        const sourcePaths = step.querySelectorAll<SVGPathElement>("svg path[d]");
        const paths = [...sourcePaths].map((source) => {
          const path = document.createElementNS(svgNamespace, "path");
          path.setAttribute("d", source.getAttribute("d") ?? "");
          path.setAttribute("fill", "none");
          path.setAttribute("stroke", "currentColor");
          path.setAttribute("stroke-width", "0.02");
          path.setAttribute("stroke-linecap", "round");
          path.setAttribute("stroke-linejoin", "round");
          group.append(path);
          return path;
        });
        if (paths.length === 0) throw new Error("Stroke step has no path geometry.");
        stage.append(group);

        const sourceDuration = step.dataset.durationMs;
        const duration = sourceDuration ? Number(sourceDuration) : illustrativeDurationMs;
        if (!Number.isFinite(duration) || duration < 0) throw new Error("Stroke timing is invalid.");
        const animations: Animation[] = [];
        for (const path of paths) {
          const length = path.getTotalLength();
          if (length <= 0 || duration === 0) continue;
          path.style.strokeDasharray = String(length);
          path.style.strokeDashoffset = String(length);
          animations.push(path.animate(
            [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
            { duration, fill: "forwards", easing: "linear" },
          ));
        }
        activeAnimations = animations;
        await Promise.all(animations.map((animation) => animation.finished));
        if (step.dataset.penDown === "false") paths.forEach((path) => path.style.strokeDasharray = "0.03 0.02");
        if (thisRun !== runId || motionPreference.matches) return;
      }
      status.textContent = renderer.dataset.complete ?? "";
    } catch {
      if (thisRun === runId && !motionPreference.matches) {
        stage.replaceChildren();
        stage.dataset.visible = "false";
        status.textContent = renderer.dataset.error ?? "";
      }
    } finally {
      if (thisRun === runId) {
        activeAnimations = [];
        button.disabled = false;
      }
    }
  });

  setMotionState();
}


setupStrokeRenderers();
