/** Pipeline intentionally skipped — repo disabled, duplicate run, etc. */
export class PipelineSkippedError extends Error {
  readonly code = "PIPELINE_SKIPPED";

  constructor(message: string) {
    super(message);
    this.name = "PipelineSkippedError";
  }
}
