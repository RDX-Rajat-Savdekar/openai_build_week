import type { PlatformKey } from "../platforms/types.js";
import { STITCH_TEST_REPO } from "./testRepo.js";

export interface WorkspaceRepo {
  platform: PlatformKey;
  fullName: string; // "org/name"
  branchPolicy: "default";
}

export interface WorkspaceConfig {
  workspaceId: string;
  notificationChannels: { slack: boolean; email: boolean };
  repos: WorkspaceRepo[];
}

/**
 * Stand-in for a real workspace store (this is a single-tenant demo, not a
 * database-backed multi-tenant one yet). The shape here is what the planned
 * Integrations/Notifications screens (see plan section 8) would read and write.
 */
export const demoWorkspace: WorkspaceConfig = {
  workspaceId: "ws_demo",
  notificationChannels: { slack: true, email: true },
  repos: [
    { platform: "github", fullName: STITCH_TEST_REPO, branchPolicy: "default" },
  ],
};
