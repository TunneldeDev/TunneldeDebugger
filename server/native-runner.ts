import { scenarios, scenarioById } from "../shared/scenarios";
import {
  DEFAULT_PARAMETERS,
  type RunEvent,
  type RunStatus,
  type TestItem,
  type TestRunnerAdapter,
} from "../shared/protocol";
import type { NativeManager } from "./native";
import { NativeDebugTarget } from "./native-target";
export class NativeRunner implements TestRunnerAdapter {
  readonly kind = "native" as const;
  constructor(
    private native: NativeManager,
    private ensureFrontend: () => Promise<void>,
  ) {}
  async discover(): Promise<TestItem[]> {
    return ["native-mock", "native-service"].map((mode) => ({
      id: `native:${mode}`,
      runner: this.kind,
      label: `${mode} · 自动检查；人工结论另记`,
      children: scenarios
        .filter(
          (scene) =>
            scene.targets.includes(mode as "native-mock") &&
            (mode === "native-mock" ||
              [
                "hosts",
                "editor",
                "terminal",
                "files",
                "settings-general",
              ].includes(scene.id)),
        )
        .map((scene) => ({
          id: `native:${mode}#${scene.id}`,
          runner: this.kind,
          label: scene.title,
          name: scene.id,
          target: mode,
        })),
    }));
  }
  async run(
    items: TestItem[],
    signal: AbortSignal,
    emit: (event: Omit<RunEvent, "sequence" | "time">) => void,
  ): Promise<RunStatus> {
    await this.ensureFrontend();
    let failed = false;
    let mock: NativeDebugTarget | undefined;
    const capture = async (id: string, placement: "main" | "native") => {
      try {
        emit({
          type: "artifact",
          itemId: id,
          artifact: await this.native.capture(placement),
          text: placement,
        });
      } catch (error) {
        emit({
          type: "log",
          itemId: id,
          text: `Screenshot unavailable (${placement}): ${error}`,
        });
      }
    };
    try {
      for (const item of items.flatMap((item) => item.children ?? [item])) {
        if (signal.aborted) return "cancelled";
        emit({ type: "case", itemId: item.id, status: "running" });
        const start = Date.now();
        const cancel = () => {
          void this.native.stop();
        };
        signal.addEventListener("abort", cancel, { once: true });
        try {
          const scene = scenarioById(item.name!);
          const parameters = { ...DEFAULT_PARAMETERS, count: 3 };
          if (item.target === "native-mock") {
            mock ??= new NativeDebugTarget(this.native, "native-mock");
            await mock.prepare(scene, parameters);
            await mock.apply(
              this.native.state.state === "ready"
                ? this.native.state.generation + 1
                : 1,
            );
          } else {
            if (mock) {
              await mock.dispose();
              mock = undefined;
            }
            await this.native.start("native-service", scene, parameters);
            await this.native.waitReady(signal);
          }
          emit({
            type: "log",
            itemId: item.id,
            text: JSON.stringify({
              source: this.native.state.source,
              generation: this.native.state.generation,
              protocolChecks: await this.native.verifyProtocol(),
            }),
          });
          const result = (await this.native.action("debug.check")) as {
            state?: {
              editors: unknown[];
              sessions: unknown[];
              tabs: unknown[];
            };
          };
          emit({ type: "log", itemId: item.id, text: JSON.stringify(result) });
          if (
            item.target === "native-service" &&
            ["editor", "terminal", "files"].includes(item.name!)
          ) {
            emit({
              type: "log",
              text: JSON.stringify(
                await this.native.action("debug.present", {
                  placement: "native",
                }),
              ),
            });
            await capture(item.id, "native");
            const returned = (await this.native.action("debug.present", {
              placement: "main",
            })) as typeof result;
            if (JSON.stringify(result.state) !== JSON.stringify(returned.state))
              throw new Error(
                `Window round trip changed draft, selection, session or file-pane state: ${JSON.stringify({ before: result.state, after: returned.state })}`,
              );
            emit({
              type: "log",
              itemId: item.id,
              text: "Window round trip preserved draft, selection, session and file-pane state",
            });
          }
          await capture(item.id, "main");
          emit({
            type: "case",
            itemId: item.id,
            status: "passed",
            duration: Date.now() - start,
          });
        } catch (error) {
          failed = true;
          emit({ type: "log", itemId: item.id, text: String(error) });
          emit({
            type: "case",
            itemId: item.id,
            status: signal.aborted ? "cancelled" : "failed",
            duration: Date.now() - start,
          });
          if (mock) {
            await mock.dispose();
            mock = undefined;
          }
        } finally {
          signal.removeEventListener("abort", cancel);
          if (item.target === "native-service") await this.native.stop();
        }
      }
    } finally {
      await this.native.stop();
    }
    return signal.aborted ? "cancelled" : failed ? "failed" : "passed";
  }
}
