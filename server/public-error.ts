/** An error whose message is safe to return through the local HTTP API. */
export class PublicError extends Error {
  constructor(
    readonly publicMessage: string,
    readonly status = 400,
  ) {
    super(publicMessage);
    this.name = "PublicError";
  }
}
