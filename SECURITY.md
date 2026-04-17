# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 1.0.x | ✅ Yes |

## Reporting a Vulnerability

If you discover a security vulnerability in ClodCount, **please do not open a public issue.**

Instead, report it privately by opening a [GitHub Security Advisory](https://github.com/yourusername/ClodCount/security/advisories/new).

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You'll receive a response within **72 hours**. If confirmed, a patch will be released as soon as possible.

## Security Model

ClodCount operates entirely client-side:
- No data is sent to external servers
- No user content is logged or stored beyond the browser's own `chrome.storage.sync`
- The only network requests made are to `chrome.runtime` (internal extension APIs)
- The extension only runs on `https://claude.ai/*` (declared in `manifest.json`)
