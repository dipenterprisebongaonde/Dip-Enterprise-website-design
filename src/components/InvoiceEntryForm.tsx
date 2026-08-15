"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PaymentProofView, ProofLocalPreview } from "@/components/PaymentProofView";
import {
  getIndianFinancialYear,
  isAutoInvoiceNumber,
  parseDateInput,
} from "@/lib/invoice-number-format";
import { CHARGE_PRESETS } from "@/lib/invoice-lines";
import { computeNearestRupeeRoundOff } from "@/lib/payments";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { PAYMENT_PROOF_ACCEPT } from "@/lib/payment-proof";

type Option = { label: string; value: string; unitPrice?: number; unit?: string };

type LineDraft = {
  key: string;
  item: string;
  quantity: number;
  gross: number;
  unitPrice: number;
};

type ChargeDraft = {
  key: string;
  label: string;
  amount: number;
};

type InitialValues = {
  invoiceNo?: string;
  invoiceDate?: string;
  paymentStatus?: string;
  paidAmount?: number;
  paidAt?: string;
  paymentMethod?: string;
  notes?: string;
  customerId?: string | null;
  vendorId?: string | null;
  branchId?: string | null;
  lines?: Array<{ item: string; quantity: number; gross?: number; unitPrice: number }>;
  charges?: Array<{ label: string; amount: number }>;
  roundOff?: number;
  applyRoundOff?: boolean;
  proofUrl?: string | null;
  proofFileName?: string | null;
  proofMimeType?: string | null;
  proofPaymentId?: string | null;
};

function makeKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyLine(): LineDraft {
  return { key: makeKey(), item: "", quantity: 1, gross: 1, unitPrice: 0 };
}

function emptyCharge(label = ""): ChargeDraft {
  return { key: makeKey(), label, amount: 0 };
}

export function InvoiceEntryForm({
  mode,
  action,
  method = "POST",
  backHref,
  invoiceNo,
  products,
  parties,
  branches,
  showBranch,
  initialValues,
}: {
  mode: "sale" | "purchase";
  action: string;
  method?: "POST" | "PUT";
  backHref: string;
  invoiceNo: string;
  products: Option[];
  parties: Option[];
  branches: Option[];
  showBranch: boolean;
  initialValues?: InitialValues;
}) {
  const router = useRouter();
  const isEdit = method === "PUT";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(
    initialValues?.paymentStatus || "UNPAID"
  );
  const [paidAmount, setPaidAmount] = useState(initialValues?.paidAmount ?? 0);
  const [paidAt, setPaidAt] = useState(
    initialValues?.paidAt || new Date().toISOString().slice(0, 10)
  );
  const [paymentMethod, setPaymentMethod] = useState(
    initialValues?.paymentMethod || "UPI"
  );
  const [invoiceDate, setInvoiceDate] = useState(
    initialValues?.invoiceDate || new Date().toISOString().slice(0, 10)
  );
  const [invoiceNoValue, setInvoiceNoValue] = useState(
    initialValues?.invoiceNo || invoiceNo
  );
  const [invoiceNoLocked, setInvoiceNoLocked] = useState(isEdit);
  const [invoiceNoLoading, setInvoiceNoLoading] = useState(false);
  const lastAutoInvoiceNo = useRef(initialValues?.invoiceNo || invoiceNo);
  const [proof, setProof] = useState<File | null>(null);
  const [lines, setLines] = useState<LineDraft[]>(
    initialValues?.lines?.length
      ? initialValues.lines.map((line) => ({
          key: makeKey(),
          item: line.item,
          quantity: line.quantity,
          gross: line.gross && line.gross > 0 ? line.gross : line.quantity,
          unitPrice: line.unitPrice,
        }))
      : [emptyLine()]
  );
  const [charges, setCharges] = useState<ChargeDraft[]>(
    initialValues?.charges?.length
      ? initialValues.charges.map((charge) => ({
          key: makeKey(),
          label: charge.label,
          amount: charge.amount,
        }))
      : []
  );
  const [applyRoundOff, setApplyRoundOff] = useState(() => {
    if (typeof initialValues?.applyRoundOff === "boolean") return initialValues.applyRoundOff;
    if (typeof initialValues?.roundOff === "number") return initialValues.roundOff !== 0;
    return true;
  });

  const productsTotal = useMemo(
    () =>
      Number(
        lines
          .reduce(
            (sum, line) =>
              sum + Math.max(line.gross, 0) * Math.max(line.unitPrice, 0),
            0
          )
          .toFixed(2)
      ),
    [lines]
  );

  const chargesTotal = useMemo(
    () =>
      Number(
        charges
          .reduce((sum, charge) => sum + Math.max(charge.amount, 0), 0)
          .toFixed(2)
      ),
    [charges]
  );

  const subtotalValue = useMemo(
    () => Number((productsTotal + chargesTotal).toFixed(2)),
    [productsTotal, chargesTotal]
  );

  const roundOffValue = useMemo(
    () => (applyRoundOff ? computeNearestRupeeRoundOff(subtotalValue) : 0),
    [applyRoundOff, subtotalValue]
  );

  const totalValue = useMemo(
    () => Number((subtotalValue + roundOffValue).toFixed(2)),
    [subtotalValue, roundOffValue]
  );

  const dueValue = useMemo(
    () => Number(Math.max(0, totalValue - paidAmount).toFixed(2)),
    [totalValue, paidAmount]
  );

  useEffect(() => {
    if (paymentStatus === "UNPAID") {
      setPaidAmount(0);
    } else if (paymentStatus === "PAID") {
      setPaidAmount(totalValue);
    } else if (paymentStatus === "PARTIAL" && paidAmount >= totalValue) {
      setPaidAmount(Number((totalValue * 0.5).toFixed(2)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentStatus, totalValue]);

  useEffect(() => {
    if (invoiceNoLocked || isEdit) return;

    const date = parseDateInput(invoiceDate);
    const fy = getIndianFinancialYear(date).label;
    let cancelled = false;

    async function syncInvoiceNo() {
      // Only auto-refresh when the field still looks generated / untouched.
      if (
        invoiceNoValue !== lastAutoInvoiceNo.current &&
        !isAutoInvoiceNumber(invoiceNoValue, mode)
      ) {
        return;
      }

      const currentFyMatch = invoiceNoValue.match(/\b(\d{2}-\d{2})\//);
      if (currentFyMatch?.[1] === fy && isAutoInvoiceNumber(invoiceNoValue, mode)) {
        return;
      }

      setInvoiceNoLoading(true);
      try {
        const endpoint =
          mode === "sale"
            ? `/api/app/sales/next-invoice-no?date=${encodeURIComponent(invoiceDate)}`
            : `/api/app/purchases/next-invoice-no?date=${encodeURIComponent(invoiceDate)}`;
        const res = await fetch(endpoint);
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok || !data.invoiceNo) return;
        setInvoiceNoValue(data.invoiceNo);
        lastAutoInvoiceNo.current = data.invoiceNo;
      } finally {
        if (!cancelled) setInvoiceNoLoading(false);
      }
    }

    void syncInvoiceNo();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceDate, isEdit, mode, invoiceNoLocked]);

  const partyLabel = mode === "sale" ? "Customer" : "Vendor";
  const partyName = mode === "sale" ? "customerId" : "vendorId";
  const title = isEdit
    ? mode === "sale"
      ? "Edit sales invoice"
      : "Edit purchase bill"
    : mode === "sale"
      ? "Create sales invoice"
      : "Create purchase bill";

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  }

  function addLine() {
    setLines((current) => [...current, emptyLine()]);
  }

  function removeLine(key: string) {
    setLines((current) => (current.length <= 1 ? current : current.filter((line) => line.key !== key)));
  }

  function updateCharge(key: string, patch: Partial<ChargeDraft>) {
    setCharges((current) =>
      current.map((charge) => (charge.key === key ? { ...charge, ...patch } : charge))
    );
  }

  function addCharge(label = "") {
    setCharges((current) => [...current, emptyCharge(label)]);
  }

  function removeCharge(key: string) {
    setCharges((current) => current.filter((charge) => charge.key !== key));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const validLines = lines.filter(
      (line) => line.item.trim() && line.quantity > 0 && line.gross > 0
    );
    if (validLines.length === 0) {
      setLoading(false);
      setError("Add at least one product with Qty and Gross.");
      return;
    }

    if (paymentStatus === "PARTIAL") {
      if (paidAmount <= 0) {
        setLoading(false);
        setError("Enter the amount already paid for a partial payment.");
        return;
      }
      if (paidAmount >= totalValue) {
        setLoading(false);
        setError("Partial paid amount must be less than the total.");
        return;
      }
    }

    const validCharges = charges.filter(
      (charge) => charge.label.trim() && charge.amount > 0
    );

    const form = new FormData(event.currentTarget);
    const payload = {
      invoiceNo: invoiceNoValue.trim(),
      invoiceDate,
      lines: validLines.map((line) => ({
        item: line.item,
        quantity: line.quantity,
        gross: line.gross,
        unitPrice: line.unitPrice,
        amount: Number((line.gross * line.unitPrice).toFixed(2)),
      })),
      charges: validCharges.map((charge) => ({
        label: charge.label.trim(),
        amount: Number(charge.amount.toFixed(2)),
      })),
      applyRoundOff,
      roundOff: roundOffValue,
      amount: totalValue,
      paymentStatus,
      paidAmount:
        paymentStatus === "PAID"
          ? totalValue
          : paymentStatus === "UNPAID"
            ? 0
            : paidAmount,
      paidAt:
        paymentStatus === "UNPAID" ? undefined : paidAt || invoiceDate,
      paymentMethod: paymentStatus === "UNPAID" ? undefined : paymentMethod || null,
      notes: String(form.get("notes") || ""),
      [partyName]: String(form.get(partyName) || "") || null,
      branchId: String(form.get("branchId") || "") || undefined,
    };

    let res: Response;
    if (proof && paymentStatus !== "UNPAID") {
      const body = new FormData();
      body.append("data", JSON.stringify(payload));
      body.append("proof", proof);
      res = await fetch(action, { method, body });
    } else {
      res = await fetch(action, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Could not save invoice");
      return;
    }

    router.push(backHref);
    router.refresh();
  }

  const defaultPartyId =
    mode === "sale" ? initialValues?.customerId || "" : initialValues?.vendorId || "";

  return (
    <form onSubmit={onSubmit} className="invoice-sheet">
      <div className="invoice-sheet-head">
        <div>
          <p className="eyebrow">{mode === "sale" ? "Sales" : "Purchases"}</p>
          <h2>{title}</h2>
          <p className="text-[var(--muted)]">
            Add one or many products. Totals and stock update from all lines.
          </p>
        </div>
        <Link href={backHref} className="btn btn-ghost">
          Cancel
        </Link>
      </div>

      <div className="invoice-grid">
        <label>
          <span>Invoice No</span>
          <input
            className="field"
            name="invoiceNo"
            value={invoiceNoValue}
            onChange={(e) => {
              setInvoiceNoValue(e.target.value);
              setInvoiceNoLocked(true);
            }}
            required
            placeholder={mode === "sale" ? "INV 26-27/0001" : "PUR 26-27/0001"}
          />
          <span className="field-hint">
            FY follows invoice date
            {invoiceNoLoading ? " · updating…" : ""}
            {invoiceNoLocked ? " · manual" : ""}
          </span>
        </label>
        <label>
          <span>Date</span>
          <input
            className="field"
            type="date"
            name="invoiceDate"
            value={invoiceDate}
            onChange={(e) => {
              setInvoiceDate(e.target.value);
              // Re-enable FY sync when date changes unless user typed a custom number.
              if (!invoiceNoLocked || isAutoInvoiceNumber(invoiceNoValue, mode)) {
                setInvoiceNoLocked(false);
              }
            }}
            required
          />
        </label>
        <label>
          <span>{partyLabel}</span>
          <select
            className="field"
            name={partyName}
            defaultValue={defaultPartyId}
            required
          >
            <option value="">Select {partyLabel.toLowerCase()}</option>
            {parties.map((party) => (
              <option key={party.value} value={party.value}>
                {party.label}
              </option>
            ))}
          </select>
        </label>
        {showBranch ? (
          <label>
            <span>Branch</span>
            <select
              className="field"
              name="branchId"
              required
              defaultValue={initialValues?.branchId || ""}
            >
              <option value="">Select branch</option>
              {branches.map((branch) => (
                <option key={branch.value} value={branch.value}>
                  {branch.label}
                </option>
              ))}
            </select>
          </label>
        ) : initialValues?.branchId ? (
          <input type="hidden" name="branchId" value={initialValues.branchId} />
        ) : null}
      </div>

      <div className="invoice-lines">
        <div className="invoice-lines-head">
          <div>
            <h3>Products</h3>
            <p>
              Qty updates inventory. Gross × Price sets the total amount.
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={addLine}>
            + Add product
          </button>
        </div>

        <div className="invoice-lines-list">
          {lines.map((line, index) => {
            const lineTotal = Number((line.gross * line.unitPrice).toFixed(2));
            const unitSuffix = (() => {
              const match = products.find((product) => product.value === line.item);
              return match?.unit ? ` (${match.unit})` : "";
            })();
            return (
              <div key={line.key} className="invoice-line-row invoice-line-row-gross">
                <label className="invoice-line-field">
                  <span className="invoice-line-label">Product {index + 1}</span>
                  <select
                    className="field"
                    required
                    value={line.item}
                    onChange={(e) => {
                      const next = e.target.value;
                      const match = products.find((product) => product.value === next);
                      updateLine(line.key, {
                        item: next,
                        unitPrice:
                          match && typeof match.unitPrice === "number"
                            ? match.unitPrice
                            : line.unitPrice,
                      });
                    }}
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.value} value={product.value}>
                        {product.label}
                      </option>
                    ))}
                  </select>
                  <span className="invoice-line-hint" aria-hidden>
                    &nbsp;
                  </span>
                </label>
                <label className="invoice-line-field">
                  <span className="invoice-line-label">Qty{unitSuffix}</span>
                  <input
                    className="field"
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(line.key, { quantity: Number(e.target.value) || 0 })
                    }
                  />
                  <span className="invoice-line-hint" aria-hidden>
                    &nbsp;
                  </span>
                </label>
                <label className="invoice-line-field">
                  <span className="invoice-line-label">Gross{unitSuffix}</span>
                  <input
                    className="field"
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={line.gross}
                    onChange={(e) =>
                      updateLine(line.key, { gross: Number(e.target.value) || 0 })
                    }
                  />
                  <span className="invoice-line-hint" aria-hidden>
                    &nbsp;
                  </span>
                </label>
                <label className="invoice-line-field">
                  <span className="invoice-line-label">Price</span>
                  <input
                    className="field"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={line.unitPrice}
                    onChange={(e) =>
                      updateLine(line.key, { unitPrice: Number(e.target.value) || 0 })
                    }
                  />
                  <span className="invoice-line-hint" aria-hidden>
                    &nbsp;
                  </span>
                </label>
                <label className="invoice-line-field">
                  <span className="invoice-line-label">Total Amount</span>
                  <input className="field" value={lineTotal} readOnly />
                  <span className="invoice-line-hint" aria-hidden>
                    &nbsp;
                  </span>
                </label>
                <button
                  type="button"
                  className="btn btn-ghost line-remove"
                  onClick={() => removeLine(line.key)}
                  disabled={lines.length <= 1}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
        {products.length === 0 && (
          <p className="field-hint">No products in inventory yet. Add a product first.</p>
        )}
      </div>

      <div className="invoice-lines invoice-charges">
        <div className="invoice-lines-head">
          <div>
            <h3>Additional charges</h3>
            <p>Optional costs like car fare, labour, ice, and more</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => addCharge()}>
            + Add charge
          </button>
        </div>

        <div className="charge-presets" role="group" aria-label="Quick charges">
          {CHARGE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="login-demo-chip"
              onClick={() => addCharge(preset)}
            >
              + {preset}
            </button>
          ))}
        </div>

        {charges.length > 0 ? (
          <div className="invoice-lines-list">
            {charges.map((charge, index) => (
              <div key={charge.key} className="invoice-line-row invoice-charge-row">
                <label className="invoice-line-field">
                  <span className="invoice-line-label">Charge {index + 1}</span>
                  <input
                    className="field"
                    value={charge.label}
                    placeholder="e.g. Car fare"
                    onChange={(e) => updateCharge(charge.key, { label: e.target.value })}
                  />
                  <span className="invoice-line-hint" aria-hidden>
                    &nbsp;
                  </span>
                </label>
                <label className="invoice-line-field">
                  <span className="invoice-line-label">Amount</span>
                  <input
                    className="field"
                    type="number"
                    min={0}
                    step="0.01"
                    value={charge.amount}
                    onChange={(e) =>
                      updateCharge(charge.key, { amount: Number(e.target.value) || 0 })
                    }
                  />
                  <span className="invoice-line-hint" aria-hidden>
                    &nbsp;
                  </span>
                </label>
                <button
                  type="button"
                  className="btn btn-ghost line-remove"
                  onClick={() => removeCharge(charge.key)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="charge-empty">No extra charges added.</p>
        )}
      </div>

      <div className="invoice-grid">
        <label>
          <span>Payment status</span>
          <select
            className="field"
            name="paymentStatus"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            required
          >
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIAL">Partial</option>
            <option value="PAID">Paid</option>
          </select>
        </label>
        {(paymentStatus === "PARTIAL" || paymentStatus === "PAID") && (
          <label>
            <span>Paid amount</span>
            <input
              className="field"
              type="number"
              name="paidAmount"
              min={0}
              max={paymentStatus === "PARTIAL" ? Math.max(totalValue - 0.01, 0) : totalValue}
              step="0.01"
              required
              readOnly={paymentStatus === "PAID"}
              value={paidAmount}
              onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
            />
          </label>
        )}
        {(paymentStatus === "PARTIAL" || paymentStatus === "PAID") && (
          <label>
            <span>Due amount</span>
            <input className="field" value={dueValue} readOnly />
          </label>
        )}
        {(paymentStatus === "PARTIAL" || paymentStatus === "PAID") && (
          <label>
            <span>Paying date</span>
            <input
              className="field"
              type="date"
              name="paidAt"
              required
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </label>
        )}
        {(paymentStatus === "PARTIAL" || paymentStatus === "PAID") && (
          <label className="full proof-upload">
            <span>Payment proof</span>
            <input
              className="field"
              type="file"
              accept={PAYMENT_PROOF_ACCEPT}
              onChange={(e) => setProof(e.target.files?.[0] || null)}
            />
            <span className="field-hint">Screenshot or PDF (optional, max 8 MB)</span>
            <ProofLocalPreview file={proof} />
            {!proof && initialValues?.proofUrl ? (
              <PaymentProofView
                url={initialValues.proofUrl}
                fileName={initialValues.proofFileName}
                mimeType={initialValues.proofMimeType}
                removeSource={mode === "sale" ? "sale" : "purchase"}
                removePaymentId={initialValues.proofPaymentId}
              />
            ) : null}
          </label>
        )}
        <label className="full">
          <span>Notes</span>
          <input
            className="field"
            name="notes"
            placeholder="Optional note"
            defaultValue={initialValues?.notes || ""}
          />
        </label>
      </div>

      <div className="round-off-bar">
        <div className="round-off-copy">
          <p className="round-off-title">Round off</p>
          <p className="round-off-sub">
            {applyRoundOff
              ? "On · total will round to the nearest rupee"
              : "Off · keep exact paisa total"}
          </p>
        </div>
        <div className="round-off-controls">
          <div className="round-off-switch" role="group" aria-label="Round off">
            <button
              type="button"
              className={`round-off-btn${!applyRoundOff ? " is-active" : ""}`}
              aria-pressed={!applyRoundOff}
              onClick={() => setApplyRoundOff(false)}
            >
              Off
            </button>
            <button
              type="button"
              className={`round-off-btn${applyRoundOff ? " is-active" : ""}`}
              aria-pressed={applyRoundOff}
              onClick={() => setApplyRoundOff(true)}
            >
              On
            </button>
          </div>
          <strong className="round-off-amount">
            {roundOffValue >= 0 ? "+" : "−"}₹
            {Math.abs(roundOffValue).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </strong>
        </div>
      </div>

      <div className="invoice-summary">
        <div>
          <p>Products</p>
          <strong>₹{productsTotal.toLocaleString()}</strong>
        </div>
        <div>
          <p>Extra charges</p>
          <strong>₹{chargesTotal.toLocaleString()}</strong>
        </div>
        <div>
          <p>Round off</p>
          <strong>
            {roundOffValue >= 0 ? "+" : "−"}₹{Math.abs(roundOffValue).toLocaleString("en-IN")}
          </strong>
        </div>
        <div>
          <p>Total value</p>
          <strong>₹{totalValue.toLocaleString()}</strong>
        </div>
        <div>
          <p>Paid</p>
          <strong>₹{paidAmount.toLocaleString()}</strong>
        </div>
        <div>
          <p>Due</p>
          <strong>₹{dueValue.toLocaleString()}</strong>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}

      <div className="invoice-actions">
        <button className="btn btn-primary" disabled={loading} type="submit">
          {loading
            ? "Saving..."
            : isEdit
              ? "Update invoice"
              : mode === "sale"
                ? "Save sale invoice"
                : "Save purchase bill"}
        </button>
      </div>
    </form>
  );
}
