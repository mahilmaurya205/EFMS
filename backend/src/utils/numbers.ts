import { NumberSequence } from "../models/NumberSequence.js";

const prefixes: Record<string, string> = {
  payment: "PV",
  receipt: "RV",
  journal: "JV",
  contra: "CV",
  refund: "RF",
  salary: "SV",
  advance: "AV",
  expense: "EV",
  quotation: "QT",
  proforma: "PI",
  tax_invoice: "TI",
  credit_note: "CN",
  debit_note: "DN"
};

export async function nextDocumentNumber(key: string) {
  const prefix = prefixes[key] ?? key.slice(0, 2).toUpperCase();
  const sequence = await NumberSequence.findOneAndUpdate(
    { key },
    { $setOnInsert: { prefix }, $inc: { nextNumber: 1 } },
    { upsert: true, new: false }
  );
  const value = sequence?.nextNumber ?? 1;
  return `${prefix}${String(value).padStart(5, "0")}`;
}
