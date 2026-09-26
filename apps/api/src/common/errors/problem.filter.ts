import { Catch, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { requestContext } from '../context/request-context';
import { toProblem } from './problem';

/** Every error leaves the API as application/problem+json (RFC 7807). */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger('Problem');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const problem = toProblem(exception);
    const requestId = requestContext.get()?.requestId;

    if (problem.status >= 500) {
      this.logger.error(`${req.method} ${req.originalUrl} [${requestId}]`, (exception as Error)?.stack ?? String(exception));
    }
    if (res.headersSent) return;

    res
      .status(problem.status)
      .type('application/problem+json')
      .json({ ...problem, instance: req.originalUrl, requestId });
  }
}
