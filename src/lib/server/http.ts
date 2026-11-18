import { NextResponse } from 'next/server';
import { RequestBodyTooLargeError } from './auth';

export const noStore = { 'Cache-Control': 'private, no-store' };
export function apiError(error: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ error }, { status, headers: { ...noStore, ...headers } });
}
export function jsonError(error: unknown) {
  return error instanceof RequestBodyTooLargeError ? apiError('Payload too large', 413) : apiError('Invalid JSON', 400);
}