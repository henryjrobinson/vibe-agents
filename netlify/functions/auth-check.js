exports.handler = async (event, context) => {
    // Check if user is authenticated via Netlify Identity
    const { user } = context.clientContext || {};
    
    if (!user) {
        return {
            statusCode: 401,
            headers: {
                'Content-Type': 'text/html',
            },
            body: `
<!DOCTYPE html>
<html>
<head>
    <title>Story Collection - Access Required</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .auth-container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
            width: 90%;
        }
        .logo {
            font-size: 24px;
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
        }
        .auth-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .auth-btn:hover {
            background: #5a6fd8;
            transform: translateY(-1px);
        }
        .notice {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            margin-top: 20px;
            font-size: 14px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="auth-container">
        <div class="logo">Story Collection</div>
        <div class="subtitle">AI-Powered Memory Preservation</div>
        
        <p>This application is currently in private testing.</p>
        
        <button class="auth-btn" onclick="netlifyIdentity.open()">
            Request Access
        </button>
        
        <div class="notice">
            <strong>For Testers:</strong> If you have been invited to test this application, 
            click "Request Access" to sign in with your authorized email address.
        </div>
    </div>

    <script>
        // Initialize Netlify Identity
        netlifyIdentity.init();
        
        // Redirect to main app after login
        netlifyIdentity.on('login', user => {
            window.location.href = '/';
        });
        
        // Auto-open login if user clicks login
        netlifyIdentity.on('init', user => {
            if (user) {
                window.location.href = '/';
            }
        });
    </script>
</body>
</html>
            `
        };
    }
    
    // User is authenticated, allow access
    return {
        statusCode: 200,
        body: JSON.stringify({ 
            message: 'Authenticated',
            user: user.email 
        })
    };
};
