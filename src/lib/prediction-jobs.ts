import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { PREDICTION_CONFIG } from './config';
import { executePrediction, type PredictionResults } from './prediction-runner';

export type PredictionJobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type PredictionJobRecord = {
  jobId: string;
  status: PredictionJobStatus;
  level: string;
  model: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  workerId: string;
  tokenHash: string;
  ownerHash: string;
  clusterJobId?: string;
  executionMode?: 'slurm' | 'local';
  remoteError?: string;
  results?: PredictionResults;
  error?: string;
};

const workerId = crypto.randomUUID();
const activeJobs = new Map<string, string>();
let reservedJobs = 0;
const reservedByOwner = new Map<string, number>();
const validJobId = /^[a-z0-9_-]+$/i;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
const jobDirectory = (jobId: string) => path.join(PREDICTION_CONFIG.jobDir, jobId);
const recordPath = (jobId: string) => path.join(jobDirectory(jobId), 'job.json');
const inputPath = (jobId: string) => path.join(jobDirectory(jobId), 'input.fasta');

async function writeRecord(record: PredictionJobRecord) {
  const target = recordPath(record.jobId);
  const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(record), { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporary, target);
}

async function updateRecord(jobId: string, patch: Partial<PredictionJobRecord>) {
  const current = JSON.parse(await fs.readFile(recordPath(jobId), 'utf8')) as PredictionJobRecord;
  const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await writeRecord(updated);
  return updated;
}

async function cleanupExpiredJobs() {
  await fs.mkdir(PREDICTION_CONFIG.jobDir, { recursive: true });
  const entries = await fs.readdir(PREDICTION_CONFIG.jobDir, { withFileTypes: true });
  const cutoff = Date.now() - PREDICTION_CONFIG.jobRetentionMs;
  await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    if (activeJobs.has(entry.name)) return;
    const stats = await fs.stat(jobDirectory(entry.name));
    if (stats.mtimeMs < cutoff) await fs.rm(jobDirectory(entry.name), { recursive: true, force: true });
  }));
}

async function runJob(jobId: string, ownerHash: string) {
  activeJobs.set(jobId, ownerHash);
  try {
    await updateRecord(jobId, { status: 'running', message: 'Submitted to the prediction executor.' });
    const record = await readPredictionJob(jobId, false);
    const sequence = await fs.readFile(inputPath(jobId), 'utf8');
    const run = await executePrediction({ jobId, sequence, level: record.level, model: record.model });
    await updateRecord(jobId, {
      status: 'completed',
      message: 'Prediction completed successfully.',
      clusterJobId: run.clusterJobId,
      executionMode: run.executionMode,
      remoteError: run.remoteError,
      results: run.results,
    });
  } catch (error: unknown) {
    await updateRecord(jobId, { status: 'failed', message: 'Prediction failed.', error: errorMessage(error) }).catch(() => {});
  } finally {
    activeJobs.delete(jobId);
    await fs.rm(inputPath(jobId), { force: true }).catch(() => {});
  }
}

export class JobCapacityError extends Error {
  readonly status = 429;
  constructor(message: string) {
    super(message);
    this.name = 'JobCapacityError';
  }
}

function reserveCapacity(ownerHash: string) {
  const ownerActive = [...activeJobs.values()].filter((value) => value === ownerHash).length + (reservedByOwner.get(ownerHash) || 0);
  if (activeJobs.size + reservedJobs >= PREDICTION_CONFIG.maxActiveJobs) {
    throw new JobCapacityError('The prediction service is at capacity. Please try again after an active job finishes.');
  }
  if (ownerActive >= PREDICTION_CONFIG.maxActiveJobsPerClient) {
    throw new JobCapacityError('You already have the maximum number of active prediction jobs.');
  }
  reservedJobs += 1;
  reservedByOwner.set(ownerHash, (reservedByOwner.get(ownerHash) || 0) + 1);
}

function releaseCapacity(ownerHash: string) {
  reservedJobs = Math.max(0, reservedJobs - 1);
  const remaining = (reservedByOwner.get(ownerHash) || 1) - 1;
  if (remaining > 0) reservedByOwner.set(ownerHash, remaining);
  else reservedByOwner.delete(ownerHash);
}

export function hashJobToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyJobToken(record: PredictionJobRecord, token: string) {
  if (!token || !record.tokenHash) return false;
  const actual = Buffer.from(hashJobToken(token));
  const expected = Buffer.from(record.tokenHash);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export async function createPredictionJob(input: { jobId: string; sequence: string; level: string; model: string; tokenHash: string; ownerHash: string }) {
  if (!validJobId.test(input.jobId)) throw new Error('Invalid job identifier.');
  reserveCapacity(input.ownerHash);
  try {
    await cleanupExpiredJobs();
    await fs.mkdir(jobDirectory(input.jobId), { recursive: false, mode: 0o700 });
    await fs.writeFile(inputPath(input.jobId), input.sequence, { encoding: 'utf8', mode: 0o600 });
    const now = new Date().toISOString();
    const record: PredictionJobRecord = {
      jobId: input.jobId,
      status: 'queued',
      level: input.level,
      model: input.model,
      message: 'Job accepted and waiting for submission.',
      createdAt: now,
      updatedAt: now,
      workerId,
      tokenHash: input.tokenHash,
      ownerHash: input.ownerHash,
    };
    await writeRecord(record);
    void runJob(input.jobId, input.ownerHash);
    return record;
  } finally {
    releaseCapacity(input.ownerHash);
  }
}

export async function readPredictionJob(jobId: string, detectInterrupted = true): Promise<PredictionJobRecord> {
  if (!validJobId.test(jobId)) throw new Error('Invalid job identifier.');
  const record = JSON.parse(await fs.readFile(recordPath(jobId), 'utf8')) as PredictionJobRecord;
  if (detectInterrupted && (record.status === 'queued' || record.status === 'running') && record.workerId !== workerId && !activeJobs.has(jobId)) {
    return updateRecord(jobId, {
      status: 'failed',
      message: 'The prediction worker restarted before the job completed.',
      error: 'Job state became uncertain after a server restart. The cluster job was not duplicated automatically.',
    });
  }
  return record;
}
