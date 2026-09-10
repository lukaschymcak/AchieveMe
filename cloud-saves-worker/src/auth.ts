import { ContractError } from './contract.ts'

/**
 * Extracts and validates Bearer token against the Worker secret.
 *
 * @param request - Incoming request
 * @param expectedToken - API_TOKEN secret
 */
export function assertBearerAuth(request: Request, expectedToken: string): void {
  const expected = String(expectedToken || '').trim()
  if (!expected) {
    throw new ContractError(500, 'API token is not configured')
  }

  const header = request.headers.get('Authorization') || ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  if (!match) {
    throw new ContractError(401, 'Unauthorized')
  }

  const provided = match[1].trim()
  if (!provided || provided !== expected) {
    throw new ContractError(401, 'Unauthorized')
  }
}
