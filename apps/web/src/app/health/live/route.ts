/** Rotta di stato per il health check del Compose (ADR-009 §4.6): risponde finché il processo risponde, senza interrogare l'API. */
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
