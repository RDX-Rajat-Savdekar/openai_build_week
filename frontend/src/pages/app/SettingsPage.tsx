import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/AppLayout";
import { IntegrationsPanel } from "@/components/integrations/IntegrationsPanel";
import { NotificationsPanel } from "@/components/integrations/NotificationsPanel";
import { TicketingPanel } from "@/components/ticketing/TicketingPanel";
import { TeamPanel } from "@/components/team/TeamPanel";
import { Badge, ModeBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Card, CardSub, CardTitle } from "@/components/ui/Card";
import { Field, Toggle, inputClass, selectClass } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Modal";
import { usePermissions } from "@/context/PermissionsContext";
import {
  DEMO_REPOS,
  NOTIFICATION_TRIGGERS,
  SETTINGS_SECTIONS,
} from "@/data/demoContent";
import {
  api,
  type AiProvider,
  type AiSettingsResponse,
  type BillingData,
  type BranchRule,
  type DocumentationPreferences,
  type Project,
  type PullRequestPreferences,
  type ResponseBehavior,
  type RollbackPreferences,
  type SecurityPreferences,
  type TicketingPreferences,
  type UiModeLabel,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { canEditSettingsSection, canViewSettingsSection } from "@/lib/settingsAccess";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

const UI_MODE_LABELS: UiModeLabel[] = ["Autopilot", "Fix & propose", "Diagnose & suggest", "Silent audit", "Notify only"];

function EditableSection({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  return (
    <fieldset disabled={disabled} className={cn("min-w-0 border-0 p-0 m-0", disabled && "opacity-75")}>
      {children}
    </fieldset>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { can, isAdmin } = usePermissions();
  const [section, setSection] = useState("integrations");

  const [openaiOk, setOpenaiOk] = useState(false);
  const [anthropicOk, setAnthropicOk] = useState(false);
  const [geminiOk, setGeminiOk] = useState(false);
  const [copilotOk, setCopilotOk] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [copilotKey, setCopilotKey] = useState("");
  const [copilotEndpoint, setCopilotEndpoint] = useState("");
  const [copilotDeployment, setCopilotDeployment] = useState("gpt-4o-mini");
  const [diagnosisProvider, setDiagnosisProvider] = useState<AiProvider>("openai");
  const [diagnosisModel, setDiagnosisModel] = useState("gpt-4o-mini");
  const [fixProvider, setFixProvider] = useState<AiProvider>("openai");
  const [fixModel, setFixModel] = useState("gpt-4o");
  const [modelCatalog, setModelCatalog] = useState<AiSettingsResponse["catalog"]>({
    openai: [
      { id: "gpt-4o", label: "GPT-4o (recommended)" },
      { id: "gpt-4o-mini", label: "GPT-4o mini (fast, lower cost)" },
    ],
    anthropic: [
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (recommended)" },
      { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
    ],
    gemini: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (recommended)" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    ],
    copilot: [
      { id: "gpt-4o", label: "gpt-4o deployment" },
      { id: "gpt-4o-mini", label: "gpt-4o-mini deployment" },
    ],
  });
  const [maxDiffSize, setMaxDiffSize] = useState(500);
  const [quotaExceeded, setQuotaExceeded] = useState("diagnose");
  const [billing, setBilling] = useState<BillingData | null>(null);

  const [ticketingPrefs, setTicketingPrefs] = useState<TicketingPreferences | null>(null);
  const [responseBehavior, setResponseBehavior] = useState<ResponseBehavior | null>(null);
  const [rollbackPrefs, setRollbackPrefs] = useState<RollbackPreferences | null>(null);
  const [prPrefs, setPrPrefs] = useState<PullRequestPreferences | null>(null);
  const [prLabelsInput, setPrLabelsInput] = useState("");
  const [docPrefs, setDocPrefs] = useState<DocumentationPreferences | null>(null);
  const [securityPrefs, setSecurityPrefs] = useState<SecurityPreferences | null>(null);
  const [ipAllowlistInput, setIpAllowlistInput] = useState("");

  const [repos, setRepos] = useState(DEMO_REPOS);
  const [projects, setProjects] = useState<Project[]>([]);
  const [branchRules, setBranchRules] = useState<BranchRule[]>([]);
  const [workspace, setWorkspace] = useState<{ name: string; user: { id: string; name: string; email: string; role: string } | null }>({ name: "", user: null });
  const [apiKeyPreview, setApiKeyPreview] = useState<string | null>(null);
  const [revealedApiKey, setRevealedApiKey] = useState<string | null>(null);
  const toast = useToast();

  const visibleSections = useMemo(
    () => SETTINGS_SECTIONS.filter((s) => canViewSettingsSection(s.id, can, isAdmin)),
    [can, isAdmin],
  );
  const canEdit = canEditSettingsSection(section, can, isAdmin);
  const canExport = can("export_data");

  useEffect(() => {
    const q = searchParams.get("section");
    if (q && visibleSections.some((s) => s.id === q)) {
      setSection(q);
    }
  }, [searchParams, visibleSections]);

  useEffect(() => {
    if (!visibleSections.some((s) => s.id === section)) {
      setSection(visibleSections[0]?.id ?? "integrations");
    }
  }, [visibleSections, section]);

  const loadSettings = () =>
    api.aiModels().then((s) => {
      setOpenaiOk(s.openaiConfigured);
      setAnthropicOk(s.anthropicConfigured);
      setGeminiOk(s.geminiConfigured);
      setCopilotOk(s.copilotConfigured);
      setAiConfigured(s.aiConfigured);
      setDiagnosisProvider(s.diagnosisProvider);
      setDiagnosisModel(s.diagnosisModel);
      setFixProvider(s.fixProvider);
      setFixModel(s.fixModel);
      setCopilotEndpoint(s.copilotEndpoint ?? "");
      setCopilotDeployment(s.copilotDeployment ?? "gpt-4o-mini");
      setMaxDiffSize(s.maxDiffSize);
      setQuotaExceeded(s.quotaExceeded);
      setModelCatalog(s.catalog);
    }).catch(() =>
      api.settings().then((s) => {
        setOpenaiOk(s.openaiConfigured);
        setAnthropicOk(s.anthropicConfigured ?? false);
        setGeminiOk(s.geminiConfigured ?? false);
        setCopilotOk(s.copilotConfigured ?? false);
        setAiConfigured(s.aiConfigured ?? s.openaiConfigured);
        setDiagnosisProvider(s.diagnosisProvider ?? "openai");
        setDiagnosisModel(s.diagnosisModel);
        setFixProvider(s.fixProvider ?? "openai");
        setFixModel(s.fixModel);
        setCopilotEndpoint(s.copilotEndpoint ?? "");
        setCopilotDeployment(s.copilotDeployment ?? "gpt-4o-mini");
        setMaxDiffSize(s.maxDiffSize);
        setQuotaExceeded(s.quotaExceeded);
        if (s.catalog) setModelCatalog(s.catalog);
      }).catch(() => {}),
    );

  const loadRepos = () => api.repos().then(setRepos).catch(() => {});

  useEffect(() => {
    loadSettings();
    api.ticketingPreferences().then(setTicketingPrefs).catch(() => {});
    api.responseBehavior().then(setResponseBehavior).catch(() => {});
    api.rollbackPrefs().then(setRollbackPrefs).catch(() => {});
    api.pullRequestPrefs().then((p) => {
      setPrPrefs(p);
      setPrLabelsInput(p.labels.join(", "));
    }).catch(() => {});
    api.documentationPrefs().then(setDocPrefs).catch(() => {});
    api.securityPrefs().then((s) => {
      setSecurityPrefs(s);
      setIpAllowlistInput(s.ipAllowlist);
    }).catch(() => {});
    api.branchRules().then((r) => setBranchRules(r.rules)).catch(() => {});
    loadRepos();
    api.projects().then(setProjects).catch(() => {});
    api.workspace().then(setWorkspace).catch(() => {});
    if (isAdmin) api.apiKey().then((r) => setApiKeyPreview(r.preview)).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (section === "billing" && can("manage_billing")) {
      api.billing().then(setBilling).catch((e) => toast.show(e instanceof Error ? e.message : "Failed to load billing", false));
    }
  }, [section, can, toast]);

  const removeRepo = async (repo: string) => {
    try {
      await api.deleteRepo(repo);
      toast.show(`${repo} removed`);
      loadRepos();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Remove failed", false);
    }
  };
  const addRepo = async () => {
    const name = window.prompt("Repository (owner/name)");
    if (!name) return;
    try {
      await api.createRepo({ repo: name, provider: "GitHub", mode: "Diagnose & suggest", project: projects[0]?.id });
      toast.show(`${name} added`);
      loadRepos();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Add failed", false);
    }
  };
  const moveRepoProject = async (repo: string, project: string) => {
    try {
      await api.updateRepo(repo, { project });
      toast.show("Repository moved");
      loadRepos();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Move failed", false);
    }
  };
  const updateRepoMode = async (repo: string, mode: string) => {
    try {
      await api.updateRepo(repo, { mode });
      toast.show(`${repo} mode updated`);
      loadRepos();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Update failed", false);
    }
  };
  const toggleRepoEnabled = async (repo: string, enabled: boolean) => {
    try {
      await api.updateRepo(repo, { enabled });
      loadRepos();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Update failed", false);
    }
  };
  const saveBranchRules = async (rules: BranchRule[]) => {
    try {
      const result = await api.saveBranchRules(rules);
      setBranchRules(result.rules);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Save failed", false);
    }
  };
  const removeBranchRule = (pattern: string) => saveBranchRules(branchRules.filter((x) => x.pattern !== pattern));
  const addBranchRule = () => {
    const pattern = window.prompt("Branch pattern — comma-separate literal names (main, master) or end with * for a prefix (release/*)");
    if (!pattern?.trim()) return;
    saveBranchRules([...branchRules, { pattern: pattern.trim(), mode: "Diagnose & suggest" }]);
  };
  const updateBranchRuleMode = (pattern: string, mode: UiModeLabel) =>
    saveBranchRules(branchRules.map((r) => (r.pattern === pattern ? { ...r, mode } : r)));

  const saveResponseBehavior = async (patch: Partial<ResponseBehavior>) => {
    try {
      const updated = await api.saveResponseBehavior(patch);
      setResponseBehavior(updated);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Save failed", false);
    }
  };

  const savePrPrefs = async (patch: Partial<PullRequestPreferences>) => {
    try {
      const updated = await api.savePullRequestPrefs(patch);
      setPrPrefs(updated);
      if (patch.labels) setPrLabelsInput(updated.labels.join(", "));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Save failed", false);
    }
  };

  const saveDocPrefs = async (patch: Partial<DocumentationPreferences>) => {
    try {
      const updated = await api.saveDocumentationPrefs(patch);
      setDocPrefs(updated);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Save failed", false);
    }
  };

  const saveSecurityPrefs = async (patch: Partial<SecurityPreferences>) => {
    try {
      const updated = await api.saveSecurityPrefs(patch);
      setSecurityPrefs(updated);
      if (patch.ipAllowlist !== undefined) setIpAllowlistInput(updated.ipAllowlist);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Save failed", false);
    }
  };

  const saveRollbackPrefs = async (patch: Partial<RollbackPreferences>) => {
    try {
      const updated = await api.saveRollbackPrefs(patch);
      setRollbackPrefs(updated);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Save failed", false);
    }
  };

  const saveTicketingPrefs = async (patch: Partial<TicketingPreferences>) => {
    try {
      const updated = await api.saveTicketingPreferences(patch);
      setTicketingPrefs(updated);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Save failed", false);
    }
  };

  const regenerateApiKey = async () => {
    if (!confirm("Regenerate the API key? Anything using the old key will stop working.")) return;
    try {
      const { key, preview } = await api.regenerateApiKey();
      setRevealedApiKey(key);
      setApiKeyPreview(preview);
      toast.show("New API key generated — copy it now, it won't be shown again");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Regenerate failed", false);
    }
  };
  const copyApiKey = () => {
    if (!revealedApiKey) return;
    navigator.clipboard.writeText(revealedApiKey).then(() => toast.show("API key copied"));
  };
  const disconnectAll = async () => {
    if (!confirm("Disconnect every integration for this workspace?")) return;
    await api.disconnectAllIntegrations();
    toast.show("All integrations disconnected");
  };
  const exportData = async () => {
    try {
      const data = await api.exportWorkspaceData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "stitch-export.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.show("Export downloaded");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Export failed", false);
    }
  };
  const deleteWorkspace = async () => {
    if (!confirm("Permanently delete this workspace? This cannot be undone.")) return;
    try {
      await api.deleteWorkspace();
      navigate("/");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Delete failed", false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Workspace configuration — sections shown match your role's permissions." />
      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="flex max-h-[70vh] flex-row gap-2 overflow-x-auto lg:w-52 lg:flex-col lg:overflow-y-auto">
          {visibleSections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors",
                section === s.id ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-accent-soft",
                s.id === "danger" && section !== "danger" && "text-critical",
              )}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 space-y-4">
          {!canEdit && section !== "team" && (
            <Callout>View-only on this section — your role can't change these settings.</Callout>
          )}
          {section === "models" && (
            <Card>
              <CardTitle>AI models & API keys</CardTitle>
              <CardSub>
                Multi-provider — pick OpenAI, Claude, Gemini, or Copilot (Azure OpenAI) per task. Test buttons work with
                pasted keys before save. Credentials apply immediately for this workspace session (stored in PostgreSQL,
                not written to <code className="rounded bg-code-bg px-1">.env</code>).
              </CardSub>
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Field label="OpenAI API key" hint={openaiOk ? "Key saved — enter a new value to replace" : "Optional if using another provider"}>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="password"
                        className={inputClass}
                        placeholder={openaiOk ? "Enter new key to replace…" : "sk-…"}
                        value={openaiKey}
                        onChange={(e) => setOpenaiKey(e.target.value)}
                        autoComplete="off"
                      />
                      <Badge tone={openaiOk ? "good" : "neutral"}>{openaiOk ? "Configured" : "Not set"}</Badge>
                    </div>
                  </Field>
                  <Field label="Anthropic API key (Claude)" hint={anthropicOk ? "Key saved — enter a new value to replace" : "Optional if using another provider"}>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="password"
                        className={inputClass}
                        placeholder={anthropicOk ? "Enter new key to replace…" : "sk-ant-…"}
                        value={anthropicKey}
                        onChange={(e) => setAnthropicKey(e.target.value)}
                        autoComplete="off"
                      />
                      <Badge tone={anthropicOk ? "good" : "neutral"}>{anthropicOk ? "Configured" : "Not set"}</Badge>
                    </div>
                  </Field>
                  <Field label="Google Gemini API key" hint={geminiOk ? "Key saved — enter a new value to replace" : "From Google AI Studio"}>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="password"
                        className={inputClass}
                        placeholder={geminiOk ? "Enter new key to replace…" : "AIza…"}
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        autoComplete="off"
                      />
                      <Badge tone={geminiOk ? "good" : "neutral"}>{geminiOk ? "Configured" : "Not set"}</Badge>
                    </div>
                  </Field>
                  <Field label="Microsoft Copilot (Azure OpenAI) API key" hint={copilotOk ? "Key saved — enter a new value to replace" : "Azure resource key"}>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="password"
                        className={inputClass}
                        placeholder={copilotOk ? "Enter new key to replace…" : "Azure api-key…"}
                        value={copilotKey}
                        onChange={(e) => setCopilotKey(e.target.value)}
                        autoComplete="off"
                      />
                      <Badge tone={copilotOk ? "good" : "neutral"}>{copilotOk ? "Configured" : "Not set"}</Badge>
                    </div>
                  </Field>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Field label="Azure OpenAI endpoint" hint="e.g. https://your-resource.openai.azure.com">
                    <input
                      className={inputClass}
                      placeholder="https://…openai.azure.com"
                      value={copilotEndpoint}
                      onChange={(e) => setCopilotEndpoint(e.target.value)}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Default Azure deployment" hint="Used for Test Copilot and as fallback deployment name">
                    <input
                      className={inputClass}
                      placeholder="gpt-4o-mini"
                      value={copilotDeployment}
                      onChange={(e) => setCopilotDeployment(e.target.value)}
                      autoComplete="off"
                    />
                  </Field>
                </div>

                <div className="rounded-stitch border border-border bg-panel-2/50 p-4">
                  <CardTitle className="!mb-3 !text-sm">Diagnosis step</CardTitle>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Provider">
                      <select
                        className={selectClass}
                        value={diagnosisProvider}
                        onChange={(e) => {
                          const provider = e.target.value as AiProvider;
                          setDiagnosisProvider(provider);
                          const first = modelCatalog[provider][0]?.id;
                          if (first) setDiagnosisModel(first);
                        }}
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic (Claude)</option>
                        <option value="gemini">Google Gemini</option>
                        <option value="copilot">Microsoft Copilot (Azure)</option>
                      </select>
                    </Field>
                    <Field label="Model">
                      <select className={selectClass} value={diagnosisModel} onChange={(e) => setDiagnosisModel(e.target.value)}>
                        {modelCatalog[diagnosisProvider].map((m) => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>

                <div className="rounded-stitch border border-border bg-panel-2/50 p-4">
                  <CardTitle className="!mb-3 !text-sm">Fix generation step</CardTitle>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Provider">
                      <select
                        className={selectClass}
                        value={fixProvider}
                        onChange={(e) => {
                          const provider = e.target.value as AiProvider;
                          setFixProvider(provider);
                          const first = modelCatalog[provider][0]?.id;
                          if (first) setFixModel(first);
                        }}
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic (Claude)</option>
                        <option value="gemini">Google Gemini</option>
                        <option value="copilot">Microsoft Copilot (Azure)</option>
                      </select>
                    </Field>
                    <Field label="Model">
                      <select className={selectClass} value={fixModel} onChange={(e) => setFixModel(e.target.value)}>
                        {modelCatalog[fixProvider].map((m) => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Max diff size per fix">
                    <select className={selectClass} value={String(maxDiffSize)} onChange={(e) => setMaxDiffSize(Number(e.target.value))}>
                      <option value="200">200 lines</option>
                      <option value="500">500 lines</option>
                      <option value="1000">1,000 lines</option>
                    </select>
                  </Field>
                  <Field label="If quota is exceeded">
                    <select className={selectClass} value={quotaExceeded} onChange={(e) => setQuotaExceeded(e.target.value)}>
                      <option value="diagnose">Diagnose only (skip the fix)</option>
                      <option value="queue">Queue and retry</option>
                      <option value="skip">Notify and skip entirely</option>
                    </select>
                  </Field>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    variant="solid"
                    size="sm"
                    disabled={!canEdit}
                    onClick={async () => {
                      try {
                        const saved = await api.saveAiModels({
                          openaiApiKey: openaiKey.trim() || undefined,
                          anthropicApiKey: anthropicKey.trim() || undefined,
                          geminiApiKey: geminiKey.trim() || undefined,
                          copilotApiKey: copilotKey.trim() || undefined,
                          copilotEndpoint: copilotEndpoint.trim() || undefined,
                          copilotDeployment: copilotDeployment.trim() || undefined,
                          diagnosisProvider,
                          diagnosisModel,
                          fixProvider,
                          fixModel,
                          maxDiffSize,
                          quotaExceeded,
                        });
                        setOpenaiOk(saved.openaiConfigured);
                        setAnthropicOk(saved.anthropicConfigured);
                        setGeminiOk(saved.geminiConfigured);
                        setCopilotOk(saved.copilotConfigured);
                        setAiConfigured(saved.aiConfigured);
                        setOpenaiKey("");
                        setAnthropicKey("");
                        setGeminiKey("");
                        setCopilotKey("");
                        setModelCatalog(saved.catalog);
                        if (saved.copilotEndpoint) setCopilotEndpoint(saved.copilotEndpoint);
                        if (saved.copilotDeployment) setCopilotDeployment(saved.copilotDeployment);
                        toast.show("AI settings saved");
                      } catch (e) {
                        toast.show(e instanceof Error ? e.message : "Save failed", false);
                      }
                    }}
                  >
                    Save all
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canEdit || (!openaiOk && !openaiKey.trim())}
                    onClick={async () => {
                      try {
                        const result = await api.testAiProvider("openai", {
                          apiKey: openaiKey.trim() || undefined,
                        });
                        toast.show(result.message ?? "OpenAI connection verified");
                      } catch (e) {
                        toast.show(e instanceof Error ? e.message : "OpenAI test failed", false);
                      }
                    }}
                  >
                    Test OpenAI
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canEdit || (!anthropicOk && !anthropicKey.trim())}
                    onClick={async () => {
                      try {
                        const result = await api.testAiProvider("anthropic", {
                          apiKey: anthropicKey.trim() || undefined,
                        });
                        toast.show(result.message ?? "Claude connection verified");
                      } catch (e) {
                        toast.show(e instanceof Error ? e.message : "Claude test failed", false);
                      }
                    }}
                  >
                    Test Claude
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canEdit || (!geminiOk && !geminiKey.trim())}
                    onClick={async () => {
                      try {
                        const result = await api.testAiProvider("gemini", {
                          apiKey: geminiKey.trim() || undefined,
                          model: diagnosisProvider === "gemini" ? diagnosisModel : "gemini-2.0-flash",
                        });
                        toast.show(result.message ?? "Gemini connection verified");
                      } catch (e) {
                        toast.show(e instanceof Error ? e.message : "Gemini test failed", false);
                      }
                    }}
                  >
                    Test Gemini
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={
                      !canEdit ||
                      ((!copilotOk && !copilotKey.trim()) || (!copilotEndpoint.trim() && !copilotOk))
                    }
                    onClick={async () => {
                      try {
                        const result = await api.testAiProvider("copilot", {
                          apiKey: copilotKey.trim() || undefined,
                          endpoint: copilotEndpoint.trim() || undefined,
                          deployment:
                            (diagnosisProvider === "copilot" ? diagnosisModel : undefined) ||
                            copilotDeployment.trim() ||
                            undefined,
                        });
                        toast.show(result.message ?? "Copilot connection verified");
                      } catch (e) {
                        toast.show(e instanceof Error ? e.message : "Copilot test failed", false);
                      }
                    }}
                  >
                    Test Copilot
                  </Button>
                  {openaiOk && (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={!canEdit}
                      onClick={async () => {
                        const saved = await api.disconnectAiProvider("openai");
                        setOpenaiOk(saved.openaiConfigured);
                        setAiConfigured(saved.aiConfigured);
                        setOpenaiKey("");
                        toast.show("OpenAI key cleared");
                      }}
                    >
                      Clear OpenAI
                    </Button>
                  )}
                  {anthropicOk && (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={!canEdit}
                      onClick={async () => {
                        const saved = await api.disconnectAiProvider("anthropic");
                        setAnthropicOk(saved.anthropicConfigured);
                        setAiConfigured(saved.aiConfigured);
                        setAnthropicKey("");
                        toast.show("Anthropic key cleared");
                      }}
                    >
                      Clear Claude
                    </Button>
                  )}
                  {geminiOk && (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={!canEdit}
                      onClick={async () => {
                        const saved = await api.disconnectAiProvider("gemini");
                        setGeminiOk(saved.geminiConfigured);
                        setAiConfigured(saved.aiConfigured);
                        setGeminiKey("");
                        toast.show("Gemini key cleared");
                      }}
                    >
                      Clear Gemini
                    </Button>
                  )}
                  {copilotOk && (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={!canEdit}
                      onClick={async () => {
                        const saved = await api.disconnectAiProvider("copilot");
                        setCopilotOk(saved.copilotConfigured);
                        setAiConfigured(saved.aiConfigured);
                        setCopilotKey("");
                        setCopilotEndpoint("");
                        toast.show("Copilot settings cleared");
                      }}
                    >
                      Clear Copilot
                    </Button>
                  )}
                </div>
                <Callout>
                  Diagnosis and fix generation stay <b>two separate calls</b> — you can mix providers (e.g. Claude
                  diagnosis + OpenAI fix). Status:{" "}
                  <Badge tone={aiConfigured ? "good" : "warn"} className="ml-1">
                    {aiConfigured ? "Live AI ready" : "Demo fallback until a provider key is saved"}
                  </Badge>
                </Callout>
              </div>
            </Card>
          )}

          {section === "response" && responseBehavior && (
            <Card>
              <CardTitle>Response behavior</CardTitle>
              <CardSub>Five trust levels — the branch router (below) picks one of these per branch pattern.</CardSub>
              <EditableSection disabled={!canEdit}>
              <div className="mt-4 space-y-2">
                {UI_MODE_LABELS.map((m) => (
                  <div key={m} className="flex justify-between rounded-lg border border-border p-3 text-sm">
                    <ModeBadge mode={m} />
                    <span className="text-muted text-xs max-w-[60%] text-right">
                      {m === "Autopilot" && "Diagnose → fix → PR → auto-merge"}
                      {m === "Fix & propose" && "Writes fix, human approves merge"}
                      {m === "Diagnose & suggest" && "Comment on PR with suggestion"}
                      {m === "Silent audit" && "Log only, no code changes"}
                      {m === "Notify only" && "Alert only, no automation"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Default mode" hint="Used when a branch matches no rule below and the repo has no override">
                  <select
                    className={selectClass}
                    value={responseBehavior.defaultMode}
                    onChange={(e) => saveResponseBehavior({ defaultMode: e.target.value as UiModeLabel })}
                  >
                    {UI_MODE_LABELS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Confidence floor" hint="Below this, a fix always escalates for human review">
                  <select
                    className={selectClass}
                    value={String(responseBehavior.confidenceFloor)}
                    onChange={(e) => saveResponseBehavior({ confidenceFloor: Number(e.target.value) })}
                  >
                    <option value="50">50%</option>
                    <option value="70">70%</option>
                    <option value="90">90%</option>
                  </select>
                </Field>
                <Field label="Auto-merge delay" hint="Recorded, not yet enforced — auto-merge fires immediately today">
                  <select
                    className={selectClass}
                    value={String(responseBehavior.autoMergeDelay)}
                    onChange={(e) => saveResponseBehavior({ autoMergeDelay: Number(e.target.value) })}
                  >
                    <option value="0">0 min</option>
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="60">1 hr</option>
                  </select>
                </Field>
                <Field label="Required approvers before merge" hint="Recorded, not yet enforced">
                  <select
                    className={selectClass}
                    value={String(responseBehavior.requiredApprovers)}
                    onChange={(e) => saveResponseBehavior({ requiredApprovers: Number(e.target.value) })}
                  >
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </Field>
                <Field label="Max PRs / hour" hint="Recorded, not yet enforced">
                  <select
                    className={selectClass}
                    value={String(responseBehavior.maxPrsPerHour)}
                    onChange={(e) => saveResponseBehavior({ maxPrsPerHour: Number(e.target.value) })}
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                  </select>
                </Field>
                <div className="flex items-end">
                  <Toggle
                    checked={responseBehavior.respectWorkingHours}
                    label="Respect working hours"
                    onChange={(v) => saveResponseBehavior({ respectWorkingHours: v })}
                  />
                </div>
              </div>
              </EditableSection>
              <Callout>
                <b>Real today:</b> Default mode and Confidence floor directly drive every pipeline run — see Branch rules below for per-pattern overrides, and Repositories for a per-repo override. Auto-merge delay, required approvers, max PRs/hour, and working-hours awareness are saved here but not yet enforced by the pipeline (no queue/scheduler exists yet to hold a PR before merging).
              </Callout>
            </Card>
          )}

          {section === "branches" && (
            <Card>
              <CardTitle>Branch rules</CardTitle>
              <CardSub>Pattern-matched overrides of the default mode, evaluated top to bottom — real: this list directly drives the pipeline for this workspace.</CardSub>
              <EditableSection disabled={!canEdit}>
              <div className="mt-4 space-y-2">
                {branchRules.map((r) => (
                  <div key={r.pattern} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                    <code className="rounded bg-code-bg px-1.5">{r.pattern}</code>
                    <div className="flex items-center gap-2">
                      <select
                        className="rounded-lg border border-border bg-panel-2 px-2 py-1 text-xs"
                        value={r.mode}
                        onChange={(e) => updateBranchRuleMode(r.pattern, e.target.value as UiModeLabel)}
                      >
                        {UI_MODE_LABELS.map((m) => <option key={m}>{m}</option>)}
                      </select>
                      <Button variant="ghost" size="sm" onClick={() => removeBranchRule(r.pattern)}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="mt-4" onClick={addBranchRule}>+ Add rule</Button>
              </EditableSection>
              <Callout className="mt-4">
                Patterns: comma-separate literal branch names (<code>main, master</code>) or end with <code>*</code> for a prefix (<code>release/*</code>). The first matching rule wins; a repo's own mode (Settings → Repositories) applies when nothing here matches, then the Default mode above.
              </Callout>
            </Card>
          )}

          {section === "rollback" && rollbackPrefs && (
            <Card>
              <CardTitle>Rollback & safety</CardTitle>
              <CardSub>
                Auto-revert and revert-window settings are enforced by the pipeline. Who can revert is controlled per role in{" "}
                <Link to="/app/roles" className="font-bold text-accent">Roles & permissions</Link> (`Revert a merged fix`).
              </CardSub>
              <EditableSection disabled={!canEdit}>
              <div className="mt-4 space-y-4">
                <Toggle
                  checked={rollbackPrefs.autoRevertOnRepeatFailure}
                  label="Auto-revert on repeat failure"
                  onChange={(v) => saveRollbackPrefs({ autoRevertOnRepeatFailure: v })}
                />
                <Field label="Revert window">
                  <select
                    className={selectClass}
                    value={String(rollbackPrefs.revertWindowMinutes)}
                    onChange={(e) => saveRollbackPrefs({ revertWindowMinutes: Number(e.target.value) })}
                  >
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="1440">24 hours</option>
                  </select>
                </Field>
                <Toggle
                  checked={rollbackPrefs.revertRequiresReason}
                  label="Revert requires reason"
                  onChange={(v) => saveRollbackPrefs({ revertRequiresReason: v })}
                />
              </div>
              </EditableSection>
              <Callout>
                <b>Auto-revert on repeat failure</b> reverts an auto-merged fix if CI fails again on the same repo + branch within the window above. Manual reverts require the <b>Revert a merged fix</b> permission from Roles & permissions.
              </Callout>
            </Card>
          )}

          {section === "integrations" && <IntegrationsPanel />}

          {section === "repos" && (
            <Card>
              <CardTitle>Repositories</CardTitle>
              <CardSub>
                Every repo visible under a connected provider, with its response mode, branch policy, and{" "}
                <Link to="/app/projects" className="font-bold text-accent">project</Link>. Overrides the workspace default from Response Behavior.
              </CardSub>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted">
                      <th className="pb-2">Repo</th><th>Provider</th><th>Project</th><th>Mode</th><th>Policy</th><th>Enabled</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {repos.map((r) => (
                      <tr key={r.repo} className="border-b border-border">
                        <td className="py-2.5 font-semibold">{r.repo}</td>
                        <td>{r.provider}</td>
                        <td>
                          <select
                            className="rounded-lg border border-border bg-panel-2 px-2 py-1 text-xs"
                            value={r.project}
                            onChange={(e) => moveRepoProject(r.repo, e.target.value)}
                          >
                            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td>
                          <select
                            className="rounded-lg border border-border bg-panel-2 px-2 py-1 text-xs"
                            value={r.mode}
                            onChange={(e) => updateRepoMode(r.repo, e.target.value)}
                          >
                            {UI_MODE_LABELS.map((m) => <option key={m}>{m}</option>)}
                          </select>
                        </td>
                        <td className="text-muted">{r.policy}</td>
                        <td><Toggle checked={r.enabled} onChange={(v) => toggleRepoEnabled(r.repo, v)} /></td>
                        <td><Button variant="ghost" size="sm" onClick={() => removeRepo(r.repo)}>Remove</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="ghost" size="sm" className="mt-4" onClick={addRepo}>+ Add repository</Button>
            </Card>
          )}

          {section === "ticketing" && (
            <>
              <Card>
                <CardTitle>Ticketing</CardTitle>
                <CardSub>Jira is fully wired — real tickets are created via the Jira Cloud REST API as failures happen. Linear/Asana/GitHub Issues are shown for reference and aren't connectable yet.</CardSub>
                <div className="mt-4">
                  <TicketingPanel />
                </div>
              </Card>
              {ticketingPrefs && (
                <Card>
                  <CardTitle>Automation rules</CardTitle>
                  <CardSub>What triggers a ticket, and what happens to it afterward.</CardSub>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Create a ticket when">
                      <select
                        className={selectClass}
                        value={ticketingPrefs.createOn}
                        onChange={(e) => saveTicketingPrefs({ createOn: e.target.value as TicketingPreferences["createOn"] })}
                      >
                        <option value="esc_only">Escalated only</option>
                        <option value="esc_pending">Escalated + pending review</option>
                        <option value="every">Every failure</option>
                      </select>
                    </Field>
                    <Field label="Default project / board">
                      <select
                        className={selectClass}
                        value={ticketingPrefs.defaultBoard}
                        onChange={(e) => saveTicketingPrefs({ defaultBoard: e.target.value })}
                      >
                        <option>ENG</option>
                        <option>PLATFORM</option>
                        <option>SUPPORT</option>
                      </select>
                    </Field>
                    <div className="flex items-end">
                      <Toggle
                        checked={ticketingPrefs.autoCloseOnMerge}
                        label="Auto-close ticket on merge"
                        onChange={(v) => saveTicketingPrefs({ autoCloseOnMerge: v })}
                      />
                    </div>
                    <div className="flex items-end">
                      <Toggle
                        checked={ticketingPrefs.autoReopenOnRevert}
                        label="Auto-reopen ticket on revert"
                        onChange={(v) => saveTicketingPrefs({ autoReopenOnRevert: v })}
                      />
                    </div>
                    <div className="flex items-end">
                      <Toggle
                        checked={ticketingPrefs.linkInPrDescription}
                        label="Link ticket in PR description"
                        onChange={(v) => saveTicketingPrefs({ linkInPrDescription: v })}
                      />
                    </div>
                  </div>
                  <h4 className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-muted">Confidence → ticket priority</h4>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="High confidence (>90%)">
                      <select
                        className={selectClass}
                        value={ticketingPrefs.priorityMap.high}
                        onChange={(e) => saveTicketingPrefs({ priorityMap: { ...ticketingPrefs.priorityMap, high: e.target.value } })}
                      >
                        <option value="none">No ticket</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                      </select>
                    </Field>
                    <Field label="Medium confidence (70–90%)">
                      <select
                        className={selectClass}
                        value={ticketingPrefs.priorityMap.medium}
                        onChange={(e) => saveTicketingPrefs({ priorityMap: { ...ticketingPrefs.priorityMap, medium: e.target.value } })}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </Field>
                    <Field label="Low confidence / escalated (<70%)">
                      <select
                        className={selectClass}
                        value={ticketingPrefs.priorityMap.low}
                        onChange={(e) => saveTicketingPrefs({ priorityMap: { ...ticketingPrefs.priorityMap, low: e.target.value } })}
                      >
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </Field>
                  </div>
                  <Callout>
                    The ticket ID lands on the Issue Record once created — see it cross-linked in Fix Log and Issue Records once Jira is connected.
                  </Callout>
                </Card>
              )}
            </>
          )}

          {section === "notifications" && (
            <Card>
              <CardTitle>Notifications</CardTitle>
              <CardSub>Slack and Email are real — connect, enable per-workspace, and send a live test. Discord/Teams/PagerDuty/custom webhook shown below are reference triggers only, not yet wired.</CardSub>
              <NotificationsPanel />
              <div className="mt-6">
                <CardSub>Trigger on</CardSub>
                <div className="mt-2 flex flex-wrap gap-2">
                  {NOTIFICATION_TRIGGERS.map((t) => (
                    <Badge key={t} tone="outline">{t}</Badge>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {section === "docs" && docPrefs && (
            <Card>
              <CardTitle>Documentation</CardTitle>
              <CardSub>Write Fix log to repo is real — every other control here is recorded but not yet enforced (see hints).</CardSub>
              <div className="mt-4 space-y-3">
                <Toggle
                  checked={docPrefs.writeFixLogToRepo}
                  label="Write Fix log to repo"
                  onChange={(v) => saveDocPrefs({ writeFixLogToRepo: v })}
                />
                <Toggle
                  checked={docPrefs.writeAuditTrail}
                  label="Write Audit trail"
                  onChange={(v) => saveDocPrefs({ writeAuditTrail: v })}
                />
                <Toggle
                  checked={docPrefs.autoGenerateChangelog}
                  label="Auto-generate Changelog"
                  onChange={(v) => saveDocPrefs({ autoGenerateChangelog: v })}
                />
                <Toggle
                  checked={docPrefs.incidentReports}
                  label="Incident reports"
                  onChange={(v) => saveDocPrefs({ incidentReports: v })}
                />
                <Field label="Weekly digest" hint="Recorded, not yet enforced — no scheduler exists yet to send it">
                  <select
                    className={selectClass}
                    value={docPrefs.weeklyDigest}
                    onChange={(e) => saveDocPrefs({ weeklyDigest: e.target.value as DocumentationPreferences["weeklyDigest"] })}
                  >
                    <option value="mon">Monday 9am</option>
                    <option value="fri">Friday 5pm</option>
                    <option value="off">Off</option>
                  </select>
                </Field>
                <Field label="Retention" hint="Recorded, not yet enforced — no pruning job runs against it yet">
                  <select
                    className={selectClass}
                    value={String(docPrefs.retentionDays)}
                    onChange={(e) => saveDocPrefs({ retentionDays: Number(e.target.value) })}
                  >
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                  </select>
                </Field>
                <Field label="Export format" hint="Danger zone's Export button always exports full JSON today regardless of this setting">
                  <div className="flex flex-wrap gap-4 pt-1 text-sm font-semibold">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={docPrefs.exportFormats.markdown}
                        onChange={(e) => saveDocPrefs({ exportFormats: { ...docPrefs.exportFormats, markdown: e.target.checked } })}
                        className="h-3.5 w-3.5 accent-accent"
                      />{" "}
                      Markdown
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={docPrefs.exportFormats.json}
                        onChange={(e) => saveDocPrefs({ exportFormats: { ...docPrefs.exportFormats, json: e.target.checked } })}
                        className="h-3.5 w-3.5 accent-accent"
                      />{" "}
                      JSON
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={docPrefs.exportFormats.pdf}
                        onChange={(e) => saveDocPrefs({ exportFormats: { ...docPrefs.exportFormats, pdf: e.target.checked } })}
                        className="h-3.5 w-3.5 accent-accent"
                      />{" "}
                      PDF
                    </label>
                  </div>
                </Field>
              </div>
              <Callout>
                <b>Write Fix log to repo</b> is real: when Stitch opens a live PR, it also commits the Issue Record's markdown file into that same branch — turn it off to keep everything in the Stitch dashboard only.
              </Callout>
            </Card>
          )}

          {section === "prs" && prPrefs && (
            <Card>
              <CardTitle>Pull requests</CardTitle>
              <CardSub>Real — every field below is applied to the actual GitHub PR that Stitch opens.</CardSub>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Open as">
                  <select
                    className={selectClass}
                    value={prPrefs.openAs}
                    onChange={(e) => savePrPrefs({ openAs: e.target.value as PullRequestPreferences["openAs"] })}
                  >
                    <option value="draft">Draft PR</option>
                    <option value="ready">Ready for review</option>
                  </select>
                </Field>
                <Field label="Required approvers" hint="Recorded, not yet enforced — needs GitHub branch protection API access">
                  <select
                    className={selectClass}
                    value={String(prPrefs.requiredApprovers)}
                    onChange={(e) => savePrPrefs({ requiredApprovers: Number(e.target.value) })}
                  >
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </Field>
                <div className="flex items-end">
                  <Toggle
                    checked={prPrefs.includeDiagnosisInBody}
                    label="Include GPT diagnosis in PR body"
                    onChange={(v) => savePrPrefs({ includeDiagnosisInBody: v })}
                  />
                </div>
                <div className="flex items-end">
                  <Toggle
                    checked={prPrefs.notifyCodeowners}
                    label="Notify codeowners"
                    onChange={(v) => savePrPrefs({ notifyCodeowners: v })}
                  />
                </div>
              </div>
              <Field label="Labels" hint="Comma-separated — applied to every PR Stitch opens; skipped if a label doesn't exist in the repo">
                <input
                  className={inputClass}
                  value={prLabelsInput}
                  onChange={(e) => setPrLabelsInput(e.target.value)}
                  onBlur={() => savePrPrefs({ labels: prLabelsInput.split(",").map((l) => l.trim()).filter(Boolean) })}
                />
              </Field>
            </Card>
          )}

          {section === "team" && (
            <Card>
              <CardTitle>Team & access</CardTitle>
              <CardSub>Real — invite links join this workspace directly. Role permissions are enforced on every API route.</CardSub>
              <div className="mt-3">
                <TeamPanel currentUserId={workspace.user?.id} />
              </div>
            </Card>
          )}

          {section === "security" && securityPrefs && (
            <Card>
              <CardTitle>Security</CardTitle>
              <CardSub>
                {isAdmin
                  ? "Require-approval and session timeout are real and enforced — 2FA and IP allowlist remain roadmap items."
                  : "View-only — only Admins can change security policy."}
              </CardSub>
              <div className="mt-4 space-y-3">
                <Toggle
                  checked={securityPrefs.requireApprovalForAutopilotOnMain}
                  label="Require approval for Autopilot on main"
                  onChange={(v) => isAdmin && saveSecurityPrefs({ requireApprovalForAutopilotOnMain: v })}
                />
                <Field label="Session timeout" hint="Applied on your next login — not retroactive to sessions already open">
                  <select
                    className={selectClass}
                    value={String(securityPrefs.sessionTimeoutHours)}
                    disabled={!isAdmin}
                    onChange={(e) => isAdmin && saveSecurityPrefs({ sessionTimeoutHours: e.target.value === "never" ? "never" : Number(e.target.value) })}
                  >
                    <option value="1">1 hour</option>
                    <option value="8">8 hours</option>
                    <option value="24">24 hours</option>
                    <option value="never">Never</option>
                  </select>
                </Field>
                <Field label="IP allowlist" hint="Recorded, not yet enforced — no request-time IP check exists yet">
                  <input
                    className={inputClass}
                    placeholder="Optional CIDR ranges"
                    value={ipAllowlistInput}
                    disabled={!isAdmin}
                    onChange={(e) => setIpAllowlistInput(e.target.value)}
                    onBlur={() => isAdmin && saveSecurityPrefs({ ipAllowlist: ipAllowlistInput.trim() })}
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <Toggle checked={false} label="Two-factor authentication" onChange={() => {}} />
                  <Badge tone="outline">Planned — roadmap 16.1</Badge>
                </div>
              </div>
            </Card>
          )}

          {section === "billing" && (
            <Card>
              <div className="flex items-center justify-between">
                <CardTitle className="!mb-0">Plan & billing</CardTitle>
                <Badge tone="blue">{billing?.plan ?? "…"} plan</Badge>
              </div>
              <CardSub>Live usage from your workspace database — fix counts and AI spend meter.</CardSub>
              {billing ? (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-code-bg">
                      <span className="block h-full rounded-full bg-good" style={{ width: `${billing.usagePercent}%` }} />
                    </span>
                    <span className="text-xs font-bold">{billing.usagePercent}%</span>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted">Included fixes this month</span>
                      <span className="font-semibold">{billing.fixesThisMonth} of {billing.includedFixes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Overage rate</span>
                      <span className="font-semibold">${billing.overageRate.toFixed(2)} / additional fix</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">AI spend (this period)</span>
                      <span className="font-semibold">${billing.aiUsage.spent.toFixed(2)} of ${billing.aiUsage.budget.toFixed(0)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted">Loading billing data…</p>
              )}
              <Callout className="mt-4">
                Payment processing is not integrated yet — plan tier comes from your org record. Contact support to change plans.
              </Callout>
            </Card>
          )}

          {section === "apikey" && (
            <Card>
              <CardTitle>API key</CardTitle>
              <CardSub>Used for programmatic access to the Stitch API. Only shown in full right after regenerating.</CardSub>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <code className="rounded-lg bg-code-bg px-3 py-2 font-mono text-sm">
                  {revealedApiKey ?? apiKeyPreview ?? "No key generated yet"}
                </code>
                <Button variant="ghost" size="sm" onClick={copyApiKey} disabled={!revealedApiKey}>Copy</Button>
                <Button variant="ghost" size="sm" onClick={regenerateApiKey} disabled={!isAdmin}>Regenerate</Button>
              </div>
            </Card>
          )}

          {section === "danger" && (
            <Card className="border-critical/40">
              <CardTitle className="text-critical">Danger zone</CardTitle>
              <CardSub>Destructive actions. Every action below is logged to the Audit Trail before it takes effect.</CardSub>
              <div className="space-y-3">
                {isAdmin && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                    <div>
                      <b className="text-sm">Disconnect all integrations</b>
                      <div className="text-xs text-muted">Stops all autonomous activity across every connected provider immediately.</div>
                    </div>
                    <Button variant="danger" size="sm" onClick={disconnectAll}>Disconnect all</Button>
                  </div>
                )}
                {canExport && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                    <div>
                      <b className="text-sm">Export all workspace data</b>
                      <div className="text-xs text-muted">Projects, repos, fixes, issue records, and audit trail as a JSON file.</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={exportData}>Export</Button>
                  </div>
                )}
                {isAdmin && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                    <div>
                      <b className="text-sm">Delete workspace</b>
                      <div className="text-xs text-muted">Permanently deletes this workspace and every setting on this page. Issue Records already committed to your repos are not affected.</div>
                    </div>
                    <Button variant="danger" size="sm" onClick={deleteWorkspace}>Delete workspace</Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
