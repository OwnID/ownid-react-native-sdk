import type { OwnIDLogEntry } from './index';

/** Records SDK diagnostics using independent local and server logging thresholds. */
export interface OwnIdLogRouter {
  /** Records a diagnostic; logging and delivery failures do not interrupt the caller. */
  log(
    level: OwnIDLogEntry['level'],
    /** SDK component that produced the diagnostic. */
    source: string,
    /** Human-readable description; an empty string is valid. */
    message: string,
    /** Original error or value associated with the diagnostic, when available. */
    cause?: unknown
  ): void;
}
