import { TRANSITION_ACTIONS } from '@bhoomisetu/shared';
import { z } from 'zod';

/** Body of POST /projects/:projectId/stages/:stageCode/actions (§13). */
export const StageActionBody = z.strictObject({
  action: z.enum(TRANSITION_ACTIONS),
  reasonCode: z.string().max(64).nullish(),
  remarks: z.string().max(4000).nullish(),
  /** RETURN only: send the file back to an earlier stage. */
  targetStageCode: z.string().max(64).nullish(),
  /** OVERRIDE only (s.8(2)). */
  writtenReasons: z.string().max(20000).nullish(),
  documentIds: z.array(z.uuid()).max(50).default([]),
  /** APPROVE_CONDITIONAL only. */
  conditions: z.string().max(4000).nullish(),
  /** The officer ticked the declaration for actions the pack marks requiresAttestation. */
  attest: z.boolean().default(false),
});
export type StageActionBody = z.infer<typeof StageActionBody>;

export const StageCodeParam = z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'stage code');
