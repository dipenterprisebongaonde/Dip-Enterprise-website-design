
import Link from "next/link";
import { ReactNode } from "react";

export type SplitListItem = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  amount: string;
  status: string;
  statusTone?: "ok" | "warn" | "muted" | "accent";
  href?: string;
  active?: boolean;
};

export function SplitDarkPanel({
  listTitle,
  items,
  detailTitle,
  detailSubtitle,
  detailRows,
  detailTotalLabel,
  detailTotalValue,
  detailAction,
}: {
  listTitle: string;
  items: SplitListItem[];
  detailTitle: string;
  detailSubtitle: string;
  detailRows: { label: string; value: string }[];
  detailTotalLabel: string;
  detailTotalValue: string;
  detailAction?: ReactNode;
}) {
  const active = items.find((item) => item.active) || items[0];

  return (
    <section className="split-dark">
      <div className="split-list">
        <div className="split-list-head">
          <h3>{listTitle}</h3>
          <span>{items.length}</span>
        </div>
        <div className="split-list-body">
          {items.map((item) => {
            const content = (
              <>
                <div className="split-avatar">{item.title.slice(0, 1)}</div>
                <div className="split-copy">
                  <strong>{item.title}</strong>
                  <span>
                    {item.subtitle} · {item.meta}
                  </span>
                </div>
                <div className="split-right">
                  <em className={`tag tag-${item.statusTone || "muted"}`}>{item.status}</em>
                  <b>{item.amount}</b>
                </div>
              </>
            );

            if (item.href) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`split-item ${item.active || item.id === active?.id ? "active" : ""}`}
                >
                  {content}
                </Link>
              );
            }

            return (
              <div
                key={item.id}
                className={`split-item ${item.active || item.id === active?.id ? "active" : ""}`}
              >
                {content}
              </div>
            );
          })}
          {items.length === 0 && <p className="split-empty">No records yet.</p>}
        </div>
      </div>

      <div className="split-detail">
        <div className="split-detail-card">
          <p className="eyebrow">Selected</p>
          <h3>{detailTitle}</h3>
          <p className="muted-line">{detailSubtitle}</p>
          <div className="detail-lines">
            {detailRows.map((row) => (
              <div key={row.label} className="detail-line">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
          <div className="detail-total">
            <span>{detailTotalLabel}</span>
            <strong>{detailTotalValue}</strong>
          </div>
          {detailAction}
        </div>
      </div>
    </section>
  );
}
