#!/usr/bin/env node

// Production start script
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting IT Infrastructure Management Bot in production mode...');

// Set production environment
process.env.NODE_ENV = 'production';

// Start the server
const server = spawn('node', ['dist/server/index.js'], {
  stdio: 'inherit',
  cwd: process.cwd()
});

server.on('error', (err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`🛑 Server exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.kill('SIGTERM');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.kill('SIGTERM');
});