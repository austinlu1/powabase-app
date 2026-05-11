"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowUpTrayIcon,
  TrashIcon,
  XMarkIcon,
  DocumentTextIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/solid";
import ReactMarkdown from "react-markdown";

interface PbSource {
  id: string;
  name: string;
  file_type: string;
  extraction_status: string;
  created_at: string;
  error_message: string | null;
  auto_metadata?: {
    page_count?: number;
    char_count?: number;
    extraction_method?: string;
  };
}

interface FilesPanelProps {
  agentId: string | null;
}

export default function FilesPanel({ agentId }: FilesPanelProps) {
  const [sources, setSources] = useState<PbSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [selected, setSelected] = useState<PbSource | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadSources() {
    try {
      const res = await fetch("/api/sources");
      const data = await res.json();
      setSources(data.sources ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSources(); }, []);

  async function upload(file: File) {
    if (!agentId) { setUploadMsg("No active agent."); return; }
    setUploading(true);
    setUploadMsg(`Uploading "${file.name}"…`);

    const form = new FormData();
    form.append("file", file);
    form.append("agentId", agentId);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setUploadMsg(`"${file.name}" uploaded and indexed.`);
      await loadSources();
    } catch (e: unknown) {
      setUploadMsg(String(e));
    } finally {
      setUploading(false);
    }
  }

  async function deleteSource(source: PbSource) {
    try {
      await fetch(`/api/sources/${source.id}`, { method: "DELETE" });
      setSources((prev) => prev.filter((s) => s.id !== source.id));
      if (selected?.id === source.id) setSelected(null);
    } catch {
      // silently fail
    }
  }

  return (
    <div className="flex flex-col h-full text-white">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/10">
        <p className="text-sm font-semibold">Documents</p>
        <p className="text-xs text-white/40 mt-0.5">Upload files for RAG search</p>
      </div>

      {/* Drop zone */}
      <div className="px-3 pt-3">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) upload(file);
          }}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-3 py-4 cursor-pointer transition-colors ${
            dragOver ? "border-blue-500 bg-blue-500/10" : "border-white/20 hover:border-white/40"
          } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <ArrowUpTrayIcon className="w-5 h-5 text-white/40" />
          <p className="text-xs text-white/50 text-center">
            {uploading ? uploadMsg : "Drop file or click to upload"}
          </p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
            accept=".pdf,.docx,.doc,.txt,.md,.csv,.pptx,.xlsx,.png,.jpg,.jpeg,.tiff,.bmp"
          />
        </div>

        {uploadMsg && !uploading && (
          <p className={`text-xs mt-2 px-1 ${uploadMsg.includes("failed") || uploadMsg.includes("Error") ? "text-red-400" : "text-emerald-400"}`}>
            {uploadMsg}
          </p>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {loading && <p className="text-xs text-white/30 px-1 py-2">Loading…</p>}
        {!loading && sources.length === 0 && (
          <p className="text-xs text-white/30 px-1 py-2">No documents yet</p>
        )}
        {sources.map((source) => (
          <div
            key={source.id}
            onClick={() => setSelected(source)}
            className="group flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <DocumentTextIcon className="w-4 h-4 shrink-0 text-white/40" />
              <div className="min-w-0">
                <p className="text-xs text-white/80 truncate">{source.name}</p>
                <StatusBadge status={source.extraction_status} />
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); deleteSource(source); }}
              className="shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity ml-2"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* File viewer modal */}
      {selected && (
        <FileViewerModal
          source={selected}
          onClose={() => setSelected(null)}
          onDelete={() => deleteSource(selected)}
        />
      )}
    </div>
  );
}

// ── File viewer modal ────────────────────────────────────────────────────────

function FileViewerModal({
  source,
  onClose,
  onDelete,
}: {
  source: PbSource;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [isMarkdown, setIsMarkdown] = useState(false);
  const [contentLoading, setContentLoading] = useState(true);
  const [contentError, setContentError] = useState("");

  useEffect(() => {
    async function fetchContent() {
      setContentLoading(true);
      setContentError("");
      try {
        const res = await fetch(`/api/sources/${source.id}/content`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load content");
        setContent(data.content);
        setIsMarkdown(data.isMarkdown);
      } catch (e: unknown) {
        setContentError(String(e));
      } finally {
        setContentLoading(false);
      }
    }
    fetchContent();
  }, [source.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1f2937] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <DocumentTextIcon className="w-5 h-5 text-white/50 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-white font-semibold text-sm truncate">{source.name}</h2>
              <div className="flex items-center gap-3 mt-0.5">
                <StatusBadge status={source.extraction_status} />
                {source.auto_metadata?.page_count && (
                  <span className="text-white/30 text-xs">{source.auto_metadata.page_count} page{source.auto_metadata.page_count !== 1 ? "s" : ""}</span>
                )}
                {source.auto_metadata?.char_count && (
                  <span className="text-white/30 text-xs">{source.auto_metadata.char_count.toLocaleString()} chars</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded-lg hover:bg-red-400/10"
            >
              <TrashIcon className="w-4 h-4" />
              Delete
            </button>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {contentLoading && (
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              Loading content…
            </div>
          )}

          {contentError && !contentLoading && (
            <p className="text-red-400 text-sm">{contentError}</p>
          )}

          {content && !contentLoading && (
            isMarkdown ? (
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            ) : (
              <pre className="text-white/80 text-xs leading-relaxed whitespace-pre-wrap font-mono">
                {content}
              </pre>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "extracted" || status === "completed") {
    return (
      <span className="flex items-center gap-1 text-emerald-400 text-xs">
        <CheckCircleIcon className="w-3.5 h-3.5" /> Ready
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex items-center gap-1 text-red-400 text-xs">
        <ExclamationCircleIcon className="w-3.5 h-3.5" /> Failed
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-yellow-400 text-xs">
      <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> Processing
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/40">{label}</span>
      <span className="text-white/80">{children}</span>
    </div>
  );
}

// Keep Row in scope to avoid lint errors (used if metadata section is re-added)
void Row;
