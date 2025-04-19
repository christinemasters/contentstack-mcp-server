// Minimal MCP Server - No contentstack dependencies
import express from "express";
import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

dotenv.config();
const PORT = process.env.PORT || 3000;

console.log(`Starting minimal MCP server on port ${PORT}`);

// init MCP server
const mcp = new McpServer({ name: "Minimal MCP", version: "0.1.0" });

// Register a simple echo tool
mcp.tool(
  "echo",
  { message: z.string() },
  async ({ message }) => {
    console.log(`Echo tool called with message: ${message}`);
    return {
      content: [{ type: "text/plain", text: `You said: ${message}` }],
    };
  }
);

const app = express();
app.use(express.json());

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  next();
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

// Store transports by session ID
const transports = {};

// SSE endpoint - try multiple paths
app.get(['/sse', '/mcp'], async (req, res) => {
  console.log(`SSE connection requested on path: ${req.path}`);
  console.log(`Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);

  try {
    // Create a new SSE transport
    const transport = new SSEServerTransport('/messages', res);
    
    // Store the transport by session ID
    const sessionId = transport.sessionId;
    transports[sessionId] = transport;
    
    // Set up onclose handler to clean up transport when closed
    transport.onclose = () => {
      console.log(`SSE transport closed for session ${sessionId}`);
      delete transports[sessionId];
    };
    
    // Connect the transport to the MCP server
    await mcp.connect(transport);
    
    // Start the SSE transport to begin streaming
    await transport.start();
    console.log(`Established SSE stream with session ID: ${sessionId}`);
  } catch (error) {
    console.error('Error establishing SSE stream:', error);
    console.error(error.stack);
    if (!res.headersSent) {
      res.status(500).send('Error establishing SSE stream');
    }
  }
});

// Messages endpoint for receiving client JSON-RPC requests
app.post('/messages', async (req, res) => {
  console.log('Received POST request to /messages');
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Query params:', req.query);
  
  // Extract session ID from URL query parameter
  const sessionId = req.query.sessionId;
  if (!sessionId) {
    console.error('No session ID provided in request URL');
    res.status(400).send('Missing sessionId parameter');
    return;
  }
  
  const transport = transports[sessionId];
  if (!transport) {
    console.error(`No active transport found for session ID: ${sessionId}`);
    res.status(404).send('Session not found');
    return;
  }
  
  try {
    // Handle the POST message with the transport
    await transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    console.error('Error handling request:', error);
    console.error(error.stack);
    if (!res.headersSent) {
      res.status(500).send('Error handling request');
    }
  }
});

// health check
app.get("/ping", (_, res) => res.json({ status: "ok", message: "Minimal MCP server is running" }));

// Root route
app.get("/", (_, res) => res.send("Minimal MCP Server is running. Try /ping for health check or /sse for SSE endpoint."));

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (reason instanceof Error) {
    console.error(reason.stack);
  }
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Minimal MCP Server listening on port ${PORT}`);
});

// Handle server shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  
  // Close all active transports to properly clean up resources
  for (const sessionId in transports) {
    try {
      console.log(`Closing transport for session ${sessionId}`);
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }
  
  // Close the MCP server
  try {
    await mcp.close();
  } catch (error) {
    console.error('Error closing MCP server:', error);
  }
  
  // Close the HTTP server
  server.close(() => {
    console.log('HTTP server closed');
    console.log('Server shutdown complete');
    process.exit(0);
  });
  
  // Force exit after timeout if graceful shutdown fails
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
});