const send = (event) =>
  process.stdout.write(`@@TDEBUG@@${JSON.stringify(event)}\n`);
export default class DebuggerReporter {
  onTestCaseResult(test) {
    const result = test.result();
    send({
      text: test.fullName,
      status:
        result.state === "passed"
          ? "passed"
          : result.state === "skipped"
            ? "skipped"
            : "failed",
      duration: test.diagnostic()?.duration,
    });
    for (const error of result.errors ?? [])
      send({ type: "log", text: error.stack ?? error.message });
  }
  onUserConsoleLog(log) {
    send({ type: "log", text: log.content });
  }
  onFinished(_files, errors) {
    for (const error of errors ?? [])
      send({ type: "log", text: error.stack ?? error.message });
  }
}
