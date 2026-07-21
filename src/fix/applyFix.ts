import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { simpleGit, type SimpleGit } from "simple-git";
import { env } from "../config/env.js";

export interface ApplyFixInput {
  repo: string;
  baseBranch: string;
  branchName: string;
  diff: string;
  commitMessage: string;
}

export interface ApplyFixResult {
  branchName: string;
  commitSha: string;
}

function authenticatedCloneUrl(repo: string, token: string): string {
  return `https://x-access-token:${token}@github.com/${repo}.git`;
}

/** Clone repo, apply unified diff on a new branch, commit, and push. */
export async function applyFixToBranch(input: ApplyFixInput): Promise<ApplyFixResult> {
  const token = env.github.token;
  if (!token) {
    throw new Error("GITHUB_TOKEN is not configured");
  }

  const workDir = await mkdtemp(join(tmpdir(), "stitch-fix-"));
  const patchPath = join(workDir, "stitch.patch");

  try {
    await simpleGit().clone(authenticatedCloneUrl(input.repo, token), workDir, [
      "--depth",
      "1",
      "--branch",
      input.baseBranch,
      "--single-branch",
    ]);

    const git: SimpleGit = simpleGit(workDir);
    await git.checkoutLocalBranch(input.branchName);
    await writeFile(patchPath, input.diff, "utf-8");

    try {
      await git.raw(["apply", "--check", patchPath]);
      await git.raw(["apply", patchPath]);
    } catch {
      await git.raw(["apply", "--3way", patchPath]);
    }

    await git.add(".");
    const status = await git.status();
    if (status.files.length === 0) {
      throw new Error("Patch applied but produced no file changes");
    }

    await git.commit(input.commitMessage);
    await git.push("origin", input.branchName, ["--set-upstream"]);

    const commitSha = (await git.revparse(["HEAD"])).trim();
    return { branchName: input.branchName, commitSha };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Appends one more commit onto an already-pushed Stitch branch — used to
 * write the Issue Record markdown file into the repo (Settings → Documentation
 * → "Write Fix log to repo") once the Fix/IssueRecord rows exist and the file's
 * final path (which includes the DB-assigned fixId) is known. Kept as a
 * separate, later commit rather than folding into applyFixToBranch above,
 * since that function runs before a Fix row — and therefore a fixId — exists.
 */
export async function commitFileToBranch(repo: string, branchName: string, filePath: string, content: string, commitMessage: string): Promise<void> {
  const token = env.github.token;
  if (!token) {
    throw new Error("GITHUB_TOKEN is not configured");
  }

  const workDir = await mkdtemp(join(tmpdir(), "stitch-issuefile-"));
  try {
    await simpleGit().clone(authenticatedCloneUrl(repo, token), workDir, ["--depth", "1", "--branch", branchName, "--single-branch"]);
    const git: SimpleGit = simpleGit(workDir);
    const fullPath = join(workDir, filePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf-8");
    await git.add(filePath);
    const status = await git.status();
    if (status.files.length === 0) return;
    await git.commit(commitMessage);
    await git.push("origin", branchName);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
