import { logger } from '../backend/logger';

export interface Job {
  name: string;
  intervalMs: number;
  run: () => Promise<void> | void;
}

export class JobScheduler {
  private timers = new Map<string, NodeJS.Timeout>();

  public register(job: Job): void {
    if (this.timers.has(job.name)) {
      this.unregister(job.name);
    }

    const timer = setInterval(async () => {
      try {
        logger.debug(`Running scheduled background job: ${job.name}`);
        await job.run();
      } catch (err) {
        logger.error(`Error executing background job: ${job.name}`, err);
      }
    }, job.intervalMs);

    this.timers.set(job.name, timer);
    logger.info(`Scheduled background job registered: ${job.name} (Interval: ${job.intervalMs}ms)`);
  }

  public unregister(name: string): void {
    const timer = this.timers.get(name);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(name);
      logger.info(`Background job unregistered: ${name}`);
    }
  }

  public shutdown(): void {
    logger.info('Shutting down background scheduler...');
    for (const name of this.timers.keys()) {
      this.unregister(name);
    }
  }
}

export const scheduler = new JobScheduler();
