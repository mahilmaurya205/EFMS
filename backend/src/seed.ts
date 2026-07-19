import bcrypt from "bcryptjs";
import { connectDatabase } from "./config/db.js";
import { ApprovalRule } from "./models/ApprovalRule.js";
import { User } from "./models/User.js";
import { BankAccount } from "./models/BankAccount.js";

await connectDatabase();

const passwordHash = await bcrypt.hash("Admin@123", 10);

await User.updateOne(
  { email: "admin@efms.local" },
  {
    $setOnInsert: {
      name: "EFMS Admin",
      email: "admin@efms.local",
      passwordHash,
      role: "super_admin",
      department: "Finance"
    }
  },
  { upsert: true }
);

await ApprovalRule.deleteMany({});
await ApprovalRule.insertMany([
  { name: "Standard Expense Approval", appliesTo: "expense", minAmount: 0, maxAmount: 2000, approverRoles: ["manager", "admin"] },
  { name: "Finance Approval", appliesTo: "expense", minAmount: 2000, maxAmount: 25000, approverRoles: ["manager", "accountant", "admin"] },
  { name: "Director Approval", appliesTo: "expense", minAmount: 25000, approverRoles: ["manager", "finance_head", "director"] }
]);

await BankAccount.updateOne(
  { accountNumber: "0000000001" },
  { $setOnInsert: { bankName: "Demo Bank", accountNumber: "0000000001", currentBalance: 100000 } },
  { upsert: true }
);

console.log("Seed complete");
process.exit(0);
