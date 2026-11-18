import { NextResponse } from 'next/server';
import { RequestBodyTooLargeError } from './auth';
import { ForbiddenError, VersionConflictError } from './db';
import { DuplicateRecordError, MissingRecordError } from './record-service';
import { ValidationError } from './validation';

export const recordHeaders = { 'Cache-Control': 'private, no-store' };

export function recordError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: recordHeaders });
}

export function recordFailure(error: unknown) {
  if (error instanceof ValidationError) return recordError(error.reason, 422);
  if (error instanceof VersionConflictError) return recordError('Concurrent update. Reload and retry.', 409);
  if (error instanceof ForbiddenError) return recordError('Forbidden', 403);
  if (error instanceof MissingRecordError) return recordError('Not found', 404);
  if (error instanceof DuplicateRecordError) return recordError('Already exists', 409);
  return recordError('Operation failed', 500);
}

export function invalidRecordBody(error: unknown) {
  return error instanceof RequestBodyTooLargeError ? recordError('Payload too large', 413) : recordError('Invalid JSON', 400);
}