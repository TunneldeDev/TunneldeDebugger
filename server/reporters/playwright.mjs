export default class DebuggerReporter {
  onTestEnd(test, result) {
    process.stdout.write(
      `@@TDEBUG@@${JSON.stringify({ text: test.title, status: result.status === "passed" ? "passed" : result.status === "skipped" ? "skipped" : "failed", duration: result.duration })}\n`,
    );
    for (const error of result.errors)
      process.stdout.write(
        `@@TDEBUG@@${JSON.stringify({ type: "log", text: error.stack ?? error.message })}\n`,
      );
  }
  onError(error) {
    process.stdout.write(
      `@@TDEBUG@@${JSON.stringify({ type: "log", text: error.stack ?? error.message })}\n`,
    );
  }
}
