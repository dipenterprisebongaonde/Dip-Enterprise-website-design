
-- Ensure no duplicate invoice numbers exist, then enforce uniqueness.
-- If legacy rows collide, keep the oldest and suffix later ones.

UPDATE Sale
SET invoiceNo = invoiceNo || '-' || substr(id, -4)
WHERE id IN (
  SELECT s.id
  FROM Sale s
  JOIN (
    SELECT invoiceNo, MIN(createdAt) AS firstCreated
    FROM Sale
    GROUP BY invoiceNo
    HAVING COUNT(*) > 1
  ) d ON d.invoiceNo = s.invoiceNo
  WHERE s.createdAt > d.firstCreated
     OR (s.createdAt = d.firstCreated AND s.id NOT IN (
       SELECT id FROM Sale s2
       WHERE s2.invoiceNo = s.invoiceNo
       ORDER BY s2.createdAt ASC, s2.id ASC
       LIMIT 1
     ))
);

UPDATE Purchase
SET invoiceNo = invoiceNo || '-' || substr(id, -4)
WHERE id IN (
  SELECT p.id
  FROM Purchase p
  JOIN (
    SELECT invoiceNo, MIN(createdAt) AS firstCreated
    FROM Purchase
    GROUP BY invoiceNo
    HAVING COUNT(*) > 1
  ) d ON d.invoiceNo = p.invoiceNo
  WHERE p.createdAt > d.firstCreated
     OR (p.createdAt = d.firstCreated AND p.id NOT IN (
       SELECT id FROM Purchase p2
       WHERE p2.invoiceNo = p.invoiceNo
       ORDER BY p2.createdAt ASC, p2.id ASC
       LIMIT 1
     ))
);

CREATE UNIQUE INDEX IF NOT EXISTS "Sale_invoiceNo_key" ON "Sale"("invoiceNo");
CREATE UNIQUE INDEX IF NOT EXISTS "Purchase_invoiceNo_key" ON "Purchase"("invoiceNo");
