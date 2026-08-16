"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  INVOICE_PDF_TEMPLATES,
  type InvoicePdfTemplate,
} from "@/lib/invoice-pdf-templates";

type DocTab = "invoice" | "purchase";

export function InvoiceTemplatesStudio({
  initialInvoice,
  initialPurchase,
}: {
  initialInvoice: InvoicePdfTemplate;
  initialPurchase: InvoicePdfTemplate;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<DocTab>("invoice");
  const [invoiceTemplate, setInvoiceTemplate] = useState<InvoicePdfTemplate>(initialInvoice);
  const [purchaseTemplate, setPurchaseTemplate] =
    useState<InvoicePdfTemplate>(initialPurchase);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const selected = tab === "invoice" ? invoiceTemplate : purchaseTemplate;

  const activeMeta = useMemo(
    () => INVOICE_PDF_TEMPLATES.find((t) => t.id === selected) || INVOICE_PDF_TEMPLATES[0],
    [selected],
  );

  function selectTemplate(id: InvoicePdfTemplate) {
    setOk("");
    setError("");
    if (tab === "invoice") setInvoiceTemplate(id);
    else setPurchaseTemplate(id);
  }

  async function save() {
    setLoading(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/app/settings/invoice-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoicePdfTemplate: invoiceTemplate,
          purchasePdfTemplate: purchaseTemplate,
        }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(data.error || "Could not update template.");
        return;
      }
      if (data.company) {
        setInvoiceTemplate(data.company.invoicePdfTemplate);
        setPurchaseTemplate(data.company.purchasePdfTemplate);
      }
      setOk(
        tab === "invoice"
          ? "Sales invoice template updated."
          : "Purchase bill template updated.",
      );
      router.refresh();
    } catch {
      setLoading(false);
      setError("Could not update template.");
    }
  }

  return (
    <div className="tpl-studio">
      <div className="tpl-tabs" role="tablist" aria-label="Document type">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "invoice"}
          className={tab === "invoice" ? "is-active" : undefined}
          onClick={() => setTab("invoice")}
        >
          Invoice
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "purchase"}
          className={tab === "purchase" ? "is-active" : undefined}
          onClick={() => setTab("purchase")}
        >
          Purchase
        </button>
      </div>

      <p className="tpl-hint">
        {tab === "invoice"
          ? "Default PDF layout for sales invoices and bulk downloads."
          : "Default PDF layout for purchase bills and bulk downloads."}{" "}
        You can still pick any format from the PDF menu on each bill.
      </p>

      <div className="tpl-carousel" role="radiogroup" aria-label={`${tab} PDF templates`}>
        {INVOICE_PDF_TEMPLATES.map((template) => {
          const isSelected = selected === template.id;
          return (
            <button
              key={template.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`tpl-card${isSelected ? " is-selected" : ""}`}
              onClick={() => selectTemplate(template.id)}
            >
              <span className={`tpl-sheet ${template.id}`} aria-hidden="true">
                <span className="tpl-sheet-label">
                  {template.kind === "a4"
                    ? "A4"
                    : `${template.id === "thermal58" ? "58" : "80"}mm`}
                </span>
              </span>
              <span className="tpl-card-meta">
                <strong>{template.name}</strong>
                <em>{template.blurb}</em>
              </span>
              {isSelected ? (
                <span className="tpl-check" aria-hidden="true">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="tpl-active">
        <div>
          <p className="tpl-active-label">Selected template</p>
          <p className="tpl-active-name">{activeMeta.name}</p>
          <p className="tpl-active-blurb">{activeMeta.blurb}</p>
        </div>
        <div className={`tpl-sheet large ${activeMeta.id}`} aria-hidden="true">
          <span className="tpl-sheet-label">
            {activeMeta.kind === "a4" ? "A4 preview" : "Thermal preview"}
          </span>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {ok ? <p className="form-ok">{ok}</p> : null}

      <button className="btn btn-primary tpl-save" type="button" disabled={loading} onClick={save}>
        {loading ? "Updating…" : "Update Template"}
      </button>
    </div>
  );
}
