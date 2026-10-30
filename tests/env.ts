export const BASE_URL = (process.env.BASE_URL || 'https://cymulate.com').replace(/\/+$/, '');

// Local by Flywheel copy: self-signed cert and a stale WP Rocket cache
export const IS_LOCAL = new URL(BASE_URL).hostname.endsWith('.local');

export const UA_MARKER = 'CymulateE2E/1.0';
