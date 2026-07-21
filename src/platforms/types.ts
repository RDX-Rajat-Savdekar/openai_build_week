export type PlatformKey = "github" | "gitlab" | "circleci" | "jenkins" | "bitbucket";

export interface NormalizedFailure {
  platform: PlatformKey;
  repo: string; // "org/name"
  branch: string;
  commitSha: string;
  runId: string;
  logsUrl: string;
  prNumber: number | null;
  triggeredAt: string; // ISO timestamp
}

export interface Diagnosis {
  rootCause: string;
  explanation: string;
  likelyFiles: string[];
}

export interface IncomingRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer | string;
}

/**
 * Every CI/CD provider implements this interface. The rest of the pipeline
 * (branch router, diagnosis, fix generation, notify) only ever talks to a
 * `CiCdPlugin`, never to a provider SDK directly — that's what makes adding
 * a sixth provider a registration, not a rewrite.
 */
export interface CiCdPlugin {
  key: PlatformKey;
  displayName: string;

  /** True when the config/secrets this plugin needs are present. Drives the Integrations screen. */
  isConnected(): boolean;

  /** Verify the inbound webhook signature/secret for this provider. */
  verifyWebhook(req: IncomingRequest): boolean;

  /** Turn a raw provider payload into a NormalizedFailure, or null if it isn't a failure event. */
  normalize(payload: unknown): NormalizedFailure | null;

  fetchLogs(failure: NormalizedFailure): Promise<string>;

  fetchFileContents(failure: NormalizedFailure, paths: string[]): Promise<Record<string, string>>;

  openPr(failure: NormalizedFailure, diagnosis: Diagnosis, diff: string): Promise<{ url: string; number?: number }>;

  commentOnExisting(failure: NormalizedFailure, diagnosis: Diagnosis, diff: string): Promise<{ url: string }>;
}
