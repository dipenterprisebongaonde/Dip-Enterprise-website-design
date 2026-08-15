
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type BranchOption = { id: string; name: string };

type EditableUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "SUPER_ADMIN" | "STAFF";
  branchId?: string | null;
};

export function UserEditForm({
  user,
  branches,
}: {
  user: EditableUser;
  branches: BranchOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || "");
  const [role, setRole] = useState(user.role);
  const [branchId, setBranchId] = useState(user.branchId || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/app/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          role,
          branchId: role === "STAFF" ? branchId || null : branchId || null,
          password: password.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not update user.");
        setLoading(false);
        return;
      }
      setPassword("");
      setOpen(false);
      setLoading(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        Edit
      </button>
    );
  }

  return (
    <form className="user-edit-form" onSubmit={onSubmit}>
      <div className="user-edit-grid">
        <label>
          <span>Name</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          <span>Email</span>
          <input
            className="field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          <span>Phone</span>
          <input
            className="field"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <label>
          <span>Role</span>
          <select className="field" value={role} onChange={(e) => setRole(e.target.value as EditableUser["role"])}>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="STAFF">Staff</option>
          </select>
        </label>
        <label>
          <span>Branch</span>
          <select
            className="field"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            required={role === "STAFF"}
          >
            <option value="">All / unassigned</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Reset password</span>
          <input
            className="field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep"
            minLength={6}
          />
        </label>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="user-edit-actions">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
