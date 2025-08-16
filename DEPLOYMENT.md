# Deployment Guide

This project is deployed on **Render** (not Netlify).

## Production Deployment

The application is automatically deployed to Render via the `render.yaml` configuration file.

**Production URL:** https://vibe-agents.onrender.com

## Deployment Configuration

- **Platform:** Render
- **Service Type:** Web Service
- **Runtime:** Node.js
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Auto Deploy:** Enabled (deploys on git push to main branch)

## Environment Variables

Set these in the Render Dashboard:
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `SESSION_SECRET` - Session encryption key
- `CORS_ORIGIN` - Optional CORS origins (if needed)

Other environment variables are configured in `render.yaml`.

## Manual Deployment

To trigger a manual deployment:
1. Push changes to the main branch
2. Or use the "Manual Deploy" button in the Render Dashboard

## Local Development

```bash
npm install
npm start
```

The app will be available at http://localhost:3000

## Notes

- This project was previously on Netlify but has been migrated to Render
- All Netlify references have been removed from the codebase
- The `render.yaml` file contains the complete deployment configuration
