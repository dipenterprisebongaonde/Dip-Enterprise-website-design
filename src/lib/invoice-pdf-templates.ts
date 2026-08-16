export const INVOICE_PDF_TEMPLATES = [
  {
    id: "tally",
    name: "Tally style",
    blurb: "Classic boxed A4 tax invoice",
    kind: "a4",
  },
  {
    id: "flipkart",
    name: "Flipkart style",
    blurb: "Modern marketplace A4 layout",
    kind: "a4",
  },
  {
    id: "modern",
    name: "Modern clean",
    blurb: "Soft cards with teal accent bar",
    kind: "a4",
  },
  {
    id: "classic",
    name: "Classic formal",
    blurb: "Traditional serif business invoice",
    kind: "a4",
  },
  {
    id: "compact",
    name: "Compact pro",
    blurb: "Dense A4 packing for long bills",
    kind: "a4",
  },
  {
    id: "bold",
    name: "Bold brand",
    blurb: "Strong header band and high contrast",
    kind: "a4",
  },
  {
    id: "minimal",
    name: "Minimal",
    blurb: "Airy layout with light rules only",
    kind: "a4",
  },
  {
    id: "gst",
    name: "GST focused",
    blurb: "Indian tax invoice with clear GST splits",
    kind: "a4",
  },
  {
    id: "thermal80",
    name: "Thermal 80mm",
    blurb: "Narrow receipt for 80mm printers",
    kind: "thermal",
  },
  {
    id: "thermal58",
    name: "Thermal 58mm",
    blurb: "Compact receipt for 58mm printers",
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
