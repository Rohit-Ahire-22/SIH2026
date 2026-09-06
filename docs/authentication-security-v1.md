# Authentication & Security (v1)

This document outlines the authentication and application security model implemented for SIH26034.

## Authentication Architecture

The system utilizes stateless JWT (JSON Web Tokens) for authentication:
- **Tokens**: Issued upon successful login via `POST /api/auth/login`.
- **Storage**: The frontend `AuthContext` persists the token via `localStorage` (Bearer token strategy). This allows simple cross-domain usage during the SIH presentation.
- **Expiry**: Tokens expire after 12 hours, enforcing regular re-authentication.
- **Logout**: Handled client-side by destroying the token and Context state. (A backend endpoint `POST /api/auth/logout` exists for future token-revocation list implementation).

## Password Security
- User passwords are mathematically hashed using **bcryptjs** with a salt round factor of 10.
- Passwords are never returned in JSON payloads, logged to standard output, or stored in plaintext.

## Role-Based Access Control
The `User` model supports two roles: `INSPECTOR` and `ADMIN`.
- **Public Registration**: `POST /api/auth/register` strictly forces the role to `INSPECTOR`, thwarting privilege escalation attacks.
- **Admin Provisioning**: Creating an `ADMIN` must be done explicitly via the backend CLI script `server/scripts/createAdmin.js` using strictly guarded environment variables (`ADMIN_EMAIL` and `ADMIN_PASSWORD`).
- **Authorization**: The `authorizeRole()` middleware checks role hierarchies to secure future administrative endpoints.

## API Protection
- All application logic (Inspections, OCR Triggers, Reports, Analytics) mapping to `/api/products` is heavily protected by the `authenticate` middleware. Requests lacking valid Bearer tokens are dropped with `401 Unauthorized`.

## Network Security
- **CORS**: Enforces origin matching against `process.env.CLIENT_ORIGIN` (falling back safely to localhost:5173 for development). Broad `*` wildcards are forbidden for production environments.
- **Rate Limiting**: `express-rate-limit` secures the authentication endpoints against brute-force volumetric credential stuffing attacks.
- **Headers**: `helmet()` explicitly normalizes security headers across Express (X-Powered-By hiding, XSS protection).
