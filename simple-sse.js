// Absolute minimal SSE server - no dependencies on MCP protocol
import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

console.log(`Starting super simple SSE server on port ${PORT}`);
console.log(`Environment variables: ${Object.keys(process.env).join(', ')}`);

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log(`Headers: ${JSON.stringify(req.headers)}`);
  next();
});

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check
app.get('/ping', (req, res) => {
  res.json({ status: 'ok', message: 'Simple SSE server is running' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('Simple SSE server is running. Try the /ping endpoint for a health check or /sse for a Server-Sent Events stream.');
});

// Try ALL possible SSE endpoint paths that supermachines might expect
app.get(['/sse', '/mcp', '/events', '/stream', '/connect'], (req, res) => {
  console.log(`SSE connection requested on ${req.path}`);
  
  // Set standard SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disable proxy buffering which can break SSE
  });
  
  // Send a comment line to keep the connection alive
  res.write(':\n\n');
  
  // Send an initial event
  const data = {
    message: 'SSE connection established',
    timestamp: new Date().toISOString(),
    path: req.path
  };
  
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  
  // Send a heartbeat event every 3 seconds
  const intervalId = setInterval(() => {
    const heartbeat = {
      type: 'heartbeat',
      timestamp: new Date().toISOString()
    };
    
    res.write(`event: heartbeat\n`);
    res.write(`data: ${JSON.stringify(heartbeat)}\n\n`);
    
    // Also send a comment line which can help keep connections alive
    res.write(':\n\n');
  }, 3000);
  
  // Clean up on connection close
  req.on('close', () => {
    console.log(`SSE connection on ${req.path} closed`);
    clearInterval(intervalId);
  });
});

// Simple JSON-RPC style endpoint for MCP compatibility
app.post('/messages', express.json(), (req, res) => {
  console.log('Received POST to /messages');
  console.log(`Body: ${JSON.stringify(req.body)}`);
  console.log(`Query: ${JSON.stringify(req.query)}`);
  
  // Simple echo response
  res.json({
    jsonrpc: '2.0',
    result: {
      content: [
        {
          type: 'text/plain',
          text: `Received your message at ${new Date().toISOString()}`
        }
      ]
    },
    id: req.body?.id || 'unknown'
  });
});

// Error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Simple SSE server listening on port ${PORT}`);
  console.log(`Server time: ${new Date().toISOString()}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  
  // Force exit after timeout
  setTimeout(() => {
    console.error('Forcing exit after timeout');
    process.exit(1);
  }, 5000);
});