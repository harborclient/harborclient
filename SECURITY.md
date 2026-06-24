# Security Policy

## Supported Versions

Security fixes are provided for the latest release only. Older releases are not
supported unless maintainers announce a backport.

| Version        | Supported |
| -------------- | --------- |
| Latest release | Yes       |
| Older releases | No        |

Install the current release from
[GitHub Releases](https://github.com/headzoo/harborclient/releases/latest).

## Reporting a Vulnerability

If you believe you have found a security vulnerability in HarborClient, please
report it privately. **Do not open a public GitHub issue** for exploitable
security bugs.

Email **contact@harborclient.com** with:

- A description of the issue and its potential impact
- Steps to reproduce, including HarborClient version and operating system
- Proof of concept or exploit code, if available
- Your contact information for follow-up

We aim to acknowledge reports within a few business days and will keep you
informed as we investigate. Please allow reasonable time for a fix before public
disclosure. Our target is coordinated disclosure within 90 days, with
flexibility for complex issues.

Community conduct concerns are handled separately under
[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Scope

### In Scope

Reports we want to hear about include, but are not limited to:

- Sandbox escape or main-process remote code execution via scripts, IPC, or the
  renderer
- IPC validation bypass leading to privilege escalation or data exfiltration
- Invite-token cryptography flaws, signature bypass, or credential leakage
- Unsafe handling of secrets such as private keys, auth tokens, or database
  passwords
- Electron or webview misconfiguration that enables renderer-to-Node escalation

### Out of Scope

The following are generally out of scope:

- Vulnerabilities in third-party services or APIs you call with HarborClient
- Social engineering, physical access to a machine, or user-disabled TLS
  certificate verification
- Issues that require importing or running untrusted collection scripts (see
  [Security considerations for users](#security-considerations-for-users) below)
- Dependency CVEs already fixed in a newer HarborClient release (reports are
  still welcome if we have not upgraded yet)
- Code of Conduct or community conduct matters

## Security Considerations for Users

HarborClient runs locally on your machine and can store sensitive request data,
credentials, and storage connection details. Keep these practices in mind:

### Scripts and imports

Pre- and post-request scripts, including scripts imported from Postman
collections, may contain arbitrary JavaScript. Scripts run in a limited
`node:vm` sandbox with no network or filesystem access, but **that sandbox is
not a hard security boundary**. Only import collections and run scripts from
sources you trust.

See [Request scripts — Sandbox limits](https://harborclient.com/request-scripts#sandbox-limits).

### Invite tokens and keys

Collection invite tokens embed storage connection credentials. Treat invite
tokens as secrets and share them only with the intended recipient over a trusted
channel. Keep your private RSA key on your machine and never share it. Verify
public-key fingerprints when exchanging keys with collaborators.

See [Certificates](https://harborclient.com/certificates).

### Updates

Install HarborClient from official
[GitHub Releases](https://github.com/headzoo/harborclient/releases/latest) and
keep your installation up to date.

### Remote storage locations

Storage connection credentials are stored locally and may be included in invite
tokens. Secure the machines and communication channels where credentials and
tokens are shared.

## Recognition

We appreciate responsible disclosure. With your permission, we may credit you in
release notes when a fix ships. HarborClient does not currently offer a paid bug
bounty program.
