# Firebase Authentication Setup Guide

This guide walks you through setting up Firebase Authentication for the Story Collection app.

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter project name (e.g., "story-collection-app")
4. Choose whether to enable Google Analytics (optional)
5. Click "Create project"

## 2. Enable Authentication

1. In your Firebase project console, click "Authentication" in the left sidebar
2. Click "Get started"
3. Go to the "Sign-in method" tab
4. Enable "Email/Password" provider:
   - Click on "Email/Password"
   - Toggle "Enable" to ON
   - Toggle "Email link (passwordless sign-in)" to OFF (optional)
   - Click "Save"

## 3. Get Firebase Configuration

1. Click the gear icon (⚙️) next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon (`</>`) to add a web app
5. Enter app nickname (e.g., "story-collection-web")
6. Don't check "Firebase Hosting" (we're using Render)
7. Click "Register app"
8. Copy the Firebase configuration object

## 4. Configure Environment Variables

Create a `.env` file in your project root with the Firebase configuration:

```bash
# Copy from .env.example and fill in your values
cp .env.example .env
```

Update the Firebase section in `.env`:

```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=your_project_id_here
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=your_app_id_here
```

## 5. Set Up Firebase Admin SDK (Server-side)

For server-side token verification, you need a service account:

1. In Firebase Console, go to Project Settings
2. Click "Service accounts" tab
3. Click "Generate new private key"
4. Download the JSON file
5. Add the entire JSON content to your `.env` file:

```bash
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key_id":"..."}
```

**Security Note**: Never commit the service account key to version control. Keep it in `.env` only.

## 6. Configure Render Deployment

If deploying to Render, add these environment variables in your Render dashboard:

1. Go to your Render service dashboard
2. Click "Environment" tab
3. Add each Firebase environment variable:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
   - `FIREBASE_SERVICE_ACCOUNT_KEY`

## 7. Test the Integration

1. Start your development server:
   ```bash
   npm start
   ```

2. Navigate to `http://localhost:3000`
3. You should see the splash page
4. Click "Get Started" - this should redirect to the chat interface
5. You should see "Sign In Required" message
6. Click "Sign In" to open the authentication modal
7. Try creating an account with email/password
8. Check your email for verification (if enabled)
9. Sign in and verify the chat interface becomes available

## 8. Verify User Data Isolation

1. Create two different user accounts
2. Sign in with first account and create some conversation data
3. Sign out and sign in with second account
4. Verify that the second account doesn't see the first account's data

## Authentication Flow

The implemented authentication system provides:

- **Frontend**: Firebase Auth SDK handles user registration, login, and token management
- **Backend**: Firebase Admin SDK validates tokens and scopes data to authenticated users
- **Security**: All API endpoints require valid Firebase tokens
- **User Isolation**: All conversations and memories are scoped to the authenticated user's ID
- **Session Management**: Tokens are automatically refreshed by Firebase SDK

## Troubleshooting

### Common Issues

1. **"Firebase Admin not initialized"**
   - Check that `FIREBASE_SERVICE_ACCOUNT_KEY` is properly set
   - Verify the JSON format is valid

2. **"Authentication required" errors**
   - Ensure user is signed in before making API calls
   - Check browser network tab for 401 responses
   - Verify Firebase config is correct

3. **CORS errors**
   - Add your domain to Firebase authorized domains
   - Check CORS configuration in server.js

4. **Email verification not working**
   - Check Firebase console for email template configuration
   - Verify SMTP settings if using custom email provider

### Development vs Production

- **Development**: Can run without service account key (uses default credentials)
- **Production**: Requires proper service account key for token verification

## Security Best Practices

1. **Never expose service account keys** in client-side code
2. **Use environment variables** for all sensitive configuration
3. **Enable email verification** for production deployments
4. **Set up proper Firebase security rules** if using Firestore
5. **Monitor authentication logs** in Firebase console
6. **Use HTTPS** in production (handled by Render automatically)

## Next Steps

After Firebase is configured:

1. **Test thoroughly** with multiple user accounts
2. **Set up monitoring** for authentication errors
3. **Configure email templates** in Firebase console
4. **Add password reset functionality** (already implemented)
5. **Consider adding social login providers** (Google, Facebook, etc.)

The authentication system is now fully integrated and ready for production use!
