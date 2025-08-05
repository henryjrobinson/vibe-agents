const nodemailer = require('nodemailer');
require('dotenv').config();

// Email service configuration
class EmailService {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
    }

    initializeTransporter() {
        if (process.env.EMAIL_SERVICE === 'sendgrid' && process.env.SENDGRID_API_KEY) {
            // SendGrid configuration
            this.transporter = nodemailer.createTransporter({
                service: 'SendGrid',
                auth: {
                    user: 'apikey',
                    pass: process.env.SENDGRID_API_KEY
                }
            });
        } else if (process.env.NODE_ENV === 'development') {
            // Development mode - use console logging instead of real email
            console.log('📧 Email service in development mode - emails will be logged to console');
            this.transporter = {
                sendMail: async (mailOptions) => {
                    console.log('📧 DEVELOPMENT EMAIL:', {
                        to: mailOptions.to,
                        subject: mailOptions.subject,
                        text: mailOptions.text,
                        html: mailOptions.html
                    });
                    return { messageId: 'dev-' + Date.now() };
                }
            };
        } else {
            console.warn('⚠️ No email service configured. Magic links will not be sent.');
            this.transporter = null;
        }
    }

    async sendMagicLink(email, token, userName = null) {
        if (!this.transporter) {
            throw new Error('Email service not configured');
        }

        const magicLinkUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/verify?token=${token}`;
        const displayName = userName || email.split('@')[0];

        const subject = 'Your Vibe-Agents Login Link';
        
        const textContent = `
Hello ${displayName},

Welcome to Vibe-Agents! Click the link below to sign in to your account:

${magicLinkUrl}

This link will expire in 15 minutes for your security.

If you didn't request this login link, you can safely ignore this email.

Best regards,
The Vibe-Agents Team
        `.trim();

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Vibe-Agents Login Link</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
        }
        .container {
            background-color: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #4A90E2;
            margin-bottom: 10px;
        }
        .button {
            display: inline-block;
            background-color: #4A90E2;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
            text-align: center;
        }
        .button:hover {
            background-color: #357ABD;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
        }
        .security-note {
            background-color: #f8f9fa;
            padding: 15px;
            border-left: 4px solid #4A90E2;
            margin: 20px 0;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎙️ Vibe-Agents</div>
            <h1>Welcome back, ${displayName}!</h1>
        </div>
        
        <p>Click the button below to sign in to your Vibe-Agents account and continue sharing your stories:</p>
        
        <div style="text-align: center;">
            <a href="${magicLinkUrl}" class="button">Sign In to Vibe-Agents</a>
        </div>
        
        <div class="security-note">
            <strong>🔒 Security Note:</strong> This login link will expire in 15 minutes for your security. If you didn't request this login link, you can safely ignore this email.
        </div>
        
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace;">
            ${magicLinkUrl}
        </p>
        
        <div class="footer">
            <p>Best regards,<br>The Vibe-Agents Team</p>
            <p style="font-size: 12px; color: #999;">
                This email was sent to ${email}. Vibe-Agents helps preserve and share your life stories through AI-powered conversations.
            </p>
        </div>
    </div>
</body>
</html>
        `.trim();

        const mailOptions = {
            from: `${process.env.EMAIL_FROM_NAME || 'Vibe-Agents'} <${process.env.EMAIL_FROM || 'noreply@vibe-agents.com'}>`,
            to: email,
            subject: subject,
            text: textContent,
            html: htmlContent,
            headers: {
                'X-Priority': '1',
                'X-MSMail-Priority': 'High',
                'Importance': 'high'
            }
        };

        try {
            const result = await this.transporter.sendMail(mailOptions);
            console.log(`📧 Magic link email sent to ${email}:`, result.messageId);
            return result;
        } catch (error) {
            console.error(`❌ Failed to send magic link email to ${email}:`, error);
            throw new Error('Failed to send login email. Please try again.');
        }
    }

    async sendWelcomeEmail(email, userName = null) {
        if (!this.transporter) {
            console.log('📧 Welcome email not sent - email service not configured');
            return;
        }

        const displayName = userName || email.split('@')[0];
        const subject = 'Welcome to Vibe-Agents!';
        
        const textContent = `
Hello ${displayName},

Welcome to Vibe-Agents! We're excited to help you preserve and share your life stories.

Vibe-Agents uses AI to help you have natural conversations about your memories and experiences. As you chat, our Memory Keeper will automatically organize important details like people, places, dates, and events from your stories.

Here's what you can do:
• Start conversations about any period of your life
• Share memories and stories naturally
• See your memories organized automatically
• Search through your conversations and memories
• Export your stories to share with family

Your stories are private and secure. Only you can access your memories unless you choose to share them.

Ready to start? Visit ${process.env.CLIENT_URL || 'http://localhost:3000'} and begin sharing your stories.

Best regards,
The Vibe-Agents Team
        `.trim();

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Vibe-Agents!</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
        }
        .container {
            background-color: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 32px;
            margin-bottom: 10px;
        }
        .feature-list {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
        }
        .feature-list ul {
            margin: 0;
            padding-left: 20px;
        }
        .feature-list li {
            margin-bottom: 8px;
        }
        .cta-button {
            display: inline-block;
            background-color: #4A90E2;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎙️</div>
            <h1>Welcome to Vibe-Agents, ${displayName}!</h1>
        </div>
        
        <p>We're excited to help you preserve and share your life stories through natural, AI-powered conversations.</p>
        
        <h2>What is Vibe-Agents?</h2>
        <p>Vibe-Agents helps you share your memories and experiences through friendly conversations. As you chat, our AI Memory Keeper automatically organizes the important details from your stories.</p>
        
        <div class="feature-list">
            <h3>Here's what you can do:</h3>
            <ul>
                <li><strong>Start conversations</strong> about any period of your life</li>
                <li><strong>Share memories naturally</strong> - just like talking to a friend</li>
                <li><strong>See your memories organized</strong> automatically by people, places, dates, and events</li>
                <li><strong>Search through your stories</strong> to find specific memories</li>
                <li><strong>Export your stories</strong> to share with family members</li>
            </ul>
        </div>
        
        <p><strong>🔒 Your Privacy:</strong> Your stories are private and secure. Only you can access your memories unless you choose to share them with family.</p>
        
        <div style="text-align: center;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" class="cta-button">Start Sharing Your Stories</a>
        </div>
        
        <div class="footer">
            <p>Best regards,<br>The Vibe-Agents Team</p>
            <p style="font-size: 12px; color: #999;">
                This email was sent to ${email}. If you have any questions, feel free to reply to this email.
            </p>
        </div>
    </div>
</body>
</html>
        `.trim();

        const mailOptions = {
            from: `${process.env.EMAIL_FROM_NAME || 'Vibe-Agents'} <${process.env.EMAIL_FROM || 'noreply@vibe-agents.com'}>`,
            to: email,
            subject: subject,
            text: textContent,
            html: htmlContent
        };

        try {
            const result = await this.transporter.sendMail(mailOptions);
            console.log(`📧 Welcome email sent to ${email}:`, result.messageId);
            return result;
        } catch (error) {
            console.error(`❌ Failed to send welcome email to ${email}:`, error);
            // Don't throw error for welcome email - it's not critical
        }
    }

    // Test email configuration
    async testConnection() {
        if (!this.transporter || typeof this.transporter.verify !== 'function') {
            return { success: false, message: 'Email service not configured or in development mode' };
        }

        try {
            await this.transporter.verify();
            return { success: true, message: 'Email service connection verified' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;
