import { ParsedBillLine, PharmacyInventoryItem, UserRole } from "./page.types";

export function normalizeRole(
  role: UserRole | null | undefined,
): Exclude<UserRole, "medical"> {
  return role === "doctor" ? "doctor" : "pharmacy";
}

export function normalizeMedicineName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isNoiseLine(line: string) {
  return /invoice|subtotal|tax|gst|cgst|sgst|amount|discount|cash|total|receipt|bill\s*no|ph\.?|mobile|address|date/i.test(
    line,
  );
}

export function normalizeOcrMedicineText(line: string) {
  return normalizeMedicineName(
    line
      .replace(/[|]/g, "I")
      .replace(/[“”"']/g, "")
      .replace(/[^a-zA-Z0-9+\-()./\s]/g, " "),
  );
}

export function upsertInventoryItem(
  list: PharmacyInventoryItem[],
  incoming: {
    medicineName: string;
    antibioticClass?: string;
    purchaseDelta?: number;
    soldDelta?: number;
    reorderLevel?: number;
  },
) {
  const normalizedName = normalizeMedicineName(incoming.medicineName);
  if (!normalizedName) {
    return list;
  }

  const now = new Date().toISOString();
  const existingIndex = list.findIndex(
    (item) => item.medicineName.toLowerCase() === normalizedName.toLowerCase(),
  );

  if (existingIndex === -1) {
    const purchased = Math.max(0, Number(incoming.purchaseDelta ?? 0));
    const sold = Math.max(0, Number(incoming.soldDelta ?? 0));
    const stock = Math.max(0, purchased - sold);
    const reorder = Math.max(1, Number(incoming.reorderLevel ?? 10));
    return [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        medicineName: normalizedName,
        antibioticClass: incoming.antibioticClass?.trim() ?? "",
        purchasedQty: purchased,
        soldQty: sold,
        stockQty: stock,
        reorderLevel: reorder,
        updatedAt: now,
      },
      ...list,
    ];
  }

  const existing = list[existingIndex];
  const purchaseDelta = Math.max(0, Number(incoming.purchaseDelta ?? 0));
  const soldDelta = Math.max(0, Number(incoming.soldDelta ?? 0));
  const nextPurchased = existing.purchasedQty + purchaseDelta;
  const nextSold = existing.soldQty + soldDelta;
  const nextStock = Math.max(0, existing.stockQty + purchaseDelta - soldDelta);
  const nextReorder = Math.max(
    1,
    Number(incoming.reorderLevel ?? existing.reorderLevel),
  );

  const updated: PharmacyInventoryItem = {
    ...existing,
    antibioticClass:
      incoming.antibioticClass && incoming.antibioticClass.trim().length > 0
        ? incoming.antibioticClass.trim()
        : existing.antibioticClass,
    purchasedQty: nextPurchased,
    soldQty: nextSold,
    stockQty: nextStock,
    reorderLevel: nextReorder,
    updatedAt: now,
  };

  return list.map((item, index) => (index === existingIndex ? updated : item));
}

export function parseBillText(rawText: string): ParsedBillLine[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: ParsedBillLine[] = [];
  for (const line of lines) {
    if (isNoiseLine(line)) {
      continue;
    }

    const qtyMatch = line.match(/(?:qty|quantity|x)\s*[:\-]?\s*(\d{1,4})/i);
    const tailMatch = line.match(/(.+?)\s+(\d{1,4})$/);
    const prefixQtyMatch = line.match(/^(\d{1,4})\s+(.+)$/);
    const dashQtyMatch = line.match(/(.+?)\s*[-:]\s*(\d{1,4})$/);

    const pushLine = (medicineRaw: string, qtyRaw: string | number) => {
      const qty = Number(qtyRaw);
      const medicineName = normalizeOcrMedicineText(
        medicineRaw
          .replace(/(?:qty|quantity|x)\s*[:\-]?\s*\d{1,4}/gi, "")
          .replace(/^\d{1,4}\s+/, "")
          .replace(/\s*[-:]\s*\d{1,4}\s*$/, ""),
      );

      if (!medicineName || qty <= 0 || medicineName.length < 3) {
        return;
      }

      const alphaCount = (medicineName.match(/[a-zA-Z]/g) ?? []).length;
      if (alphaCount < 3) {
        return;
      }

      parsed.push({ medicineName, quantity: qty });
    };

    if (qtyMatch) {
      pushLine(line, qtyMatch[1]);
      continue;
    }

    if (dashQtyMatch) {
      pushLine(dashQtyMatch[1], dashQtyMatch[2]);
      continue;
    }

    if (tailMatch) {
      pushLine(tailMatch[1], tailMatch[2]);
      continue;
    }

    if (prefixQtyMatch) {
      pushLine(prefixQtyMatch[2], prefixQtyMatch[1]);
    }
  }

  const merged = new Map<string, { quantity: number; displayName: string }>();
  for (const line of parsed) {
    const key = line.medicineName.toLowerCase();
    const current = merged.get(key);
    if (current) {
      merged.set(key, {
        quantity: current.quantity + line.quantity,
        displayName: current.displayName,
      });
    } else {
      merged.set(key, {
        quantity: line.quantity,
        displayName: line.medicineName,
      });
    }
  }

  return Array.from(merged.entries())
    .map(([, value]) => ({
      medicineName: value.displayName,
      quantity: value.quantity,
    }))
    .sort((a, b) => b.quantity - a.quantity);
}

export async function preprocessImageForOcr(source: Blob | File) {
  try {
    const bitmap = await createImageBitmap(source);
    const canvas = document.createElement("canvas");
    const maxWidth = 1800;
    const scale = Math.min(1, maxWidth / bitmap.width);
    canvas.width = Math.max(1, Math.floor(bitmap.width * scale));
    canvas.height = Math.max(1, Math.floor(bitmap.height * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      return source;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let index = 0; index < data.length; index += 4) {
      const gray =
        0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
      const boosted = Math.max(0, Math.min(255, gray * 1.2 + 12));
      data[index] = boosted;
      data[index + 1] = boosted;
      data[index + 2] = boosted;
    }
    context.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/png", 0.95);
    });

    return blob ?? source;
  } catch {
    return source;
  }
}
