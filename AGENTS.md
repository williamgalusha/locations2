# BILL, INC. production deployment

- Source of truth: GitHub repository `williamgalusha/locations2`, branch `main`.
- Production hosting: Cloudflare Worker `locations2`.
- Production domain: `https://bill-inc.co/`.
- For production changes, validate the build and tests, publish the exact validated source to GitHub `main` through the connected GitHub integration, wait for Cloudflare's commit deployment to succeed, and verify `bill-inc.co`.
- Do not treat the OpenAI Sites URL (`harbor-production-control.wbg123.chatgpt.site`) as the production target for BILL, INC. changes.
- Preserve the production D1 binding `locations2-db` and R2 binding `locations2-files`.
