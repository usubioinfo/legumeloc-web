import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, clientIp, enforceRateLimit, readJsonBody, securityErrorResponse, validateProteinFasta } from '@/lib/request-security';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    enforceRateLimit('fasta-check', clientIp(req), 30, 60 * 1000);
    const body = await readJsonBody<{ sequence?: unknown }>(req);
    const sequence = typeof body.sequence === 'string' ? body.sequence : '';
    const validation = validateProteinFasta(sequence);
    return validation.valid
      ? NextResponse.json({ valid: true, count: validation.sequenceCount })
      : NextResponse.json({ valid: false, error: validation.error }, { status: 400 });
  } catch (error: unknown) {
    const securityResponse = securityErrorResponse(error);
    return securityResponse || NextResponse.json({ valid: false, error: 'Validation failed.' }, { status: 500 });
  }
}
