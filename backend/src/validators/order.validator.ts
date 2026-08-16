import { z } from "zod";

const orderItemInputSchema = z.object({
  productId: z.string().length(24),
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(50),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemInputSchema).min(1),
  shippingAddress: z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().email(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?880?1[0-9]{9}$/, "Enter a valid Bangladeshi phone number"),
    fullAddress: z.string().trim().min(3).max(300),
    district: z.string().trim().min(1).max(80),
    cityArea: z.string().trim().min(1).max(120),
  }),
  deliveryMethod: z.enum(["standard", "express"]),
  paymentMethod: z.enum(["cod", "bkash", "nagad"]),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]),
  note: z.string().trim().max(300).optional(),
});

export const listOrdersQuerySchema = z.object({
  status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const trackOrderQuerySchema = z.object({
  orderNumber: z.string().trim().min(1).max(40),
  email: z.string().trim().email(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type TrackOrderQuery = z.infer<typeof trackOrderQuerySchema>;
