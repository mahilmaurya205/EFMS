import mongoose, { Schema } from "mongoose";

const invoiceLineSchema = new Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, default: 18 }
  },
  { _id: false }
);

const invoiceSchema = new Schema(
  {
    type: { type: String, enum: ["quotation", "proforma", "tax_invoice", "receipt", "credit_note", "debit_note"], required: true },
    invoiceNumber: { type: String, required: true, unique: true },
    customer: { type: String, required: true },
    customerGst: { type: String },
    lines: [invoiceLineSchema],
    subtotal: { type: Number, required: true },
    gstAmount: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    remarks: { type: String, default: "" },
    status: { type: String, enum: ["draft", "issued", "paid", "cancelled"], default: "issued" }
  },
  { timestamps: true }
);

export const Invoice = mongoose.model("Invoice", invoiceSchema);
