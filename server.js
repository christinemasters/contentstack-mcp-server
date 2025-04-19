// Minimal server to test connection with SSE support
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all env variables (without values) to see what's available
console.log('Available environment variables:', Object.keys(process.env));
console.log(`PORT: ${PORT}`);

// Basic health check
app.get('/ping', (req, res) => {
  res.json({ status: 'ok', message: 'Minimal test server is running' });
});

// Root route
app.get('/', (req, res) => {
  res.send('MCP Test Server is running. Try /ping for health check or /sse for SSE endpoint.');
});

// CORS middleware for cross-domain requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  next();
});

// Basic SSE endpoint - try all possible endpoint paths
app.get(['/sse', '/mcp', '/', '/events', '/stream'], (req, res) => {
  console.log(`SSE connection requested on path: ${req.path}`);
  console.log(`Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // Send an initial message
  res.write('event: connected\ndata: {"status":"connected","message":"Basic SSE connection established"}\n\n');
  
  // Send a message every 5 seconds
  const intervalId = setInterval(() => {
    res.write(`event: ping\ndata: {"time":"${new Date().toISOString()}"}\n\n`);
  }, 5000);
  
  // Handle client disconnect
  req.on('close', () => {
    console.log('SSE connection closed');
    clearInterval(intervalId);
  });
});

// Add a basic MCP compatibility endpoint for messages
app.post('/messages', (req, res) => {
  console.log('Received POST request to /messages');
  console.log('Request body:', req.body);
  console.log('Query params:', req.query);
  
  // Send a simple response in JSON-RPC format
  res.json({
    jsonrpc: '2.0',
    result: {
      status: 'ok',
      message: 'This is a simple MCP-compatible response'
    },
    id: req.body?.id || 'unknown-id'
  });
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