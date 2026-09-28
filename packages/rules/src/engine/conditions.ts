import type { AcquisitionType, ProjectStatus } from '@bhoomisetu/shared';
import type { Condition, Pack } from '../../schema/pack.schema';

/** The project facts that stage applicability and checklist conditions are evaluated against. */
export interface ProjectFacts {
  acquisitionType: AcquisitionType;
  isUrgency: boolean;
  inScheduledArea: boolean;
  /** Sum of affected area across the project's parcels, m². */
  affectedAreaSqm?: number;
  status: ProjectStatus;
}

/** Area units are geometry constants, not statute; kept here so the engine has no I/O deps. */
const SQM_PER_ACRE = 4046.8564224;

export function evaluateCondition(pack: Pack, cond: Condition | undefined, project: ProjectFacts): boolean {
  if (!cond) return true;
  const results: boolean[] = [];
  if (cond.all) results.push(cond.all.every((c) => evaluateCondition(pack, c, project)));
  if (cond.any) results.push(cond.any.some((c) => evaluateCondition(pack, c, project)));
  if (cond.not) results.push(!evaluateCondition(pack, cond.not, project));
  if (cond.acquisitionTypeIn) results.push(cond.acquisitionTypeIn.includes(project.acquisitionType));
  if (cond.isUrgency !== undefined) results.push(project.isUrgency === cond.isUrgency);
  if (cond.inScheduledArea !== undefined) results.push(project.inScheduledArea === cond.inScheduledArea);
  if (cond.rnrCommitteeRequired !== undefined) {
    const acres = pack.thresholds.rnrCommitteeAcres;
    const required = acres !== undefined && (project.affectedAreaSqm ?? 0) >= acres * SQM_PER_ACRE;
    results.push(required === cond.rnrCommitteeRequired);
  }
  return results.every(Boolean);
}
