import { projects, type Tx } from '@bhoomisetu/db';
import type { Pack } from '@bhoomisetu/rules';
import { eq } from 'drizzle-orm';
import type { RulesService } from '../rules/rules.service';
import { ProblemException } from './errors/problem';

/** The project (visible under RLS) and its pinned rule pack. */
export async function projectPack(tx: Tx, rules: RulesService, projectId: string) {
  const [project] = await tx.select().from(projects).where(eq(projects.id, projectId));
  if (!project) throw new ProblemException(404, 'PROJECT_NOT_FOUND', 'No such project in your jurisdiction.');
  if (!project.rulePackCode || !project.rulePackVersion)
    throw new ProblemException(409, 'PROJECT_NOT_SUBMITTED', 'The project has no pinned rule pack.');
  const pack: Pack | undefined = rules.get(project.rulePackCode, project.rulePackVersion);
  if (!pack) throw new ProblemException(500, 'PACK_MISSING', 'Pinned pack is not loaded.');
  return { project, pack };
}
