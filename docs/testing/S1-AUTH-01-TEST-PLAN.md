# S1-AUTH-01 - Authentication verification cases

**Owner:** Bryan
**Status:** Execute in the browser and register evidence; do not mark passed without verification.

Requirements: run `npm run typecheck` and `npm run dev:frontend` from the repository root.
Open `http://localhost:5173`, open the browser console, and use only test credentials.

```js
const { localAuthService: auth } = await import('/src/services/auth-service.ts');
const email = `bryan-test-${Date.now()}@example.com`;
const password = 'Prueba123!';
const session = await auth.register(email, password, 'reader');
console.assert(session.user.role === 'reader', 'Registration: incorrect role');
console.assert(await auth.hasRole('reader'), 'Role: reader should be allowed');
console.assert(!(await auth.hasRole('moderator')), 'Role: moderator should not be allowed');
await auth.logout();
console.assert(await auth.getCurrentSession() === null, 'Logout: session remained');
await auth.login(email, password);
console.assert((await auth.getCurrentSession())?.user.email === email, 'Login: incorrect email');
// Reload the page and verify getCurrentSession() still returns the user.
```

## Manual cases

| ID | Action | Expected result | Evidence | Status |
|---|---|---|---|---|
| AUTH-01 | Register a reader with a unique email and valid password | Account created with a four-digit display-name suffix | Screenshot/console | Pending |
| AUTH-02 | Register a publisher | Account receives the `publisher` role | Screenshot/console | Pending |
| AUTH-03 | Register the same email twice | `EMAIL_ALREADY_EXISTS`; no duplicate | Screenshot/console | Pending |
| AUTH-04 | Invalid email or weak password | Field-specific `VALIDATION_ERROR` | Screenshot/console | Pending |
| AUTH-05 | Incorrect password | `INVALID_CREDENTIALS`; no field disclosure | Screenshot/console | Pending |
| AUTH-06 | Logout and reload | Session absent | Screenshot/console | Pending |
| AUTH-07 | Publicly request `moderator` registration | Rejected | Screenshot/console | Pending |
| AUTH-08 | Check a role the session does not have | `false` | Screenshot/console | Pending |
| AUTH-09 | Express guard with no bearer token or invalid token | HTTP 401; body role is never trusted | Backend test | Pending |
| AUTH-10 | Express guard with valid identity and wrong role | HTTP 403 | Backend test | Pending |
| AUTH-11 | IndexedDB unavailable or corrupted | Recoverable error; no access granted | Browser test | Pending |
| AUTH-12 | Firebase authentication integration | Adapter, tokens, and deployed verification | Integration: Carlos/Juan/Dante | Blocked |
| AUTH-13 | Seeded test moderator | Role/guard verification | Integration: Jorge | Blocked |

Criteria: `US-REA-010` CA-001–004 and CA-006–007, and `SPEC-001` sections 3, 5, 6, and 11.
