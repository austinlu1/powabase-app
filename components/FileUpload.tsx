"use client";

import { useState, useRef } from "react";
import { XMarkIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";

interface FileUploadProps {
  agentId: string | null;
  onClose: () => void;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

export default function FileUpload({ agentId, onClose }: FileUploadProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!agentId) {
      setStatus("error");
      setMessage("No active agent. Start a chat first.");
      return;
    }

    setStatus("uploading");
    setMessage(`Uploading "${file.name}"…`);

    const form = new FormData();
    form.append("file", file);
    form.append("agentId", agentId);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setStatus("success");
      setMessage(
        `"${file.name}" uploaded. Powabase is indexing it — it will be searchable shortly.`
      );
    } catch (e: unknown) {
      setStatus("error");
      setMessage(String(e));
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    upload(files[0]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1f2937] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">Upload Document</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl px-6 py-10 text-center cursor-pointer transition-colors ${
            dragOver ? "border-blue-500 bg-blue-500/10" : "border-white/20 hover:border-white/40"
          }`}
        >
          <ArrowUpTrayIcon className="w-8 h-8 mx-auto mb-3 text-white/40" />
          <p className="text-white/70 text-sm">
            Drag & drop a file here, or <span className="text-blue-400 underline">browse</span>
          </p>
          <p className="text-white/30 text-xs mt-2">
            PDF, DOCX, TXT, MD, CSV, PPTX, XLSX, images
          </p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            accept=".pdf,.docx,.doc,.txt,.md,.csv,.pptx,.xlsx,.png,.jpg,.jpeg,.tiff,.bmp"
          />
        </div>

        {/* Status message */}
        {message && (
          <div
            className={`mt-4 rounded-lg px-4 py-3 text-sm ${
              status === "error"
                ? "bg-red-500/20 text-red-300"
                : status === "success"
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-white/10 text-white/60"
            }`}
          >
            {message}
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            {status === "success" ? "Done" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
