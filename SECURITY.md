# Security policy

## Supported versions

QRViet is a static web app released continuously from the `main` branch. Only the latest version receives fixes; installed apps get it through the in-app update prompt.

## Reporting a vulnerability

Please do not report security problems in public issues, discussions or pull requests. Report them privately instead:

- with GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/report-privately) (**Report a vulnerability** on the repository's **Security** tab), or
- by email to <me@nghiep.dev>.

Please include:

- a description of the problem and its impact;
- steps or a proof of concept to reproduce it;
- the affected URL or commit, browser and operating system.

Use made-up account details in your report, never real ones.

QRViet is maintained by volunteers. We aim to acknowledge reports within 7 days and to keep you updated until the problem is resolved. Once a fix is released, we will credit you in the advisory unless you prefer to stay anonymous.

## Scope

QRViet runs entirely in the browser, so these are the most relevant problems:

- QR codes or payment links that show one recipient or amount but send a banking app another;
- script injection (XSS) through payment links, scanned or pasted content, imported files or imported themes;
- leaks of locally stored data, such as the account book or history, to other sites or over the network;
- service worker or cache behaviour that can serve tampered or outdated code.

Out of scope: problems in banking apps or in third-party hosting, social engineering, and reports from automated scanners that do not show a real impact.
