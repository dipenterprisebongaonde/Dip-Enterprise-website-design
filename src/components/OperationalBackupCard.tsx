
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const CONFIRM_PHRASE = "RECOVER";

export function OperationalBackupCard() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [recovering, setRecovering] = useState(false);

  async function downloadBackup() {
    setDownloading(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/app/settings/backup");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not download backup.");
        setDownloading(false);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || "dip-operational-backup.json";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setOk("Backup downloaded.");
    } catch {
      setError("Could not download backup.");
    }
    setDownloading(false);
  }

  async function onRecover(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a backup JSON file first.");
      return;
    }

    setRecovering(true);
    setError("");
    setOk("");

    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const res = await fetch("/api/app/settings/backup/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm, backup }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not recover backup.");
        setRecovering(false);
        return;
      }

      const restored = data.restored || {};
      setOk(
        `Recovered ${restored.sales ?? 0} sales, ${restored.purchases ?? 0} purchases, ${restored.inventoryItems ?? 0} inventory items, ${restored.customers ?? 0} customers, ${restored.vendors ?? 0} vendors.`
      );
      setConfirm("");
      setFile(null);
      router.refresh();
    } catch {
      setError("Invalid backup file. Use a DIP operational backup JSON export.");
    }
    setRecovering(false);
  }

  return (
    <div className="panel space-y-5 rounded-sm p-5">
      <div>
        <h3 className="text-lg font-semibold text-[var(--navy)]">Backup & recover</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Download a JSON backup of sales, purchases, inventory, customers, and vendors
          (including payments and payment proofs). Recover replaces current operational data
          with the backup. Users, branches, and settings are not changed.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={downloading || recovering}
          onClick={downloadBackup}
        >
          {downloading ? "Preparing..." : "Download backup"}
        </button>
      </div>

      <form onSubmit={onRecover} className="space-y-3 border-t border-[var(--line)] pt-4">
        <p className="text-sm font-semibold text-[var(--navy)]">Recover from backup</p>
        <label className="block max-w-lg">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
            Backup file
          </span>
          <input
            className="field"
            type="file"
            accept="application/json,.json"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        <label className="block max-w-sm">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
            Type {CONFIRM_PHRASE} to confirm
          </span>
          <input
            className="field"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button
          type="submit"
          className="btn btn-ghost"
          disabled={
            recovering || downloading || !file || confirm.trim() !== CONFIRM_PHRASE
          }
        >
          {recovering ? "Recovering..." : "Recover operational data"}
        </button>
      </form>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}
    </div>
  );
}
