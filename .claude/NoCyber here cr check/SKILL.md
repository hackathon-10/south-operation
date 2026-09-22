\# NoCyberHere Security Gate



\## Purpose



This project uses NoCyberHere as its mandatory security validation system.



Whenever you create, modify, refactor, or delete application code, you must consider security implications and maintain the NoCyberHere security controls.



The project contains:



```text

scripts/NoCyberHere-Security.ps1

```



This script is the authoritative local security gate.



\---



\# Mandatory Behavior



After making meaningful code changes, before considering the task complete:



1\. Run the project's normal tests.

2\. Run the NoCyberHere security gate.

3\. Review every finding.

4\. Fix security findings where possible.

5\. Re-run the security gate.

6\. Do not claim the implementation is secure merely because the scan passes.



Run:



```powershell

powershell -ExecutionPolicy Bypass -File .\\scripts\\NoCyberHere-Security.ps1

```



\---



\# Security-First Development



For every feature, consider:



\* Authentication

\* Authorization

\* Input validation

\* XSS

\* Injection

\* CSRF

\* CORS

\* Rate limiting

\* Secrets

\* File uploads

\* SSRF

\* Database security

\* Error disclosure

\* Security logging

\* Dependency vulnerabilities

\* Container security



Use established libraries and secure framework mechanisms whenever appropriate.



\---



\# NoCyberHere Markers



Whenever a security control is implemented or relied upon, document it in the relevant source code.



Use:



```ts

// NoCyberHere: SECURITY\_CONTROL

// Threat: DESCRIPTION

// Reason: WHY\_THIS\_CONTROL\_EXISTS

```



Examples:



```text

NoCyberHere: INPUT\_VALIDATION

NoCyberHere: AUTHENTICATION

NoCyberHere: AUTHORIZATION

NoCyberHere: XSS\_PROTECTION

NoCyberHere: CSRF\_PROTECTION

NoCyberHere: CORS

NoCyberHere: RATE\_LIMITING

NoCyberHere: SECRET\_MANAGEMENT

NoCyberHere: SSRF\_PROTECTION

NoCyberHere: FILE\_UPLOAD\_SECURITY

NoCyberHere: SECURITY\_LOGGING

NoCyberHere: PARAMETERIZED\_DATABASE\_ACCESS

```



Do not add fake or meaningless markers.



A marker must correspond to an actual security control.



\---



\# Security Boundaries



For every user-controlled value ask:



```text

Where did this value originate?

&#x20;       ↓

Can the attacker control it?

&#x20;       ↓

Is it validated?

&#x20;       ↓

Is it sanitized/encoded where necessary?

&#x20;       ↓

Does it cross a trust boundary?

&#x20;       ↓

Does it reach:

&#x20;   - database?

&#x20;   - filesystem?

&#x20;   - command execution?

&#x20;   - HTML?

&#x20;   - external URL?

&#x20;   - privileged operation?

```



\---



\# Authorization



Never assume authentication implies authorization.



For protected resources verify:



```text

Authenticated?

&#x20;     +

Authorized for this resource?

&#x20;     +

Authorized for this operation?

```



Do not rely on frontend checks for security.



\---



\# Security Findings



When the NoCyberHere script reports a failure:



DO NOT simply suppress the scanner.



Instead:



1\. Read the report.

2\. Locate the vulnerable code/dependency.

3\. Determine whether the finding is real.

4\. Fix the underlying issue if real.

5\. Re-run the scanner.

6\. If it is a false positive, document why.

7\. Only suppress a finding when there is a documented technical reason.



\---



\# Dependency Findings



For:



```text

npm audit

OSV-Scanner

```



determine:



\* affected package

\* affected version

\* whether the vulnerable code path is reachable

\* available patched version

\* compatibility impact of upgrading



Prefer upgrading to a fixed version.



Do not blindly suppress vulnerabilities.



\---



\# Secret Findings



If Gitleaks finds a real secret:



1\. Treat it as compromised.

2\. Do not simply delete it from the latest file.

3\. Determine where the secret was exposed.

4\. Rotate/revoke the secret.

5\. Remove it from the repository where appropriate.

6\. Move it to proper secret management.

7\. Re-run Gitleaks.



Never paste the secret into chat or source comments.



\---



\# Semgrep Findings



For Semgrep findings:



1\. Inspect the source location.

2\. Determine whether the vulnerable data flow is real.

3\. Fix the underlying issue.

4\. Add a security test where appropriate.

5\. Re-run Semgrep.



\---



\# ZAP Findings



ZAP is the dynamic application security layer.



Before running ZAP:



\* Make sure the target is an authorized development/test environment.

\* Prefer localhost or an isolated test deployment.

\* Never automatically attack an unrelated third-party system.



For commit-time checks use the baseline scan.



For deeper testing use a dedicated PT command.



\---



\# Manual Penetration Testing



NoCyberHere does not replace manual testing.



Important areas to test manually with Burp Suite or equivalent:



\* IDOR/BOLA

\* Authentication bypass

\* Authorization bypass

\* Role manipulation

\* Session manipulation

\* Business logic abuse

\* API parameter manipulation

\* CSRF

\* SSRF

\* File upload

\* Rate-limit bypass



\---



\# Completion Requirement



When reporting that a feature is complete, include:



```text

Security:

\- NoCyberHere: PASS/FAIL

\- Security controls added:

\- NoCyberHere markers added:

\- Security tests added:

\- Remaining warnings:

```



Never report:



> "The application is secure."



Instead report exactly what was tested and what was found.



\---



\# Important Principle



NoCyberHere is a defense and verification system.



It does NOT mean:



```text

library installed = secure

```



It means:



```text

Threat

&#x20; ↓

Security control

&#x20; ↓

Implementation

&#x20; ↓

NoCyberHere marker

&#x20; ↓

Automated test

&#x20; ↓

Security scanner

&#x20; ↓

Manual penetration test

```



The objective is to make security controls:



\* explicit

\* testable

\* traceable

\* repeatable

\* reviewable



