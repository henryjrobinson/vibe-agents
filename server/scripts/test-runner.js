#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: 'inherit',
            cwd: options.cwd || process.cwd(),
            env: { ...process.env, ...options.env }
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve(code);
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

async function main() {
    const args = process.argv.slice(2);
    const testType = args[0] || 'all';

    log('🧪 Vibe-Agents Test Runner', 'cyan');
    log('================================', 'cyan');

    try {
        // Set test environment
        process.env.NODE_ENV = 'test';
        process.env.TEST_DEBUG = args.includes('--debug') ? '1' : '0';

        switch (testType) {
            case 'auth':
                log('🔐 Running Authentication Tests...', 'yellow');
                await runCommand('npm', ['run', 'test:auth']);
                break;

            case 'db':
            case 'database':
                log('🗄️ Running Database Tests...', 'yellow');
                await runCommand('npm', ['run', 'test:db']);
                break;

            case 'coverage':
                log('📊 Running Tests with Coverage...', 'yellow');
                await runCommand('npm', ['run', 'test:coverage']);
                break;

            case 'watch':
                log('👀 Running Tests in Watch Mode...', 'yellow');
                await runCommand('npm', ['run', 'test:watch']);
                break;

            case 'verbose':
                log('📝 Running Tests in Verbose Mode...', 'yellow');
                await runCommand('npm', ['run', 'test:verbose']);
                break;

            case 'all':
            default:
                log('🚀 Running All Tests...', 'yellow');
                await runCommand('npm', ['test']);
                break;
        }

        log('✅ All tests completed successfully!', 'green');

    } catch (error) {
        log(`❌ Tests failed: ${error.message}`, 'red');
        process.exit(1);
    }
}

// Handle command line help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    log('🧪 Vibe-Agents Test Runner', 'cyan');
    log('Usage: node scripts/test-runner.js [type] [options]', 'bright');
    log('');
    log('Test Types:', 'bright');
    log('  all       Run all tests (default)', 'reset');
    log('  auth      Run authentication tests only', 'reset');
    log('  db        Run database tests only', 'reset');
    log('  coverage  Run tests with coverage report', 'reset');
    log('  watch     Run tests in watch mode', 'reset');
    log('  verbose   Run tests in verbose mode', 'reset');
    log('');
    log('Options:', 'bright');
    log('  --debug   Enable debug logging', 'reset');
    log('  --help    Show this help message', 'reset');
    process.exit(0);
}

main().catch((error) => {
    log(`❌ Test runner failed: ${error.message}`, 'red');
    process.exit(1);
});
