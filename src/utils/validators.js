import { z } from 'zod';

export const OrderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  basePrice: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),
  size: z.string().optional().default('Std'),
  sizeName: z.string().optional().default('Mặc định'),
  notes: z.string().optional().default(''),
  toppings: z.array(z.any()).optional().default([]),
  cartItemId: z.string().optional()
});

export const OrderSchema = z.object({
  id: z.string().min(1),
  tableId: z.string().nullable().optional(),
  tableName: z.string().default(''),
  status: z.enum(['serving', 'awaiting_payment', 'completed', 'cancelled', 'unpaid_carried_over']),
  cashier: z.string().default('Thu ngân'),
  customerCount: z.number().int().min(0).default(1),
  items: z.array(OrderItemSchema).default([]),
  discountPercent: z.number().min(0).max(100).default(0),
  surcharge: z.number().min(0).default(0),
  subtotal: z.number().min(0).default(0),
  total: z.number().min(0).default(0),
  paidAmount: z.number().min(0).default(0),
  remainingAmount: z.number().min(0).default(0),
  splitPayments: z.array(z.any()).optional().default([]),
  paymentMethod: z.string().nullable().optional(),
  businessDate: z.string().optional(),
  createdAt: z.string().optional(),
  finishedAt: z.string().nullable().optional()
});

export const PaymentRecordSchema = z.object({
  id: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.number().positive(),
  paymentMethod: z.enum(['cash', 'vietqr', 'card', 'transfer']).default('cash'),
  paymentStatus: z.enum(['completed', 'pending', 'cancelled']).default('completed'),
  paidAt: z.string(),
  businessDate: z.string(),
  cashierId: z.string().default('Thu ngân'),
  idempotencyKey: z.string().optional(),
  notes: z.string().nullable().optional()
});

export function validateOrder(data) {
  return OrderSchema.safeParse(data);
}

export function validatePayment(data) {
  return PaymentRecordSchema.safeParse(data);
}
