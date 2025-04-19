// Minimal server to test connection
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Log all env variables (without values) to see what's available
console.log('Available environment variables:', Object.keys(process.env));
console.log(`PORT: ${PORT}`);

// Basic health check
app.get('/ping', (req, res) => {
  res.json({ status: 'ok', message: 'Minimal test server is running' });
});

// Root route
app.get('/', (req, res) => {
  res.send('MCP Test Server is running. Try /ping for health check.');
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Test server listening at http://localhost:${PORT}`);
});