import { Global, Injectable, Module } from '@nestjs/common';
import { Subject, type Observable } from 'rxjs';

export interface StreamEvent {
  type: 'kpi.updated' | 'notification.created' | 'chain.anchored';
  at: Date;
  data?: unknown;
}

/** In-process fan-out for Server-Sent Events (§24.1 live updates). Single API instance. */
@Injectable()
export class StreamHub {
  private readonly subject = new Subject<StreamEvent>();

  broadcast(e: StreamEvent) {
    this.subject.next(e);
  }

  events(): Observable<StreamEvent> {
    return this.subject.asObservable();
  }
}

@Global()
@Module({ providers: [StreamHub], exports: [StreamHub] })
export class StreamHubModule {}
