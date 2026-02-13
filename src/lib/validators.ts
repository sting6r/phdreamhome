import { z } from "zod";
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/).optional()
});
export const listingSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  seoTitle: z.string().max(60).optional(),
  seoDescription: z.string().max(160).optional(),
  seoKeyword: z.string().optional(),
  price: z.coerce.number().nonnegative(),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  country: z.string().min(1),
  bedrooms: z.coerce.number().nonnegative(),
  bathrooms: z.coerce.number().nonnegative(),
  floorArea: z.coerce.number().nonnegative().optional(),
  lotArea: z.coerce.number().nonnegative().optional(),
  parking: z.coerce.number().nonnegative().optional(),
  indoorFeatures: z.array(z.string()).min(0).optional(),
  outdoorFeatures: z.array(z.string()).min(0).optional(),
  landmarks: z.array(z.string()).min(0).optional(),
  owner: z.string().min(1).optional(),
  developer: z.string().min(1).optional(),
  images: z.array(z.string()).min(0),
  status: z.string().optional(),
  type: z.string().optional(),
  industrySubtype: z.string().optional(),
  commercialSubtype: z.string().optional(),
  published: z.boolean().optional(),
  featured: z.boolean().optional(),
  featuredPreselling: z.boolean().optional()
});
