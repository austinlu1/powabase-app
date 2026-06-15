"use client";

import { useState, useEffect, useRef } from "react";
import {
  XMarkIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/solid";

interface Source {
  id: string;
  name: string;
  extraction_status?: string;
  created_at?: string;
  file_size?: number;
}

interface SourcesModalProps {
  agentId: string;
  agentName: string;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFileType(name: string): string {
  if (name.startsWith("http://") || name.startsWith("https://")) return "Website";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "PDF", docx: "Word", doc: "Word", txt: "Text",
    md: "Markdown", csv: "CSV", pptx: "PowerPoint", xlsx: "Excel",
    png: "Image", jpg: "Image", jpeg: "Image", tiff: "Image",
    bmp: "Image", webp: "Image",
  };
  return map[ext] ?? "File";
}

function formatSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function StatusCell({ status }: { status?: string }) {
  if (status === "extracted" || status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
        <CheckCircleIcon className="w-3.5 h-3.5" /> Trained
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-medium">
        <ExclamationCircleIcon className="w-3.5 h-3.5" /> Failed
      </span>
    );
  }
  if (status === "attention_required") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs font-medium">
        <ExclamationCircleIcon className="w-3.5 h-3.5" /> Attention
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-medium">
      <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> Training…
    </span>
  );
}

function TypeBadge({ name }: { name: string }) {
  const type = getFileType(name);
  const isUrl = type === "Website";
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium ${
      isUrl ? "bg-blue-500/10 text-blue-400" : "bg-white/5 text-white/50"
    }`}>
      {isUrl ? <GlobeAltIcon className="w-3 h-3" /> : <DocumentTextIcon className="w-3 h-3" />}
      {type}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SourcesModal({ agentId, agentName, onClose }: SourcesModalProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"file" | "url">("file");

  // File upload state
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // URL import state
  const [urlInput, setUrlInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  async function loadSources() {
    setLoading(true);
    try {
      const res = await fetch(`/api/sources?agentId=${agentId}`);
      const data = await res.json();
      setSources(data.sources ?? []);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }

  useEffect(() => { loadSources(); }, [agentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function uploadFile(file: File) {
    if (sources.find((s) => s.name === file.name)) {
      setUploadMsg(`"${file.name}" is already in this agent's knowledge base.`);
      return;
    }
    setUploading(true);
    setUploadMsg(`Uploading "${file.name}"…`);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("agentId", agentId);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (res.status === 409) { setUploadMsg(data.message ?? "Duplicate document."); return; }
      if (res.status === 400 && data.error === "File too large") { setUploadMsg(data.message ?? "File too large — must be 25 pages or fewer."); return; }
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Upload failed");
      setUploadMsg(`"${file.name}" uploaded and indexed.`);
      await loadSources();
    } catch (e: unknown) {
      setUploadMsg(String(e));
    } finally {
      setUploading(false);
    }
  }

  async function importUrl() {
    const url = urlInput.trim();
    if (!url) return;
    try { new URL(url); } catch {
      setImportMsg("Please enter a valid URL (include https://).");
      return;
    }
    if (sources.find((s) => s.name === url)) {
      setImportMsg("This URL is already in this agent's knowledge base.");
      return;
    }
    setImporting(true);
    setImportMsg(`Importing ${url}… (this may take up to a minute)`);
    try {
      const res = await fetch("/api/sources/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, agentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImportMsg("Website imported and indexed.");
      setUrlInput("");
      await loadSources();
    } catch (e: unknown) {
      setImportMsg(String(e));
    } finally {
      setImporting(false);
    }
  }

  async function deleteSource(source: Source) {
    try {
      await fetch(`/api/sources/${source.id}?agentId=${agentId}`, { method: "DELETE" });
      setSources((prev) => prev.filter((s) => s.id !== source.id));
    } catch { /* silently fail */ }
  }

  const uploadMsgColor = uploading ? "text-white/50"
    : uploadMsg.includes("already") ? "text-amber-400"
    : uploadMsg.includes("too large") || uploadMsg.includes("exceeds") ? "text-amber-400"
    : uploadMsg.includes("failed") || uploadMsg.includes("Error") ? "text-red-400"
    : uploadMsg ? "text-emerald-400" : "text-white/30";

  const importMsgColor = importing ? "text-white/50"
    : importMsg.includes("already") || importMsg.includes("valid") ? "text-amber-400"
    : importMsg.includes("failed") || importMsg.includes("Error") ? "text-red-400"
    : importMsg ? "text-emerald-400" : "text-white/30";

  return (
    <div className="fixed top-0 bottom-0 left-72 right-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#111827] border border-white/10 rounded-2xl w-full max-w-5xl flex flex-col shadow-2xl"
        style={{ height: "82vh" }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-white font-semibold text-base">Sources</h2>
            <p className="text-white/40 text-xs mt-0.5">{agentName}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* ── Upload area ── */}
        <div className="px-6 py-4 border-b border-white/10 shrink-0">
          {/* Tabs */}
          <div className="flex gap-1 mb-3 bg-white/5 rounded-lg p-1 w-fit">
            <button
              onClick={() => { setTab("file"); setUploadMsg(""); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "file" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
            >
              Upload File
            </button>
            <button
              onClick={() => { setTab("url"); setImportMsg(""); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "url" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
            >
              Import URL
            </button>
          </div>

          {tab === "file" && (
            <div className="space-y-2">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) uploadFile(f); }}
                onClick={() => !uploading && inputRef.current?.click()}
                className={`flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 cursor-pointer transition-colors ${
                  dragOver ? "border-blue-500 bg-blue-500/10" : "border-white/20 hover:border-white/40"
                } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <ArrowUpTrayIcon className="w-4 h-4 text-white/40 shrink-0" />
                <p className="text-xs text-white/50">Drop a file or click to upload — PDF, DOCX, TXT, CSV, PPTX, XLSX, images</p>
                <input ref={inputRef} type="file" className="hidden" disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }}
                  accept=".pdf,.docx,.doc,.txt,.md,.csv,.pptx,.xlsx,.png,.jpg,.jpeg,.tiff,.bmp"
                />
              </div>
              {uploadMsg && <p className={`text-xs px-1 ${uploadMsgColor}`}>{uploadMsg}</p>}
            </div>
          )}

          {tab === "url" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-blue-500 transition-colors">
                  <GlobeAltIcon className="w-4 h-4 text-white/30 shrink-0" />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") importUrl(); }}
                    placeholder="https://example.com/page"
                    disabled={importing}
                    className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none disabled:opacity-50"
                  />
                </div>
                <button
                  onClick={importUrl}
                  disabled={importing || !urlInput.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors shrink-0"
                >
                  {importing ? "Importing…" : "Import"}
                </button>
              </div>
              {importMsg && <p className={`text-xs px-1 ${importMsgColor}`}>{importMsg}</p>}
            </div>
          )}
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-white/30 text-sm gap-2">
              <ArrowPathIcon className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : sources.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-white/30 text-sm gap-1">
              <DocumentTextIcon className="w-8 h-8 opacity-30" />
              <p>No sources yet. Upload a file or import a URL above.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#111827] border-b border-white/10">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider w-28">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider w-36">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider w-24">Size</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider w-36">Last Trained</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sources.map((source) => (
                  <tr key={source.id} className="group hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {getFileType(source.name) === "Website"
                          ? <GlobeAltIcon className="w-4 h-4 text-blue-400/60 shrink-0" />
                          : <DocumentTextIcon className="w-4 h-4 text-white/30 shrink-0" />
                        }
                        <span className="text-white/80 truncate max-w-xs" title={source.name}>{source.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <TypeBadge name={source.name} />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusCell status={source.extraction_status} />
                    </td>
                    <td className="px-4 py-3.5 text-white/40 text-xs">
                      {formatSize(source.file_size)}
                    </td>
                    <td className="px-4 py-3.5 text-white/40 text-xs">
                      {formatDate(source.created_at)}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => deleteSource(source)}
                        className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all"
                        title="Delete"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer count ── */}
        {!loading && sources.length > 0 && (
          <div className="px-6 py-3 border-t border-white/10 shrink-0">
            <p className="text-xs text-white/30">{sources.length} source{sources.length !== 1 ? "s" : ""}</p>
          </div>
        )}
      </div>
    </div>
  );
}
