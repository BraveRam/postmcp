export function getScopedEnvKey(specTitle?: string, serverUrl?: string): string {
  const text = `${specTitle || ''} ${serverUrl || ''}`.toLowerCase();

  if (text.includes('firecrawl')) return 'FIRECRAWL_API_KEY';
  if (text.includes('stripe')) return 'STRIPE_SECRET_KEY';
  if (text.includes('github')) return 'GITHUB_TOKEN';
  if (text.includes('openai')) return 'OPENAI_API_KEY';
  if (text.includes('neon')) return 'NEON_API_KEY';
  if (text.includes('supabase')) return 'SUPABASE_KEY';
  if (text.includes('twilio')) return 'TWILIO_AUTH_TOKEN';
  if (text.includes('slack')) return 'SLACK_BOT_TOKEN';
  if (text.includes('resend')) return 'RESEND_API_KEY';
  if (text.includes('anthropic')) return 'ANTHROPIC_API_KEY';

  if (specTitle) {
    const sanitized = specTitle
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/\b(api|rest|service|v\d+|openapi|spec)\b/gi, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toUpperCase();
    if (sanitized.length >= 2) {
      return `${sanitized}_API_KEY`;
    }
  }

  if (serverUrl) {
    try {
      const host = new URL(serverUrl).hostname;
      const parts = host.replace(/\.(com|dev|io|org|net|co|app|ai)$/, '').split('.');
      const name = parts[parts.length - 1].toUpperCase().replace(/[^A-Z0-9]/g, '_');
      if (name.length >= 2) {
        return `${name}_API_KEY`;
      }
    } catch {}
  }

  return 'BEARER_TOKEN';
}
