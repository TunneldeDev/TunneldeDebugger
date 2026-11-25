import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { scenarioById } from "../shared/scenarios";
import { validateParameters } from "../shared/protocol";
import type { FrameMessage } from "../shared/protocol";
import { isolateStorage } from "../shared/memory-storage";
isolateStorage();
const query = new URLSearchParams(location.search);
const session = query.get("session") ?? "standalone";
const parentOrigin = query.get("parentOrigin") ?? location.origin;
const generation = Number(query.get("generation") ?? 0);
let applied = false;
const root = createRoot(document.getElementById("root")!);
const send = (message: object) =>
  parent.postMessage(
    { version: 1, session, generation, ...message },
    parentOrigin,
  );
class Boundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(error: Error) {
    send({ type: "error", message: error.stack ?? error.message });
  }
  render() {
    return this.state.error ? (
      <pre role="alert">{this.state.error}</pre>
    ) : (
      this.props.children
    );
  }
}
window.addEventListener("error", (event) =>
  send({ type: "diagnostic", message: event.message }),
);
window.addEventListener("unhandledrejection", (event) =>
  send({
    type: "diagnostic",
    message: String(event.reason?.message ?? event.reason),
  }),
);
window.addEventListener("message", async (event) => {
  if (event.source !== parent || event.origin !== parentOrigin) return;
  const message = event.data as FrameMessage;
  if (
    message.version !== 1 ||
    message.session !== session ||
    message.generation !== generation
  )
    return;
  try {
    if (message.type === "capture") {
      try {
        const { domToCanvas } = await import("modern-screenshot");
        const canvas = await domToCanvas(document.documentElement, {
          width: innerWidth,
          height: innerHeight,
          scale: 1,
          // DOM clones otherwise render scroll containers from their origin.
          features: { restoreScrollPosition: true },
          backgroundColor: getComputedStyle(document.body).backgroundColor,
        });
        send({
          type: "captured",
          requestId: message.requestId,
          image: canvas.toDataURL("image/png"),
        });
      } catch (error) {
        send({
          type: "captured",
          requestId: message.requestId,
          error: String(error),
        });
      }
      return;
    }
    const target = await import("@tunnelde-target");
    if (message.type === "snapshot") {
      send({ type: "state", snapshot: target.snapshot() });
      return;
    }
    if (message.type !== "apply") return;
    if (applied) return;
    applied = true;
    const scenario = scenarioById(message.scenario.id);
    const parameters = validateParameters(message.parameters);
    if (!scenario.presets.includes(parameters.preset))
      throw new Error("Unsupported scene preset");
    const adapterScene = { ...scenario, id: scenario.surface };
    await target.prepareScene(adapterScene, parameters);
    if (generation !== message.generation) return;
    const onReady = () =>
      send({ type: "ready", scenarioId: message.scenario.id });
    root.render(
      <Boundary key={generation}>
        <target.SceneView
          scene={adapterScene}
          parameters={parameters}
          onReady={onReady}
        />
      </Boundary>,
    );
  } catch (error) {
    send({ type: "error", message: String(error) });
    root.render(<pre role="alert">{String(error)}</pre>);
  }
});
send({ type: "diagnostic", message: "renderer:connected" });
