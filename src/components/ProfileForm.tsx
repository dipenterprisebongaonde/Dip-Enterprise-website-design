
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ProfileUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  hasPassword: boolean;
  authProvider?: string;
  branch?: { id: string; name: string; region: string } | null;
};

export function ProfileForm({ user }: { user: ProfileUser }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setOk("");

    if (newPassword && newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not update profile.");
        setLoading(false);
        return;
      }
      setOk("Profile updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setLoading(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form className="panel profile-form" onSubmit={onSubmit}>
      <div className="profile-form-grid">
        <label>
          <span>Full name</span>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
          />
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
          <input
            className="field"
            value={user.role === "SUPER_ADMIN" ? "Super Admin" : "Staff"}
            readOnly
          />
        </label>
        <label>
          <span>Branch</span>
          <input
            className="field"
            value={user.branch?.name || (user.role === "SUPER_ADMIN" ? "All branches" : "—")}
            readOnly
          />
        </label>
      </div>

      <div className="profile-password-block">
        <h3>Password</h3>
        <p>
          {user.hasPassword
            ? "Change your login password. Leave blank to keep the current one."
            : "This account has no password yet. Set one to also sign in with email."}
        </p>
        <div className="profile-form-grid">
          {user.hasPassword ? (
            <label>
              <span>Current password</span>
              <input
                className="field"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
          ) : null}
          <label>
            <span>{user.hasPassword ? "New password" : "Set password"}</span>
            <input
              className="field"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
            />
          </label>
          <label>
            <span>Confirm password</span>
            <input
              className="field"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
            />
          </label>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {ok ? <p className="form-success">{ok}</p> : null}

      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
