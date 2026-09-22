\# NoCyberHere — Security-First Full-Stack Development Skill



\## Purpose



You are working on a full-stack application where security must be considered \*\*during design and implementation\*\*, not added afterward.



For every feature you create, modify, or review, actively consider the security controls defined below.



The goal is:



1\. Prevent common web vulnerabilities.

2\. Use established security libraries and patterns instead of implementing security mechanisms from scratch.

3\. Make security decisions visible in the code.

4\. Make every security control traceable through the `NoCyberHere` marker.

5\. Make the application easy to penetration-test later.



\---



\# 1. Core Rule



Whenever implementing functionality that has a security implication, ask:



> "What can an attacker control here, and what security boundary does this cross?"



Before implementing the feature, consider:



\* Authentication

\* Authorization

\* Input validation

\* Output encoding / XSS

\* Injection

\* CSRF

\* CORS

\* Session security

\* Rate limiting

\* Secrets

\* File handling

\* Database access

\* External requests / SSRF

\* Sensitive information exposure

\* Dependency security

\* Error handling

\* Logging

\* Business-logic abuse



Do not assume that because the frontend restricts something, the backend is protected.



\*\*Security enforcement must occur on the server/backend for security-sensitive operations.\*\*



\---



\# 2. NoCyberHere Tracking Requirement



Whenever one of the security mechanisms below is used, add a `NoCyberHere` comment near the implementation.



The comment should identify:



1\. Which security control is being used.

2\. What threat it addresses.

3\. Why it is present.



Use this format:



```ts

// NoCyberHere: \[SECURITY\_CONTROL]

// Threat: \[THREAT]

// Reason: \[WHY\_THIS\_CONTROL\_IS\_REQUIRED]

```



Example:



```ts

// NoCyberHere: INPUT\_VALIDATION

// Threat: Malicious or malformed user input

// Reason: Validate API input before it reaches business logic/database

const user = UserSchema.parse(req.body);

```



Do not add meaningless `NoCyberHere` comments merely to satisfy the requirement.



The marker must correspond to a real security decision or control.



\---



\# 3. Required Security Technologies



Use the following technologies where applicable.



\## Input Validation — Zod



Use Zod for:



\* Request bodies

\* Query parameters

\* URL parameters

\* Forms

\* Environment/configuration validation



Example:



```ts

// NoCyberHere: INPUT\_VALIDATION

// Threat: Malformed or malicious user-controlled input

// Reason: Establish a strict schema before processing request data



const UserSchema = z.object({

&#x20; username: z.string().min(3).max(50),

&#x20; age: z.number().int().min(18).max(120)

});

```



Never assume frontend validation is sufficient.



The backend must validate security-sensitive input independently.



\---



\# 4. Authentication



Use an established authentication framework such as:



\* Better Auth

\* Auth.js

\* An existing trusted authentication provider already used by the project



Do not implement password authentication, session management, or token systems from scratch unless explicitly required.



Whenever authentication is involved:



```ts

// NoCyberHere: AUTHENTICATION

// Threat: Unauthenticated access

// Reason: Verify the identity of the requester before accessing protected functionality

```



Consider:



\* Session expiration

\* Secure cookies

\* HttpOnly

\* Secure

\* SameSite

\* Password hashing

\* Account recovery

\* Authentication failure handling

\* Brute-force protection



\---



\# 5. Password Storage — Argon2



If the application stores passwords directly, use Argon2.



Never store plaintext passwords.



Never use simple SHA-256 as a password hashing mechanism.



Example:



```ts

// NoCyberHere: PASSWORD\_HASHING

// Threat: Password database compromise

// Reason: Store passwords using a password-specific slow hashing algorithm



const hash = await argon2.hash(password);

```



\---



\# 6. Authorization



Authentication and authorization are separate.



Always ask:



> Is this user authenticated?



AND:



> Is this authenticated user authorized to perform THIS exact operation on THIS exact resource?



Use:



\* CASL where appropriate

\* Explicit server-side authorization logic

\* Resource ownership checks



Example:



```ts

// NoCyberHere: AUTHORIZATION

// Threat: IDOR / BOLA

// Reason: User must be authorized to access the specific resource



if (resource.ownerId !== authenticatedUser.id) {

&#x20;   return res.status(403).json({ error: "Forbidden" });

}

```



Never rely solely on:



\* Hidden frontend buttons

\* React state

\* Client-side role checks

\* URL obscurity

\* User-supplied role fields



\---



\# 7. Database Security



Prefer:



\* Prisma

\* Drizzle

\* Parameterized database APIs



Never construct SQL queries by concatenating user-controlled strings.



Example:



```ts

// NoCyberHere: PARAMETERIZED\_DATABASE\_ACCESS

// Threat: SQL injection

// Reason: Database queries must separate data from executable SQL



const user = await prisma.user.findUnique({

&#x20;   where: { id: userId }

});

```



Every database operation should additionally be checked for authorization where appropriate.



Remember:



> Parameterized queries prevent injection; they do NOT automatically provide authorization.



\---



\# 8. HTTP Security — Helmet



For Express-based applications, use Helmet where appropriate.



Example:



```ts

// NoCyberHere: HTTP\_SECURITY\_HEADERS

// Threat: Browser-based attacks and insecure HTTP behavior

// Reason: Configure security-related HTTP response headers



app.use(helmet());

```



Review the generated headers rather than assuming the default configuration is appropriate for every application.



\---



\# 9. CORS



Use explicit CORS configuration.



Do not use unrestricted production CORS for authenticated applications.



Avoid:



```ts

cors({

&#x20;   origin: "\*"

});

```



for sensitive authenticated APIs.



Example:



```ts

// NoCyberHere: CORS

// Threat: Unauthorized cross-origin browser access

// Reason: Restrict browser origins that are allowed to interact with the API



app.use(cors({

&#x20;   origin: \["https://app.example.com"],

&#x20;   credentials: true

}));

```



The exact configuration must match the application's authentication architecture.



\---



\# 10. CSRF



If authentication uses cookies, consider CSRF protection for state-changing requests.



Consider:



\* SameSite cookies

\* CSRF tokens

\* Framework-specific CSRF protection

\* Origin/Referer validation where appropriate



Example:



```ts

// NoCyberHere: CSRF\_PROTECTION

// Threat: Cross-site request forgery

// Reason: Prevent another origin from causing authenticated state-changing requests

```



Do not blindly install a CSRF package without understanding the application's authentication model.



\---



\# 11. Rate Limiting



Use rate limiting for abuse-sensitive endpoints.



Recommended library for Express:



```text

express-rate-limit

```



Apply stricter limits to:



\* Login

\* Password reset

\* MFA

\* Account creation

\* Expensive operations

\* Sensitive API endpoints



Example:



```ts

// NoCyberHere: RATE\_LIMITING

// Threat: Brute force and API abuse

// Reason: Limit repeated authentication attempts



const loginLimiter = rateLimit({

&#x20;   windowMs: 15 \* 60 \* 1000,

&#x20;   limit: 10

});

```



For distributed deployments, use a shared rate-limit store such as Redis when appropriate.



\---



\# 12. XSS



React normally escapes rendered text.



Do not unnecessarily use:



```tsx

dangerouslySetInnerHTML

```



If user-controlled HTML must be rendered, sanitize it using an appropriate HTML sanitizer such as DOMPurify.



Example:



```ts

// NoCyberHere: XSS\_PROTECTION

// Threat: Cross-site scripting through user-controlled HTML

// Reason: Sanitize HTML before rendering it as trusted markup

```



Treat user-controlled HTML as hostile by default.



\---



\# 13. Secrets



Never place secrets directly in source code.



Never commit:



\* API keys

\* Private keys

\* Database passwords

\* JWT secrets

\* OAuth client secrets

\* Cloud credentials



Use environment variables during development and the deployment platform's secret-management mechanism in production.



Example:



```ts

// NoCyberHere: SECRET\_MANAGEMENT

// Threat: Credential exposure through source code

// Reason: Secrets must be provided through the runtime environment

const apiKey = process.env.API\_KEY;

```



If a secret is discovered in source code, flag it immediately.



\---



\# 14. External Requests / SSRF



Whenever the application accepts a URL or makes a server-side request based on user input, explicitly consider SSRF.



Ask:



\* Can the user control the destination?

\* Can localhost be reached?

\* Can private IP ranges be reached?

\* Can cloud metadata endpoints be reached?

\* Are redirects followed?

\* Is DNS rebinding possible?

\* Is an allowlist possible?



Example:



```ts

// NoCyberHere: SSRF\_PROTECTION

// Threat: Server-side request forgery

// Reason: Restrict server-side outbound requests to explicitly permitted destinations

```



Do not make arbitrary server-side requests to user-provided URLs without validation.



\---



\# 15. File Uploads



If file uploads exist, consider:



\* File size limits

\* Allowed MIME types

\* Extension validation

\* Filename sanitization

\* Storage outside executable directories

\* Malware scanning where appropriate

\* Path traversal

\* Archive bombs

\* Image/document parsing vulnerabilities



Example:



```ts

// NoCyberHere: FILE\_UPLOAD\_SECURITY

// Threat: Malicious files and path traversal

// Reason: Restrict uploaded content and prevent attacker-controlled filesystem paths

```



Never use the original filename directly as a filesystem path.



\---



\# 16. Error Handling



Do not expose internal implementation details to users.



Avoid returning:



\* Stack traces

\* Database errors

\* Internal filesystem paths

\* Secrets

\* Authentication details

\* Debug information



Example:



```ts

// NoCyberHere: ERROR\_INFORMATION\_DISCLOSURE

// Threat: Exposure of internal application information

// Reason: Return safe errors to clients while logging diagnostic information internally

```



\---



\# 17. Logging



Security-relevant events should be logged appropriately.



Examples:



\* Authentication failures

\* Authorization failures

\* Account changes

\* Password changes

\* Privilege changes

\* Suspicious request patterns



Never log:



\* Passwords

\* Session tokens

\* API secrets

\* Private keys

\* Sensitive personal information unnecessarily



Example:



```ts

// NoCyberHere: SECURITY\_LOGGING

// Threat: Lack of visibility during security incidents

// Reason: Record security-relevant events without logging credentials or secrets

```



\---



\# 18. Dependency Security



The project must periodically run:



```text

npm audit

```



and preferably:



```text

OSV-Scanner

```



Use Dependabot or Renovate where appropriate.



Do not blindly upgrade dependencies without testing compatibility.



Dependency vulnerabilities are part of the application's attack surface.



\---



\# 19. Static Analysis



Use Semgrep or an equivalent SAST tool.



Recommended focus:



```text

OWASP Top 10

Injection

Authentication

Authorization

XSS

SSRF

Dangerous APIs

Hardcoded secrets

Unsafe cryptography

```



Security findings should be fixed rather than suppressed without justification.



\---



\# 20. Secret Scanning



Use Gitleaks or equivalent.



The repository should be continuously checked for accidentally committed secrets.



Example CI pipeline:



```text

Commit

&#x20; ↓

Gitleaks

&#x20; ↓

Semgrep

&#x20; ↓

Dependency scan

&#x20; ↓

Tests

&#x20; ↓

Build

```



A detected secret should fail the pipeline when appropriate.



\---



\# 21. Container Security



If Docker is used, scan images using Trivy or an equivalent tool.



Check:



\* OS vulnerabilities

\* Package vulnerabilities

\* Application dependencies

\* Misconfiguration

\* Secrets

\* Excessive privileges



Avoid running containers as root unless required.



Example:



```dockerfile

\# NoCyberHere: CONTAINER\_SECURITY

\# Threat: Excessive container privileges

\# Reason: Run the application with a dedicated non-root user

USER app

```



\---



\# 22. Security-by-Design Checklist



Before implementing every new feature, consider:



```text

\[ ] What input can the attacker control?

\[ ] Is the input validated?

\[ ] Is the user authenticated?

\[ ] Is the user authorized for this specific resource?

\[ ] Can this produce XSS?

\[ ] Can this reach a database?

\[ ] Can this reach the filesystem?

\[ ] Can this make an external request?

\[ ] Can this execute commands?

\[ ] Can this expose secrets?

\[ ] Can this be abused repeatedly?

\[ ] Does this require CSRF protection?

\[ ] Does this change security-sensitive state?

\[ ] Does this expose sensitive information?

\[ ] Are errors safe?

\[ ] Should this event be logged?

```



\---



\# 23. NoCyberHere Documentation



Every significant security control must be discoverable by searching the repository for:



```text

NoCyberHere

```



Use specific categories:



```text

NoCyberHere: AUTHENTICATION

NoCyberHere: AUTHORIZATION

NoCyberHere: INPUT\_VALIDATION

NoCyberHere: OUTPUT\_ENCODING

NoCyberHere: XSS\_PROTECTION

NoCyberHere: SQL\_INJECTION

NoCyberHere: CSRF\_PROTECTION

NoCyberHere: CORS

NoCyberHere: RATE\_LIMITING

NoCyberHere: PASSWORD\_HASHING

NoCyberHere: SECRET\_MANAGEMENT

NoCyberHere: SSRF\_PROTECTION

NoCyberHere: FILE\_UPLOAD\_SECURITY

NoCyberHere: ERROR\_INFORMATION\_DISCLOSURE

NoCyberHere: SECURITY\_LOGGING

NoCyberHere: CONTAINER\_SECURITY

NoCyberHere: DEPENDENCY\_SECURITY

```



Do not add a marker when there is no meaningful security control.



\---



\# 24. Security Traceability



For every feature containing security-sensitive functionality, maintain this relationship:



```text

Threat

&#x20;  ↓

Security control

&#x20;  ↓

Implementation

&#x20;  ↓

NoCyberHere marker

&#x20;  ↓

Automated test

&#x20;  ↓

Penetration test

```



Example:



```text

IDOR

&#x20;↓

Server-side resource authorization

&#x20;↓

Authorization middleware

&#x20;↓

NoCyberHere: AUTHORIZATION

&#x20;↓

Unit/integration test

&#x20;↓

Burp/ZAP verification

```



\---



\# 25. Penetration Testing Compatibility



The application must be designed so that its security controls can later be tested with:



\* OWASP ZAP

\* Burp Suite

\* Manual HTTP testing

\* Automated integration tests



Do not implement security through obscurity.



Security controls should produce predictable behavior such as:



```text

401 Unauthorized

403 Forbidden

400 Bad Request

429 Too Many Requests

```



where appropriate.



\---



\# 26. Security Changes



Whenever you modify security-sensitive code:



1\. Identify the relevant threat.

2\. Identify the security control.

3\. Preserve or improve the existing control.

4\. Add/update the `NoCyberHere` marker.

5\. Add/update automated tests.

6\. Check whether the change affects another security boundary.

7\. Mention the security impact in the implementation summary.



Never remove a `NoCyberHere` security marker simply to make the code cleaner unless the underlying security control has genuinely been removed or replaced.



\---



\# 27. Final Rule



Do not treat the presence of a security library as proof that the application is secure.



For example:



```text

Zod

&#x20;   ≠ authorization



Prisma

&#x20;   ≠ authorization



Helmet

&#x20;   ≠ complete web security



Auth.js

&#x20;   ≠ authorization for every resource



Rate limiting

&#x20;   ≠ authentication security



DOMPurify

&#x20;   ≠ complete XSS protection

```



Security requires the correct control at the correct trust boundary.



When uncertain, prefer:



```text

Established library

\+

Server-side enforcement

\+

Automated test

\+

Manual verification

```



over custom security implementations.



\---



\# NoCyberHere Definition



`NoCyberHere` means:



> "This location contains an intentional security control that must remain visible and traceable for security review and penetration testing."



The marker is a \*\*traceability mechanism\*\*, not a security mechanism itself.



