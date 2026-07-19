import mongoose, { Schema } from "mongoose";

const numberSequenceSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    prefix: { type: String, required: true },
    nextNumber: { type: Number, default: 1 }
  },
  { timestamps: true }
);

export const NumberSequence = mongoose.model("NumberSequence", numberSequenceSchema);
