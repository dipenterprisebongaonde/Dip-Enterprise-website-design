export const INVOICE_PDF_TEMPLATES = [
  {
    id: "atelier",
    name: "Atelier",
    blurb: "Black & white serif invoice with thank-you script",
    kind: "a4",
  },
  {
    id: "limeEdge",
    name: "Lime Edge",
    blurb: "Geometric dark header with lime accents",
    kind: "a4",
  },
  {
    id: "navyGold",
    name: "Navy Gold",
    blurb: "Navy header with mustard invoice banner",
    kind: "a4",
  },
  {
    id: "softWave",
    name: "Soft Wave",
    blurb: "Minimal layout with wave footer",
    kind: "a4",
  },
  {
    id: "thermal80",
    name: "Thermal 80mm",
    blurb: "Narrow receipt for 80mm printers",
    kind: "thermal",
  },
] as const;

export type InvoicePdfTemplate = (typeof INVOICE_PDF_TEMPLATES)[number]["id"];

export const INVOICE_PDF_TEMPLATE_IDS = INVOICE_PDF_TEMPLATES.map(
  (template) => template.id
) as [InvoicePdfTemplate, ...InvoicePdfTemplate[]];

export function isInvoicePdfTemplate(value: unknown): value is InvoicePdfTemplate {
  return (
    typeof value === "string" &&
    (INVOICE_PDF_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export function getInvoicePdfTemplateMeta(id: InvoicePdfTemplate) {
  return INVOICE_PDF_TEMPLATES.find((template) => template.id === id) || INVOICE_PDF_TEMPLATES[0];
}
