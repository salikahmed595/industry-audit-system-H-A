'use strict';
/** An error that maps to an HTTP status and a safe, user-facing message. */
class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra || null;
  }
}
module.exports = { HttpError };
