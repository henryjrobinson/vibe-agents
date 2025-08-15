Immediate Privacy Steps:
1. Add robots.txt (most important):
Create /public/robots.txt:
txtUser-agent: *
Disallow: /
2. Add meta tags to your main HTML:
html<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
3. Use a non-guessable Render subdomain:

- Avoid custom domains until you're ready
- Keep the default random <service>.onrender.com URL
- Combined with robots/meta noindex, this reduces accidental discovery

Additional Privacy Measures:
4. Render Environment Variables for sensitive config:

- Store API keys in the Render dashboard as environment variables
- Never commit secrets to your repo

5. Require authentication for access:

- Firebase Auth is implemented; keep all endpoints protected (already in `server.js`)
- Optionally add temporary Basic Auth via Express middleware for demos only
6. Share links carefully:

Only share the exact URL with nonprofit stakeholders
Use private communication channels
Consider time-limited demo access

When to Go Public:

After nonprofit approval
Remove robots.txt
Update Render subdomain to a custom domain
Implement user authentication with Firebase Auth
Add privacy policy for elderly users

Bottom line: With robots.txt blocking crawlers, your demo will stay private for nonprofit evaluation while you build out the full privacy/security features.