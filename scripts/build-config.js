#!/usr/bin/env node

/**
 * Build Configuration Script
 * 
 * This script generates the js/config.js file from environment variables.
 * It reads from .env file (if present) or from process environment.
 * 
 * Usage:
 *   npm run build-config
 * 
 * Or for CI/CD where environment variables are already set:
 *   node scripts/build-config.js
 */

const fs = require('fs');
const path = require('path');

// Try to load .env file if it exists (for local development)
try {
  const dotenv = require('dotenv');
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('✓ Loaded .env file');
  }
} catch (error) {
  // dotenv not installed or .env doesn't exist, that's ok for CI/CD
  console.log('ℹ Using environment variables (dotenv not available or .env not found)');
}

// Get configuration from environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

// Validate required variables
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing required environment variables');
  console.error('   Required: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY');
  console.error('');
  console.error('   For local development:');
  console.error('   1. Copy .env.example to .env');
  console.error('   2. Fill in your actual Supabase credentials');
  console.error('   3. Run: npm run build-config');
  console.error('');
  console.error('   For CI/CD:');
  console.error('   Make sure GitHub secrets are configured properly');
  process.exit(1);
}

// Safely escape values for JavaScript (prevent injection)
function escapeForJS(value) {
  return JSON.stringify(value);
}

// Generate config.js content with safely escaped values
const configContent = `// This file is auto-generated during build/deployment
// DO NOT commit this file to git - it contains environment-specific configuration
// To generate this file locally, run: npm run build-config

window.SUPABASE_CONFIG = {
  url: ${escapeForJS(supabaseUrl)},
  publishableKey: ${escapeForJS(supabaseKey)}
};
`;

// Write to js/config.js (ensure directory exists)
const outputPath = path.join(__dirname, '..', 'js', 'config.js');
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
fs.writeFileSync(outputPath, configContent, 'utf8');

console.log('✓ Generated js/config.js successfully');
console.log(`  URL: ${supabaseUrl}`);
console.log(`  Key: ${supabaseKey.substring(0, 20)}...`);
