import { bitbucketPlugin } from "./bitbucket.js";
import { circleciPlugin } from "./circleci.js";
import { githubPlugin } from "./github.js";
import { gitlabPlugin } from "./gitlab.js";
import { jenkinsPlugin } from "./jenkins.js";
import type { CiCdPlugin, PlatformKey } from "./types.js";

/**
 * Single source of truth for "which CI/CD providers exist." The planned
 * Integrations screen (plan section 8.2) reads this list directly — each
 * card is one entry, `isConnected()` drives the Connected/Not connected
 * badge, and connecting a provider is nothing more than populating its
 * config/secrets so `isConnected()` flips to true.
 */
export const PLUGINS: Record<PlatformKey, CiCdPlugin> = {
  github: githubPlugin,
  gitlab: gitlabPlugin,
  circleci: circleciPlugin,
  jenkins: jenkinsPlugin,
  bitbucket: bitbucketPlugin,
};

export function allPlugins(): CiCdPlugin[] {
  return Object.values(PLUGINS);
}

export function connectedPlugins(): CiCdPlugin[] {
  return allPlugins().filter((plugin) => plugin.isConnected());
}

export function pluginFor(key: PlatformKey): CiCdPlugin {
  return PLUGINS[key];
}
