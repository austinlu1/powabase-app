"use client";

import { useState } from "react";
import {
  VariableIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  getAgentVariables,
  saveAgentVariables,
  AgentVariable,
  DataType,
} from "@/lib/agentVariables";

type View = "main" | "variables";

export default function CustomizationsPanel({ agentId }: { agentId: string }) {
  const [view, setView] = useState<View>("main");

  if (view === "variables") {
    return <VariablesView agentId={agentId} onBack={() => setView("main")} />;
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#1a1a1a]">
      <div className="flex items-center justify-center px-8 py-6 border-b border-white/10 shrink-0">
        <h2 className="text-3xl font-semibold text-violet-400">Customizations</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col items-center">
        <div className="w-full max-w-2xl space-y-3">
          <button
            onClick={() => setView("variables")}
            className="flex items-center gap-4 w-full rounded-lg border border-white/8 bg-white/3 hover:bg-white/6 hover:border-violet-500/30 transition-colors px-5 py-4 text-left group"
          >
            <div className="w-9 h-9 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
              <VariableIcon className="w-5 h-5 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/90 text-sm font-semibold">Pre-defined Variables</p>
              <p className="text-white/40 text-xs mt-0.5 leading-relaxed">
                Variables that collect specific information from conversations.
              </p>
            </div>
            <ChevronRightIcon className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Data type config ──────────────────────────────────────────────────────────

const DATA_TYPE_CONFIG: Record<DataType, { label: string; badgeClass: string; hint: string }> = {
  text: {
    label: "Text",
    badgeClass: "text-blue-400 bg-blue-500/15 border-blue-500/25",
    hint: "A plain text value, e.g. a name or topic.",
  },
  number: {
    label: "Number",
    badgeClass: "text-amber-400 bg-amber-500/15 border-amber-500/25",
    hint: "A numeric value, e.g. an age or order quantity.",
  },
  boolean: {
    label: "True / False",
    badgeClass: "text-emerald-400 bg-emerald-500/15 border-emerald-500/25",
    hint: "A yes/no value, e.g. whether the user is a returning customer.",
  },
};

const EMPTY_FORM = {
  name: "",
  description: "",
  dataType: "text" as DataType,
  example: "",
  defaultValue: "",
};

// ── Variables view ────────────────────────────────────────────────────────────

function VariablesView({ agentId, onBack }: { agentId: string; onBack: () => void }) {
  const [variables, setVariables] = useState<AgentVariable[]>(() => getAgentVariables(agentId));
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY_FORM, string>>>({});

  function persist(updated: AgentVariable[]) {
    setVariables(updated);
    saveAgentVariables(agentId, updated);
  }

  function deleteVariable(id: string) {
    persist(variables.filter((v) => v.id !== id));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof typeof EMPTY_FORM, string>> = {};
    const name = form.name.trim();
    if (!name) {
      e.name = "Variable name is required.";
    } else if (!/^[a-z0-9_]+$/i.test(name)) {
      e.name = "Only letters, numbers, and underscores — no spaces.";
    } else if (variables.some((v) => v.name === name)) {
      e.name = "A variable with this name already exists.";
    }
    if (!form.description.trim()) e.description = "Description is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function addVariable() {
    if (!validate()) return;
    const newVar: AgentVariable = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      description: form.description.trim(),
      dataType: form.dataType,
      example: form.example.trim(),
      defaultValue: form.defaultValue.trim(),
    };
    persist([...variables, newVar]);
    setForm(EMPTY_FORM);
    setErrors({});
    setAdding(false);
  }

  function cancelAdd() {
    setForm(EMPTY_FORM);
    setErrors({});
    setAdding(false);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#1a1a1a]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 px-8 py-6 border-b border-white/10 shrink-0">
        <button onClick={onBack} className="text-white/40 hover:text-white/70 text-sm transition-colors">
          Customizations
        </button>
        <span className="text-white/20 text-sm">/</span>
        <span className="text-white/80 text-sm font-medium">Pre-defined Variables</span>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col items-center">
        <div className="w-full max-w-2xl">

          {/* Description */}
          <p className="text-white/40 text-sm leading-relaxed mb-6">
            Variables are automatically extracted from each conversation by the agent after every
            reply. The collected values appear under{" "}
            <span className="text-white/60 font-medium">Collected Data</span> in the Sessions panel —
            one record per session.
          </p>

          {/* Existing variables */}
          {variables.length > 0 && (
            <div className="space-y-2 mb-4">
              {variables.map((v) => {
                const cfg = DATA_TYPE_CONFIG[v.dataType];
                return (
                  <div
                    key={v.id}
                    className="flex items-start gap-3 rounded-lg border border-white/8 bg-white/3 px-4 py-3.5 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-mono font-medium text-white/85">{`{{${v.name}}}`}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.badgeClass}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-white/45 leading-relaxed">{v.description}</p>
                      {(v.example || v.defaultValue) && (
                        <div className="flex gap-4 mt-1.5 flex-wrap">
                          {v.example && (
                            <span className="text-[11px] text-white/25">
                              Example: <span className="text-white/40">{v.example}</span>
                            </span>
                          )}
                          {v.defaultValue && (
                            <span className="text-[11px] text-white/25">
                              Default: <span className="text-white/40">{v.defaultValue}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteVariable(v.id)}
                      className="p-1.5 text-white/20 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
                      title="Delete variable"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {variables.length === 0 && !adding && (
            <div className="rounded-lg border border-dashed border-white/10 py-10 text-center mb-4">
              <VariableIcon className="w-8 h-8 text-white/15 mx-auto mb-3" />
              <p className="text-white/30 text-sm">No variables defined yet.</p>
              <p className="text-white/20 text-xs mt-1">
                Add a variable to start capturing data from conversations.
              </p>
            </div>
          )}

          {/* Add Variable form */}
          {adding ? (
            <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white/80">New Variable</h3>
                <button onClick={cancelAdd} className="text-white/30 hover:text-white/60 transition-colors">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Variable Name */}
              <FormField
                label="Variable Name"
                hint='The key used in Collected Data. Letters, numbers, and underscores only — no spaces. E.g. "user_name".'
                error={errors.name}
                required
              >
                <input
                  autoFocus
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. user_name"
                  className={inputCls(!!errors.name)}
                />
              </FormField>

              {/* Description */}
              <FormField
                label="Description"
                hint="Tell the agent what information this variable should capture. Be specific — the agent reads this to know what to look for."
                error={errors.description}
                required
              >
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. The full name the user provides during the conversation"
                  className={inputCls(!!errors.description)}
                />
              </FormField>

              {/* Data Type */}
              <FormField
                label="Data Type"
                hint={DATA_TYPE_CONFIG[form.dataType].hint}
              >
                <div className="flex gap-2">
                  {(["text", "number", "boolean"] as DataType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, dataType: t })}
                      className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                        form.dataType === t
                          ? DATA_TYPE_CONFIG[t].badgeClass
                          : "text-white/35 border-white/10 bg-white/3 hover:bg-white/6"
                      }`}
                    >
                      {DATA_TYPE_CONFIG[t].label}
                    </button>
                  ))}
                </div>
              </FormField>

              {/* Example */}
              <FormField
                label="Example"
                hint="A sample value that shows the agent what a valid result looks like."
              >
                <input
                  type="text"
                  value={form.example}
                  onChange={(e) => setForm({ ...form, example: e.target.value })}
                  placeholder="e.g. John Doe"
                  className={inputCls(false)}
                />
              </FormField>

              {/* Default Value */}
              <FormField
                label="Default Value"
                hint="Returned when the agent cannot find this information in the conversation. Leave blank to use null."
              >
                <input
                  type="text"
                  value={form.defaultValue}
                  onChange={(e) => setForm({ ...form, defaultValue: e.target.value })}
                  placeholder="e.g. Unknown"
                  className={inputCls(false)}
                />
              </FormField>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={addVariable}
                  className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
                >
                  Save Variable
                </button>
                <button
                  onClick={cancelAdd}
                  className="px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-dashed border-violet-500/30 text-violet-400/60 hover:text-violet-400 hover:border-violet-500/50 hover:bg-violet-500/5 text-sm font-medium transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Add Variable
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared form helpers ───────────────────────────────────────────────────────

function FormField({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-white/55 uppercase tracking-wide">
        {label}
        {required && <span className="text-violet-400 ml-1">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-white/25 leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return `w-full bg-white/5 border ${
    hasError ? "border-red-500/50 focus:border-red-500/70" : "border-white/10 focus:border-violet-500/50"
  } rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors`;
}
