import { JournalEntry } from "../models/JournalEntry.js";
import { Voucher } from "../models/Voucher.js";
import { nextDocumentNumber } from "../utils/numbers.js";

export async function postExpenseToLedger(input: {
  expenseId: string;
  amount: number;
  purpose: string;
  paidByEmployee: boolean;
  userId: string;
  employeeName?: string;
}) {
  const voucher = await Voucher.create({
    type: "expense",
    voucherNumber: await nextDocumentNumber("expense"),
    amount: input.amount,
    purpose: input.purpose,
    receiver: input.employeeName ?? "Expense Payable",
    givenBy: input.userId,
    sourceType: "expense",
    sourceId: input.expenseId
  });

  const creditAccount = input.paidByEmployee ? "Employee Payable" : "Cash/Bank";
  const journalEntry = await JournalEntry.create({
    voucherId: voucher._id,
    description: `Expense posted: ${input.purpose}`,
    createdBy: input.userId,
    lines: [
      { account: "Expense", debit: input.amount, credit: 0 },
      { account: creditAccount, debit: 0, credit: input.amount }
    ]
  });

  return { voucher, journalEntry };
}
