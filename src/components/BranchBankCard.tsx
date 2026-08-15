
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export type BranchBankValues = {
  id: string;
  name: string;
  region: string;
  address: string | null;
  bankName: string | null;
  accountNo: string | null;
  ifsc: string | null;
  bankBranch: string | null;
  upi: string | null;
  users: number;
  customers: number;
  vendors: number;
};

export function BranchBankCard({ branch }: { branch: BranchBankValues }) {
  const router = useRouter();
  const [values, setValues] = useState({
    name: branch.name,
    region: branch.region,
    address: branch.address || "",
    bankName: branch.bankName || "",
    accountNo: branch.accountNo || "",
    ifsc: branch.ifsc || "",
    bankBranch: branch.bankBranch || "",
    upi: branch.upi || "",
  });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setOk("");

    const res = await fetch(`/api/app/branches/${branch.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Could not update branch.");
      return;
    }

    setOk("Branch bank details saved.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="branch-bank-card">
      <div className="branch-bank-card-head">
        <div>
          <h3>{branch.name}</h3>
          <p>
            {branch.users} users · {branch.customers} customers · {branch.vendors} vendors
          </p>
        </div>
      </div>

      <div className="invoice-grid">
        <label>
          <span>Branch name</span>
          <input
            className="field"
            required
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          />
        </label>
        <label>
          <span>Region</span>
          <input
            className="field"
            required
            value={values.region}
            onChange={(e) => setValues((v) => ({ ...v, region: e.target.value }))}
          />
        </label>
        <label className="full">
          <span>Address</span>
          <input
            className="field"
            value={values.address}
            onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
          />
        </label>
        <label>
          <span>Bank name</span>
          <input
            className="field"
            value={values.bankName}
            onChange={(e) => setValues((v) => ({ ...v, bankName: e.target.value }))}
            placeholder="Optional — uses Settings if empty"
          />
        </label>
        <label>
          <span>Account number</span>
          <input
            className="field"
            value={values.accountNo}
            onChange={(e) => setValues((v) => ({ ...v, accountNo: e.target.value }))}
            placeholder="Optional"
          />
        </label>
        <label>
          <span>IFSC</span>
          <input
            className="field"
            value={values.ifsc}
            onChange={(e) => setValues((v) => ({ ...v, ifsc: e.target.value }))}
            placeholder="Optional"
          />
        </label>
        <label>
          <span>Bank branch</span>
          <input
            className="field"
            value={values.bankBranch}
            onChange={(e) => setValues((v) => ({ ...v, bankBranch: e.target.value }))}
            placeholder="Optional"
          />
        </label>
        <label>
          <span>UPI</span>
          <input
            className="field"
            value={values.upi}
            onChange={(e) => setValues((v) => ({ ...v, upi: e.target.value }))}
            placeholder="Optional"
          />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
      {ok && <p className="mt-3 text-sm text-emerald-700">{ok}</p>}

      <div className="invoice-actions">
        <button className="btn btn-primary" disabled={loading} type="submit">
          {loading ? "Saving..." : "Save branch bank"}
        </button>
      </div>
    </form>
  );
}
