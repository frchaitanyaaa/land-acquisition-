import { outboxEvents, type Tx } from '@bhoomisetu/db';
import { toJsonSafe } from '../json';

export interface DomainEvent {
  /** An event name from the rule pack's `events` or §12.8, e.g. S11_PUBLISHED. */
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}

/**
 * Records a domain event in the SAME transaction as the change it announces (§9 API conventions).
 * The change and the event commit or roll back together; the relay publishes it afterwards.
 * Pass the `tx` from withScope — never a separate connection.
 */
export async function writeOutbox(tx: Tx, event: DomainEvent): Promise<void> {
  await tx.insert(outboxEvents).values({
    type: event.type,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    payload: toJsonSafe(event.payload),
  });
}
