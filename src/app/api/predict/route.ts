import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createPredictionJob, hashJobToken, JobCapacityError, readPredictionJob, verifyJobToken, type PredictionJobRecord } from '@/lib/prediction-jobs';
import { assertSameOrigin, bearerToken, clientIp, enforceRateLimit, ownerHash, readJsonBody, securityErrorResponse, validateProteinFasta, verifyTurnstile } from '@/lib/request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const validLevels = new Set(['level1', 'level2', 'level3']);
const validModels = new Set(['fast', 'sensitive']);
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Prediction execution failed.';
const isMissingFile = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

const publicJob = (job: PredictionJobRecord) => ({
  success: job.status !== 'failed',
  jobId: job.jobId,
  status: job.status,
  level: job.level,
  model: job.model,
  message: job.message,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
  results: job.results,
  error: job.error,
});

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ip = clientIp(req);
    enforceRateLimit('predict-submit', ip, 3, 10 * 60 * 1000);
    const body = await readJsonBody<{ sequence?: unknown; level?: unknown; model?: unknown; turnstileToken?: unknown }>(req);
    const sequence = typeof body.sequence === 'string' ? body.sequence.trim() : '';
    const level = typeof body.level === 'string' ? body.level : 'level1';
    const model = typeof body.model === 'string' ? body.model : 'fast';
    const validation = validateProteinFasta(sequence);
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 });
    if (!validLevels.has(level)) return NextResponse.json({ error: 'Invalid prediction level.' }, { status: 400 });
    if (!validModels.has(model)) return NextResponse.json({ error: 'Invalid model strategy.' }, { status: 400 });
    await verifyTurnstile(body.turnstileToken, ip);

    const jobId = `legumeloc_${crypto.randomUUID().replaceAll('-', '')}`;
    const jobToken = crypto.randomBytes(32).toString('base64url');
    const job = await createPredictionJob({ jobId, sequence, level, model, tokenHash: hashJobToken(jobToken), ownerHash: ownerHash(ip) });
    return NextResponse.json({ ...publicJob(job), jobToken }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    const securityResponse = securityErrorResponse(error);
    if (securityResponse) return securityResponse;
    if (error instanceof JobCapacityError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } });
    console.error('Unable to create LegumeLoc job:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId') || '';
  try {
    enforceRateLimit('predict-status', clientIp(req), 120, 60 * 1000);
    const job = await readPredictionJob(jobId);
    if (!verifyJobToken(job, bearerToken(req))) return NextResponse.json({ error: 'Prediction job was not found.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json(publicJob(job), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    const securityResponse = securityErrorResponse(error);
    if (securityResponse) return securityResponse;
    return NextResponse.json({ error: isMissingFile(error) ? 'Prediction job was not found.' : errorMessage(error) }, { status: isMissingFile(error) ? 404 : 400 });
  }
}
