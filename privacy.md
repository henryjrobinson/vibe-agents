Immediate Privacy Steps:
1. Add robots.txt (most important):
Create /public/robots.txt:
txtUser-agent: *
Disallow: /
2. Add meta tags to your main HTML:
html<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
3. Use Netlify's obscure URL pattern:

Don't use custom domains yet
Keep the random app-name-random123.netlify.app format
Harder to accidentally discover

Additional Privacy Measures:
4. Netlify Environment Variables for sensitive config:

Store API keys in Netlify environment variables
Never commit them to your repo

5. Consider Basic Auth (if needed):
toml# netlify.toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  headers = {X-Robots-Tag = "noindex"}
6. Share links carefully:

Only share the exact URL with nonprofit stakeholders
Use private communication channels
Consider time-limited demo access

When to Go Public:

After nonprofit approval
Remove robots.txt
Add proper domain
Implement user authentication
Add privacy policy for elderly users

Bottom line: With robots.txt blocking crawlers, your demo will stay private for nonprofit evaluation while you build out the full privacy/security features.RetryClaude can make mistakes. Please double-check responses.