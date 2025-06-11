#!/usr/bin/env node

/**
 * Command-line interface for Node-RED MCP server
 */

import { createServer } from '../lib/server.mjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Define __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get version from package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  nodeRedUrl: process.env.NODE_RED_URL,
  nodeRedToken: process.env.NODE_RED_TOKEN,
  nodeRedUsername: process.env.NODE_RED_USERNAME,
  nodeRedPassword: process.env.NODE_RED_PASSWORD,
  verbose: false
};

// Process arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--url' || arg === '-u') {
    options.nodeRedUrl = args[++i];
  } else if (arg === '--token' || arg === '-t') {
    options.nodeRedToken = args[++i];
  } else if (arg === '--username' || arg === '--user') {
    options.nodeRedUsername = args[++i];
  } else if (arg === '--password' || arg === '--pass') {
    options.nodeRedPassword = args[++i];
  } else if (arg === '--verbose' || arg === '-v') {
    options.verbose = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Node-RED MCP Server v${packageJson.version}

Usage: node-red-mcp-server [options]

Options:
  -u, --url <url>          Node-RED base URL (default: http://localhost:1880)
  -t, --token <token>      Static API access token (alternative to username/password)
  --username <username>    Username for dynamic authentication
  --password <password>    Password for dynamic authentication  
  -v, --verbose           Enable verbose logging
  -h, --help              Show help
  -V, --version           Show version number

Environment Variables:
  NODE_RED_URL            Node-RED base URL
  NODE_RED_TOKEN          Static API access token
  NODE_RED_USERNAME       Username for dynamic authentication
  NODE_RED_PASSWORD       Password for dynamic authentication

Authentication:
  You can use either:
  1. Static token: --token or NODE_RED_TOKEN
  2. Dynamic auth: --username + --password or NODE_RED_USERNAME + NODE_RED_PASSWORD
  
Dynamic authentication will automatically manage token lifecycle.
    `);
    process.exit(0);
  } else if (arg === '--version' || arg === '-V') {
    console.log(packageJson.version);
    process.exit(0);
  }
}

// Create and start server
async function run() {
  try {
    const server = createServer(options);
    await server.start();
  } catch (error) {
    process.exit(1);
  }
}

// Start
run();
