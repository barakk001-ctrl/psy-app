/**
 * One log line for a failed send, so production failures are easy to diagnose
 * from the Railway logs: the provider's reason (and error code/status when it
 * gives one), plus only the *domains* of the sender and recipient — never the
 * full recipient address, the subject or the body.
 */
export function emailFailureLog(params: {
  reason: string;
  code?: string | null;
  status?: number | null;
  from?: string | null;
  to?: string | null;
}): string {
  const parts = [`[email] send failed: ${params.reason}`];
  if (params.code) parts.push(`code=${params.code}`);
  if (params.status) parts.push(`status=${params.status}`);
  parts.push(`from-domain=${emailDomain(params.from)}`);
  parts.push(`to-domain=${emailDomain(params.to)}`);
  return parts.join(" | ");
}

/** "מרפאה <no-reply@example.com>" or "a@example.com" → "example.com"; "-" if none. */
export function emailDomain(address?: string | null): string {
  if (!address) return "-";
  const match = /@([^\s>]+)/.exec(address);
  return match ? match[1].toLowerCase() : "-";
}
