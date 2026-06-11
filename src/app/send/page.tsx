"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";

interface SavedContact {
  id: string;
  name: string;
  phoneNumber: string;
  useCount: number;
}

interface UploadedFile {
  name: string;
  url: string;
  size: number;
}

export default function SendFaxPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [toNumber, setToNumber] = useState("");
  const [toName, setToName] = useState("");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [includeCover, setIncludeCover] = useState(true);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Contact search
  const [contacts, setContacts] = useState<SavedContact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [showContacts, setShowContacts] = useState(false);
  const contactRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.replace("/");
  }, [authStatus, router]);

  // Load contacts
  useEffect(() => {
    if (!session) return;
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((d) => setContacts(d.contacts || []))
      .catch(console.error);
  }, [session]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) {
        setShowContacts(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.phoneNumber.includes(contactSearch)
  );

  const handleFileUpload = useCallback(async (fileList: FileList) => {
    setUploading(true);
    setError("");
    const formData = new FormData();
    for (const f of Array.from(fileList)) {
      if (f.type !== "application/pdf") {
        setError(`"${f.name}" is not a PDF. Only PDFs can be faxed.`);
        setUploading(false);
        return;
      }
      formData.append("files", f);
    }

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFiles((prev) => [...prev, ...data.files]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }, []);

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSend = async () => {
    setError("");
    setSuccess("");

    if (!toNumber.trim()) { setError("Enter a recipient fax number"); return; }
    if (!files.length) { setError("Upload at least one PDF to fax"); return; }

    setSending(true);
    try {
      const res = await fetch("/api/fax/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toNumber,
          toName,
          fileUrls: files.map((f) => f.url),
          fileNames: files.map((f) => f.name),
          includeCoverSheet: includeCover,
          subject,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess("Fax queued for delivery!");
      // Reset form after short delay
      setTimeout(() => {
        setToNumber("");
        setToName("");
        setSubject("");
        setNotes("");
        setFiles([]);
        setSuccess("");
      }, 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  if (authStatus === "loading" || !session) {
    return <div className="p-8"><div className="animate-pulse h-8 w-48 bg-surface-200 rounded" /></div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-surface-800 mb-6">Send a Fax</h1>

      <div className="card divide-y divide-surface-100">
        {/* Recipient */}
        <div className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wide">Recipient</h2>

          <div className="relative" ref={contactRef}>
            <label className="block text-sm font-medium text-surface-600 mb-1">Fax Number</label>
            <input
              type="tel"
              className="input"
              placeholder="(555) 123-4567 or search contacts..."
              value={contactSearch || toNumber}
              onChange={(e) => {
                setContactSearch(e.target.value);
                setToNumber(e.target.value);
                setShowContacts(true);
              }}
              onFocus={() => setShowContacts(true)}
            />

            {showContacts && filteredContacts.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-surface-0 rounded-lg border border-surface-200 shadow-lg max-h-56 overflow-y-auto">
                {filteredContacts.slice(0, 10).map((c) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-surface-50 flex justify-between items-center"
                    onClick={() => {
                      setToNumber(c.phoneNumber);
                      setToName(c.name);
                      setContactSearch("");
                      setShowContacts(false);
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium text-surface-700">{c.name}</p>
                      <p className="text-xs text-surface-400">{c.phoneNumber}</p>
                    </div>
                    <span className="text-xs text-surface-300">{c.useCount} faxes</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {toName && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-surface-500">Sending to:</span>
              <span className="font-medium text-surface-700">{toName}</span>
              <span className="text-surface-400">({toNumber})</span>
              <button
                onClick={() => { setToName(""); setToNumber(""); }}
                className="text-surface-400 hover:text-surface-600"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Files */}
        <div className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wide">Documents</h2>

          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-surface-200 rounded-lg p-6 text-center hover:border-brand-500/40 transition-colors cursor-pointer"
            onClick={() => document.getElementById("file-input")?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-brand-500"); }}
            onDragLeave={(e) => { e.currentTarget.classList.remove("border-brand-500"); }}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-brand-500"); handleFileUpload(e.dataTransfer.files); }}
          >
            <input
              id="file-input"
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            />
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-surface-500">
                <div className="animate-spin w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full" />
                Uploading...
              </div>
            ) : (
              <>
                <svg className="w-8 h-8 mx-auto text-surface-300 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
                <p className="text-sm text-surface-500">Drop PDFs here or click to browse</p>
                <p className="text-xs text-surface-400 mt-1">PDF files only</p>
              </>
            )}
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 bg-surface-50 rounded-lg">
                  <svg className="w-5 h-5 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                  </svg>
                  <span className="text-sm text-surface-700 flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-surface-400">{(f.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => removeFile(i)} className="text-surface-400 hover:text-red-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cover sheet options */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wide">Cover Sheet</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCover}
                onChange={(e) => setIncludeCover(e.target.checked)}
                className="rounded border-surface-300 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-sm text-surface-600">Include cover sheet</span>
            </label>
          </div>

          {includeCover && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-surface-600 mb-1">Subject</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Re: Patient claim documents"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-600 mb-1">Notes</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Additional notes for cover page..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Send */}
        <div className="p-5">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 text-green-700 text-sm border border-green-100">
              {success}
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={sending || !toNumber || !files.length}
            className="btn-primary w-full justify-center py-3 text-base"
          >
            {sending ? (
              <>
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                Sending...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                Send Fax ({files.length} document{files.length !== 1 ? "s" : ""})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
