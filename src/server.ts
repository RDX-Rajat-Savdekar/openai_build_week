import { existsSync } from "node:fs";
import path from "node:path";
import express from "express";
import { apiRouter } from "./api.js";
import { authRouter } from "./auth/routes.js";
import { attachUser, requireAuth } from "./auth/middleware.js";
import { getPublicMarketingData } from "./marketing/publicMarketing.js";
import { env, updateEnvSection, type EnvSection } from "./config/env.js";
import { notify } from "./notify/index.js";
import { runPipeline } from "./pipeline/runPipeline.js";
import { PipelineSkippedError } from "./pipeline/errors.js";
import { pluginFor } from "./platforms/registry.js";
import type { PlatformKey } from "./platforms/types.js";
import { routeBranch, type BranchRule } from "./router/branchRouter.js";
import { findOrganizationByRepo, findRepoByFullName, getIntegration, getOrganization } from "./store/appStore.js";

const app = express();
const frontendDist = path.resolve(process.cwd(), "frontend/dist");
const hasFrontend = existsSync(path.join(frontendDist, "index.html"));

if (!hasFrontend) {
  console.warn(
    "[stitch] frontend/dist not found — the API will still work, but the SPA won't be served.\n" +
      "[stitch] Run `npm run frontend:build` for a production build, or `npm run dev` for the Vite dev server on :5173.",
  );
}

const WEB_DEV_ORIGIN = "http://localhost:5173";

app.use((req, res, next) => {
  if (req.headers.origin === WEB_DEV_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", WEB_DEV_ORIGIN);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.use("/media", express.static(path.resolve(process.cwd(), "media")));

app.use("/api", express.json());
app.use("/api", attachUser);
app.use("/api/auth", authRouter);

app.get("/api/public/marketing", async (_req, res) => {
  try {
    res.json(await getPublicMarketingData());
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load marketing data" });
  }
});

app.post("/api/public/contact", (req, res) => {
  const body = (req.body ?? {}) as { name?: string; email?: string; topic?: string; message?: string };
  if (!body.name?.trim() || !body.email?.trim() || !body.message?.trim()) {
    res.status(400).json({ error: "Name, email, and message are required" });
    return;
  }
  console.log(`[stitch] contact form — ${body.email} (${body.topic ?? "General"}): ${body.message.slice(0, 120)}…`);
  res.json({ ok: true, receivedAt: new Date().toISOString() });
});

app.use("/api", requireAuth, apiRouter);

app.post("/webhooks/:platform", express.raw({ type: "*/*" }), async (req, res) => {
  const platformKey = req.params.platform as PlatformKey;
  const plugin = pluginFor(platformKey);
  if (!plugin) {
    res.status(404).json({ error: `unknown platform: ${platformKey}` });
    return;
  }

  const rawBody = req.body as Buffer;
  const incoming = { headers: req.headers as Record<string, string | string[] | undefined>, rawBody };

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf-8"));
  } catch {
    res.status(400).json({ error: "invalid JSON body" });
    return;
  }

  const failure = plugin.normalize(payload);
  if (!failure) {
    res.status(200).json({ ignored: true });
    return;
  }

  // Multi-tenant routing: figure out which organization owns this repo before
  // trusting the payload, then verify the webhook signature using THAT org's
  // stored secret (not a single global one) — see appStore.findOrganizationByRepo.
  const org = await findOrganizationByRepo(failure.repo);
  if (!org) {
    res.status(404).json({ error: `${failure.repo} is not connected to any Stitch workspace` });
    return;
  }

  const repoRow = await findRepoByFullName(org.id, failure.repo);
  if (repoRow && !repoRow.enabled) {
    res.status(200).json({ ignored: true, reason: "repo_disabled", repo: failure.repo });
    return;
  }

  const integration = await getIntegration(org.id, platformKey);
  if (integration?.config && Object.keys(integration.config as object).length > 0) {
    updateEnvSection(platformKey as EnvSection, integration.config as Record<string, string>);
  }

  if (!plugin.verifyWebhook(incoming)) {
    res.status(401).json({ error: "webhook verification failed" });
    return;
  }

  const orgPrefs = ((await getOrganization(org.id)).preferences as Record<string, unknown>) ?? {};
  const branchRules = orgPrefs.branchRules as BranchRule[] | undefined;
  const responseBehavior = (orgPrefs.responseBehavior as { defaultMode?: string } | undefined) ?? {};
  const behavior = routeBranch(failure.branch, {
    customRules: branchRules,
    repoDefaultMode: repoRow?.mode,
    projectDefaultMode: repoRow?.project?.defaultMode,
    orgDefaultMode: responseBehavior.defaultMode,
  });
  res.status(202).json({ accepted: true, mode: behavior.mode, branch: failure.branch });

  void (async () => {
    try {
      const result = await runPipeline(org.id, plugin, failure);
      console.log(`[stitch] pipeline complete fix #${result.fixId} (${result.action})`);
    } catch (error) {
      if (error instanceof PipelineSkippedError) {
        console.log(`[stitch] pipeline skipped for ${failure.repo}@${failure.branch}: ${error.message}`);
        return;
      }
      console.error(`[stitch] pipeline failed for ${failure.repo}@${failure.branch}:`, error);
      await notify({
        type: "diagnosis_failed",
        repo: failure.repo,
        branch: failure.branch,
        summary: error instanceof Error ? error.message : "unknown error",
        url: failure.logsUrl,
        urgent: behavior.urgent,
      }).catch((notifyError) => console.error("[stitch] notify also failed:", notifyError));
    }
  })();
});

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    openai: Boolean(env.openaiApiKey),
    anthropic: Boolean(env.anthropicApiKey),
    github: pluginFor("github").isConnected(),
    frontend: hasFrontend,
    uiDev: "http://localhost:5173",
  });
});

if (!hasFrontend) {
  app.get("/", (_req, res) => {
    res.json({
      service: "Stitch API",
      message: "API only on this port — open the UI at http://localhost:5173",
      api: "/api",
      health: "/healthz",
      ui: "http://localhost:5173",
    });
  });
}

if (hasFrontend) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/webhooks") || req.path === "/healthz") {
      next();
      return;
    }
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

const server = app.listen(env.port, () => {
  console.log("");
  console.log("[stitch] ── dev split ─────────────────────────────────────");
  console.log(`[stitch] API only  →  http://localhost:${env.port}/api`);
  console.log(`[stitch] Health     →  http://localhost:${env.port}/healthz`);
  if (hasFrontend) {
    console.log(`[stitch] UI (prod)  →  http://localhost:${env.port}/`);
  } else {
    console.log(`[stitch] UI (dev)   →  http://localhost:5173  ← open this in the browser`);
    console.log(`[stitch] (run \`npm run dev:web\` in another terminal if :5173 is down)`);
  }
  console.log("[stitch] ────────────────────────────────────────────────────");
  console.log("");
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[stitch] Port ${env.port} is already in use — stop the other process or set PORT in .env`);
    process.exit(1);
  }
  throw err;
});
