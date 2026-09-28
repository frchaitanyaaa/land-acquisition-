import {
  ACQUISITION_TYPES,
  APPROPRIATE_GOVTS,
  ESCROW_GATES,
  PROJECT_CATEGORIES,
  PROJECT_STATUSES,
} from '@bhoomisetu/shared';
import { z } from 'zod';

const Rupees = z.union([z.string(), z.number()]);

export const CreateProjectBody = z.strictObject({
  code: z
    .string()
    .regex(/^[A-Z0-9-]{4,32}$/)
    .optional(),
  name: z.string().min(3).max(200),
  nameLocal: z.string().max(200).nullish(),
  category: z.enum(PROJECT_CATEGORIES),
  subCategory: z.string().max(200).nullish(),
  acquisitionType: z.enum(ACQUISITION_TYPES),
  requiringBodyId: z.uuid(),
  nationalImportance: z.boolean().default(false),
  estimatedBudgetRupees: Rupees.nullish(),
  /** Total land required, hectares (display unit) — stored as m². */
  totalAreaHa: z.number().positive().nullish(),
  appropriateGovt: z.enum(APPROPRIATE_GOVTS).default('state'),
  stateCode: z.string().min(1),
  districtCodes: z.array(z.string()).max(50).default([]),
  isLinear: z.boolean().default(false),
  rowWidthM: z.number().positive().max(500).nullish(),
  isUrgency: z.boolean().default(false),
});
export type CreateProjectBody = z.infer<typeof CreateProjectBody>;

export const UpdateProjectBody = CreateProjectBody.partial().omit({ code: true });
export type UpdateProjectBody = z.infer<typeof UpdateProjectBody>;

export const ListProjectsQuery = z.object({
  status: z.enum(PROJECT_STATUSES).optional(),
  district: z.string().optional(),
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export const AlignmentJsonBody = z.object({ geojson: z.unknown() });

export const SubmitBody = z.strictObject({
  rulePack: z.object({ code: z.string(), version: z.string() }).optional(),
});

export const EscrowGateParam = z.enum(ESCROW_GATES);
export const EscrowDemandBody = z.strictObject({ amountRupees: Rupees, documentId: z.uuid().nullish() });
export const EscrowDepositBody = z.strictObject({ amountRupees: Rupees, reference: z.string().max(200).nullish() });
