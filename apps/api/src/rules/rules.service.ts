import { syncRulePacks } from '@bhoomisetu/db';
import type { Pack } from '@bhoomisetu/rules';
import { loadPacks, packChecksum } from '@bhoomisetu/rules/fs';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { WorkerDbService } from '../common/db/worker-db.service';

/**
 * Loads packages/rules/packs at boot, resolves `extends`, validates every pack, and syncs them to
 * rule_packs. If a published (code, version) on disk no longer matches the stored checksum, boot
 * FAILS — a published version is immutable; publish a new one (§10.3, §12.1).
 */
@Injectable()
export class RulesService implements OnModuleInit {
  private readonly logger = new Logger('Rules');
  private packs = new Map<string, Pack>();

  constructor(private readonly worker: WorkerDbService) {}

  async onModuleInit(): Promise<void> {
    this.packs = loadPacks();
    const { inserted, unchanged } = await syncRulePacks(this.worker.db, this.packs);
    this.logger.log(`rule packs: ${inserted.length} loaded, ${unchanged.length} unchanged (${[...this.packs.keys()].join(', ')})`);
  }

  list() {
    return [...this.packs.values()].map((p) => ({
      code: p.code,
      version: p.version,
      title: p.title,
      governingAct: p.governingAct,
      jurisdiction: p.jurisdiction,
      extends: p.extends ?? null,
      effectiveFrom: p.effectiveFrom,
      checksum: packChecksum(p),
      stages: p.stages.length,
      clocks: p.clocks.length,
      verify: p.verify ?? [],
    }));
  }

  get(code: string, version: string): Pack | undefined {
    return this.packs.get(`${code}@${version}`);
  }
}
