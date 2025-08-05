/**
 * Secure Client-Side Encryption Utilities
 * Uses Web Crypto API with AES-GCM for encrypting sensitive data in sessionStorage
 */

// WeakMap for truly private key storage - completely inaccessible from outside
const privateKeys = new WeakMap();
const keyStatus = new WeakMap();

class SecureStorage {
    constructor() {
        // Initialize private storage - no accessible methods or properties
        privateKeys.set(this, null);
        keyStatus.set(this, false);
    }

    /**
     * Generate a new AES-GCM encryption key for this session
     */
    async generateKey() {
        try {
            const key = await window.crypto.subtle.generateKey(
                {
                    name: 'AES-GCM',
                    length: 256
                },
                false, // Not extractable for security
                ['encrypt', 'decrypt']
            );
            privateKeys.set(this, key);
            keyStatus.set(this, true);
            console.log('🔐 Encryption key generated successfully');
        } catch (error) {
            console.error('Failed to generate encryption key:', error);
            throw new Error('Encryption initialization failed');
        }
    }

    /**
     * Encrypt data using AES-GCM
     * @param {string} plaintext - Data to encrypt
     * @returns {string} - Base64 encoded encrypted data with IV
     */
    async encrypt(plaintext) {
        if (!keyStatus.get(this)) {
            await this.generateKey();
        }

        try {
            // Generate a random initialization vector
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            
            // Convert string to ArrayBuffer
            const encoder = new TextEncoder();
            const data = encoder.encode(plaintext);

            // Encrypt the data
            const encryptedData = await window.crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                privateKeys.get(this),
                data
            );

            // Combine IV and encrypted data
            const combined = new Uint8Array(iv.length + encryptedData.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encryptedData), iv.length);

            // Convert to base64 for storage
            return btoa(String.fromCharCode(...combined));
        } catch (error) {
            console.error('Encryption failed:', error);
            throw new Error('Failed to encrypt sensitive data');
        }
    }

    /**
     * Decrypt data using AES-GCM
     * @param {string} encryptedData - Base64 encoded encrypted data
     * @returns {string} - Decrypted plaintext
     */
    async decrypt(encryptedData) {
        if (!keyStatus.get(this)) {
            throw new Error('Encryption key not available');
        }

        try {
            // Convert from base64
            const combined = new Uint8Array(
                atob(encryptedData).split('').map(char => char.charCodeAt(0))
            );

            // Extract IV and encrypted data
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);

            // Decrypt the data
            const decryptedData = await window.crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                privateKeys.get(this),
                encrypted
            );

            // Convert back to string
            const decoder = new TextDecoder();
            return decoder.decode(decryptedData);
        } catch (error) {
            console.error('Decryption failed:', error);
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Securely store encrypted data in sessionStorage
     * @param {string} key - Storage key
     * @param {any} data - Data to store (will be JSON stringified)
     */
    async setSecureItem(key, data) {
        try {
            const jsonString = JSON.stringify(data);
            const encryptedData = await this.encrypt(jsonString);
            sessionStorage.setItem(`secure_${key}`, encryptedData);
        } catch (error) {
            console.error(`Failed to securely store ${key}:`, error);
            throw error;
        }
    }

    /**
     * Retrieve and decrypt data from sessionStorage
     * @param {string} key - Storage key
     * @returns {any} - Decrypted and parsed data
     */
    async getSecureItem(key) {
        try {
            const encryptedData = sessionStorage.getItem(`secure_${key}`);
            if (!encryptedData) {
                return null;
            }

            const decryptedString = await this.decrypt(encryptedData);
            return JSON.parse(decryptedString);
        } catch (error) {
            console.error(`Failed to retrieve secure item ${key}:`, error);
            // Return null instead of throwing to handle corrupted data gracefully
            return null;
        }
    }

    /**
     * Remove encrypted item from sessionStorage
     * @param {string} key - Storage key
     */
    removeSecureItem(key) {
        sessionStorage.removeItem(`secure_${key}`);
    }

    /**
     * Clear all secure storage items
     */
    clearSecureStorage() {
        // Find and remove all items with 'secure_' prefix
        const keysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith('secure_')) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => sessionStorage.removeItem(key));
        console.log('🔐 Secure storage cleared');
    }

    /**
     * Check if Web Crypto API is available
     * @returns {boolean}
     */
    static isSupported() {
        return !!(window.crypto && window.crypto.subtle);
    }
}

// Create global instance
const secureStorage = new SecureStorage();

// Initialize encryption on page load
document.addEventListener('DOMContentLoaded', async () => {
    if (SecureStorage.isSupported()) {
        try {
            await secureStorage.generateKey();
            console.log('🔐 Secure storage initialized');
        } catch (error) {
            console.error('🚨 Failed to initialize secure storage:', error);
        }
    } else {
        console.warn('🚨 Web Crypto API not supported - falling back to unencrypted storage');
    }
});

// Export for use in other modules
window.secureStorage = secureStorage;
