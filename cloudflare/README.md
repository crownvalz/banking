# GitHub CSV Library for crownvalz/banking

This integration adds a CSV library to links.html. Uploaded files are stored as bank_links/link1.csv, bank_links/link2.csv, etc. The root links.csv file is the index.

## Important privacy warning

The GitHub repository is public. Every uploaded CSV file is publicly readable from GitHub, even though the Worker only lists and downloads files associated with the signed-in user. Do not upload bank-confidential URLs, credentials, customer information, account data, or other restricted information. Use institution-approved private storage for confidential resources.

## 1. Deploy the Worker

1. Create a Cloudflare Worker named bank-links-api.
2. Paste cloudflare/worker.js into the Worker editor and deploy.
3. Add these Worker environment variables:
   - GITHUB_REPOSITORY = crownvalz/banking
   - GITHUB_TOKEN = fine-grained GitHub token with Contents: Read and write access to this repository only.
   - ALLOWED_ORIGIN = https://crownvalz.github.io (change this if GitHub Pages uses a custom domain).
   - ACCESS_TEAM_DOMAIN = your Cloudflare Access team domain, without https://.
   - ACCESS_AUD = the Application Audience (AUD) tag from your Cloudflare Access application.
4. Keep GITHUB_TOKEN as a Worker secret. Never place it in HTML, JavaScript, or GitHub Pages.

## 2. Require sign-in with Cloudflare Access

Create a Cloudflare Access self-hosted application for the Worker hostname. Configure a policy that permits only approved users and provides an email claim. Protect the Worker hostname with Access so browser requests carry Cf-Access-Jwt-Assertion. The Worker validates the JWT signature, issuer, audience, and expiry and derives a per-user owner key from the verified email claim.

## 3. Connect the portal

After deploying the Worker, open links.html and replace the placeholder value for CSV_API_BASE with your deployed Worker URL, for example https://bank-links-api.your-subdomain.workers.dev. Commit the change. The CSV Library button will then let an authenticated user upload, list, load, and download their own CSV files.

## 4. CSV format

Required headers: title,url
Optional headers: category,icon,keywords

Example:

~~~csv
title,url,category,icon,keywords
Operations Portal,https://example.com,Operations,fa-building,operations
Finance Report,https://example.org/report,Finance,fa-chart-line,finance report
~~~

Only HTTP and HTTPS links are accepted. Maximum file size: 1 MB.

## API

- GET /api/files — list the signed-in user's files.
- POST /api/upload — upload CSV content with original_name and content.
- GET /api/download?file=link1.csv — retrieve a file owned by the signed-in user.

The Worker writes each new file and updates the root index using the GitHub Contents API on branch main.