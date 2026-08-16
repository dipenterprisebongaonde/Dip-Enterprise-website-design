export const INVOICE_PDF_TEMPLATES = [
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
  return value === "thermal80";
}

export function getInvoicePdfTemplateMeta(id: InvoicePdfTemplate) {
  return INVOICE_PDF_TEMPLATES.find((template) => template.id === id) || INVOICE_PDF_TEMPLATES[0];
}
