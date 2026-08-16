
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { CompanyProfile } from "@/lib/company";

export function CompanySettingsForm({ initial }: { initial: CompanyProfile }) {
  const router = useRouter();
  const [values, setValues] = useState<CompanyProfile>({
    ...initial,
    invoicePdfTemplate: initial.invoicePdfTemplate === "flipkart" ? "flipkart" : "tally",
  });
  const [logoPreview, setLogoPreview] = useState(initial.logoUrl);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setOk("");

    if (values.enableGst && values.gstin.trim().length < 5) {
      setLoading(false);
      setError("Enter GSTIN when GST is enabled.");
      return;
    }
    if (values.enableGst && !(values.gstPercent > 0)) {
      setLoading(false);
      setError("Enter GST percentage when GST is enabled.");
      return;
    }

    try {
      if (logoFile) {
        const form = new FormData();
        form.append("logo", logoFile);
        const logoRes = await fetch("/api/app/settings/logo", {
          method: "POST",
          body: form,
        });
        const logoData = await logoRes.json();
        if (!logoRes.ok) {
          setLoading(false);
          setError(logoData.error || "Could not upload logo.");
          return;
        }
        if (logoData.logoUrl) {
          setLogoPreview(logoData.logoUrl);
          updateField("logoUrl", logoData.logoUrl);
        }
        setLogoFile(null);
      }

      const res = await fetch("/api/app/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: values.companyName,
          legalName: values.legalName,
          address: values.address,
          phone: values.phone,
          email: values.email,
          enableGst: values.enableGst,
          gstin: values.gstin,
          gstPercent: values.gstPercent,
          companyMotto: values.companyMotto,
          platformName: values.platformName,
          bankName: values.bankName,
          accountNo: values.accountNo,
          ifsc: values.ifsc,
          bankBranch: values.bankBranch,
          upi: values.upi,
          invoicePdfTemplate: values.invoicePdfTemplate,
        }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || "Could not save settings.");
        return;
      }

      if (data.company) {
        setValues(data.company);
        setLogoPreview(data.company.logoUrl);
      }
      setOk("Company settings saved.");
      router.refresh();
    } catch {
      setLoading(false);
      setError("Could not save settings.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="settings-sheet">
      <div className="settings-block">
        <div className="settings-block-head">
          <h3>Brand & contact</h3>
          <p>Shown on invoices, dashboard header, and PDFs.</p>
        </div>

        <div className="settings-logo-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoPreview || "/logo.png"} alt="Company logo" className="settings-logo-preview" />
          <label className="settings-logo-upload">
            <span>Company logo</span>
            <input
              className="field"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setLogoFile(file);
                if (file) {
                  setLogoPreview(URL.createObjectURL(file));
                }
              }}
            />
            <p className="field-hint">PNG, JPG, or WEBP up to 2 MB.</p>
          </label>
        </div>

        <div className="invoice-grid">
          <label>
            <span>Company name</span>
            <input
              className="field"
              required
              value={values.companyName}
              onChange={(e) => updateField("companyName", e.target.value)}
            />
          </label>
          <label>
            <span>Legal name</span>
            <input
              className="field"
              required
              value={values.legalName}
              onChange={(e) => updateField("legalName", e.target.value)}
            />
          </label>
          <label className="full">
            <span>Address</span>
            <textarea
              className="field"
              required
              rows={3}
              value={values.address}
              onChange={(e) => updateField("address", e.target.value)}
            />
          </label>
          <label>
            <span>Contact number</span>
            <input
              className="field"
              required
              value={values.phone}
              onChange={(e) => updateField("phone", e.target.value)}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              className="field"
              type="email"
              required
              value={values.email}
              onChange={(e) => updateField("email", e.target.value)}
            />
          </label>
          <label>
            <span>Motto</span>
            <input
              className="field"
              value={values.companyMotto}
              onChange={(e) => updateField("companyMotto", e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="settings-block">
        <div className="settings-block-head">
          <h3>GST (optional)</h3>
          <p>Turn on only if you need GST on invoice PDFs.</p>
        </div>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={values.enableGst}
            onChange={(e) => updateField("enableGst", e.target.checked)}
          />
          <span>Use GST on invoices</span>
        </label>
        {values.enableGst && (
          <div className="invoice-grid mt-4">
            <label>
              <span>GSTIN</span>
              <input
                className="field"
                required
                value={values.gstin}
                onChange={(e) => updateField("gstin", e.target.value)}
                placeholder="Enter GSTIN"
              />
            </label>
            <label>
              <span>GST percentage (%)</span>
              <input
                className="field"
                type="number"
                required
                min={0.01}
                max={40}
                step="0.01"
                value={values.gstPercent}
                onChange={(e) => updateField("gstPercent", Number(e.target.value) || 0)}
                placeholder="18"
              />
            </label>
            <p className="full field-hint">
              This GST % is applied on invoice PDFs when GST is turned on.
            </p>
          </div>
        )}
      </div>

      <div className="settings-block">
        <div className="settings-block-head">
          <h3>Invoice PDF template</h3>
          <p>
            Default A4 style for invoice PDFs. You can still pick either style from the PDF menu.
          </p>
        </div>
        <div className="invoice-template-picker" role="radiogroup" aria-label="Invoice PDF template">
          <label
            className={`invoice-template-option${
              values.invoicePdfTemplate === "tally" ? " is-selected" : ""
            }`}
          >
            <input
              type="radio"
              name="invoicePdfTemplate"
              value="tally"
              checked={values.invoicePdfTemplate === "tally"}
              onChange={() => updateField("invoicePdfTemplate", "tally")}
            />
            <span className="invoice-template-preview tally" aria-hidden="true" />
            <span className="invoice-template-copy">
              <strong>Tally style</strong>
              <em>Classic boxed tax invoice with dense grids</em>
            </span>
          </label>
          <label
            className={`invoice-template-option${
              values.invoicePdfTemplate === "flipkart" ? " is-selected" : ""
            }`}
          >
            <input
              type="radio"
              name="invoicePdfTemplate"
              value="flipkart"
              checked={values.invoicePdfTemplate === "flipkart"}
              onChange={() => updateField("invoicePdfTemplate", "flipkart")}
            />
            <span className="invoice-template-preview flipkart" aria-hidden="true" />
            <span className="invoice-template-copy">
              <strong>Flipkart style</strong>
              <em>Modern marketplace invoice with blue accent</em>
            </span>
          </label>
        </div>
      </div>

      <div className="settings-block">
        <div className="settings-block-head">
          <h3>Bank details</h3>
          <p>
            Default bank for invoices. Each branch can override this under Branches.
          </p>
        </div>
        <div className="invoice-grid">
          <label>
            <span>Bank name</span>
            <input
              className="field"
              required
              value={values.bankName}
              onChange={(e) => updateField("bankName", e.target.value)}
            />
          </label>
          <label>
            <span>Account number</span>
            <input
              className="field"
              required
              value={values.accountNo}
              onChange={(e) => updateField("accountNo", e.target.value)}
            />
          </label>
          <label>
            <span>IFSC</span>
            <input
              className="field"
              required
              value={values.ifsc}
              onChange={(e) => updateField("ifsc", e.target.value)}
            />
          </label>
          <label>
            <span>Bank branch</span>
            <input
              className="field"
              required
              value={values.bankBranch}
              onChange={(e) => updateField("bankBranch", e.target.value)}
            />
          </label>
          <label>
            <span>UPI</span>
            <input
              className="field"
              required
              value={values.upi}
              onChange={(e) => updateField("upi", e.target.value)}
            />
          </label>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}
      {ok && <p className="mt-4 text-sm text-emerald-700">{ok}</p>}

      <div className="invoice-actions">
        <button className="btn btn-primary" disabled={loading} type="submit">
          {loading ? "Saving..." : "Save company settings"}
        </button>
      </div>
    </form>
  );
}
