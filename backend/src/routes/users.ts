import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { Expense } from "../models/Expense.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logActivity } from "../services/activity.js";
import { decryptSensitive, encryptSensitive } from "../utils/encryption.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

const strongPasswordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character");

usersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [users, employeeExpenses] = await Promise.all([
      User.find().select("-passwordHash").sort({ createdAt: -1 }).lean(),
      Expense.aggregate([
        { $match: { status: { $ne: "archived" }, paidFrom: "employee", spentByEmployeeId: { $exists: true } } },
        { $group: { _id: "$spentByEmployeeId", total: { $sum: "$amount" } } }
      ])
    ]);
    const expenseTotals = new Map(employeeExpenses.map((item) => [String(item._id), item.total]));
    res.json(users.map((user) => {
      const expenseTotal = expenseTotals.get(String(user._id)) ?? 0;
      return { ...user, phone: decryptSensitive(user.phone), aadharNo: decryptSensitive(user.aadharNo), address: decryptSensitive(user.address), id: String(user._id), expenseTotal, totalPayable: Number(user.basicSalary || 0) + expenseTotal };
    }));
  })
);

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: strongPasswordSchema,
  role: z.string(),
  department: z.string().optional(),
  basicSalary: z.number().optional(),
  phone: z.string().optional(),
  aadharNo: z.string().optional(),
  address: z.string().optional(),
  designation: z.string().optional(),
  joiningDate: z.string().optional(),
  isActive: z.boolean().optional()
});

usersRouter.post(
  "/",
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    const data = createUserSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await User.create({ ...data, phone: encryptSensitive(data.phone), aadharNo: encryptSensitive(data.aadharNo), address: encryptSensitive(data.address), joiningDate: data.joiningDate ? new Date(data.joiningDate) : undefined, email: data.email.toLowerCase(), passwordHash });
    await logActivity(req, { action: "user.create", entityType: "user", entityId: user._id, newValue: { email: user.email, role: user.role } });
    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
  })
);

usersRouter.patch(
  "/:id",
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        role: z.string().optional(),
        department: z.string().optional(),
        basicSalary: z.number().optional(),
        phone: z.string().optional(),
        aadharNo: z.string().optional(),
        address: z.string().optional(),
        designation: z.string().optional(),
        joiningDate: z.string().optional(),
        isActive: z.boolean().optional(),
        password: strongPasswordSchema.optional()
      })
      .parse(req.body);

    const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : undefined;
    const { password, ...safeData } = data;
    void password;
    const update = {
      ...safeData,
      ...(data.phone !== undefined ? { phone: encryptSensitive(data.phone) } : {}),
      ...(data.aadharNo !== undefined ? { aadharNo: encryptSensitive(data.aadharNo) } : {}),
      ...(data.address !== undefined ? { address: encryptSensitive(data.address) } : {}),
      ...(passwordHash ? { passwordHash } : {}),
      ...(data.joiningDate ? { joiningDate: new Date(data.joiningDate) } : {})
    };
    const oldUser = await User.findById(req.params.id).select("-passwordHash").lean();
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found" });
    await logActivity(req, { action: "user.update", entityType: "user", entityId: user._id, oldValue: oldUser, newValue: user.toObject() });
    const output = user.toObject();
    res.json({ ...output, phone: decryptSensitive(output.phone), aadharNo: decryptSensitive(output.aadharNo), address: decryptSensitive(output.address) });
  })
);

usersRouter.delete(
  "/:id",
  requireRole("super_admin"),
  asyncHandler(async (req, res) => {
    const oldUser = await User.findById(req.params.id).select("-passwordHash").lean();
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true }).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found" });
    await logActivity(req, { action: "user.archive", entityType: "user", entityId: user._id, oldValue: oldUser, newValue: user.toObject() });
    res.json(user);
  })
);
