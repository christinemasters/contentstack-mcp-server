// Contentstack MCP Server – Node.js/Express + SSE MCP transport
import express from "express";
import dotenv from "dotenv";
import path from "path";

// pull in the MCP server & transport from their sub‑paths
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

import Contentstack from "contentstack";
import contentstackManagement from "@contentstack/management";
import { z } from "zod";

dotenv.config();
const PORT = process.env.PORT || 3000;

// your Env vars…
const { STACK_API_KEY, DELIVERY_TOKEN, ENVIRONMENT, MANAGEMENT_TOKEN } =
  process.env;

// sanity‑check
if (!STACK_API_KEY || !DELIVERY_TOKEN || !ENVIRONMENT) {
  console.error("Missing one of STACK_API_KEY, DELIVERY_TOKEN, ENVIRONMENT");
  process.exit(1);
}

// init MCP server
const mcp = new McpServer({ name: "Contentstack MCP", version: "0.1.0" });

// register tools…
mcp.tool(
  "searchEntries",
  { contentType: z.string(), query: z.any().optional() },
  async ({ contentType, query = {} }) => {
    const [entries] = await Contentstack.Stack({
      api_key: STACK_API_KEY,
      delivery_token: DELIVERY_TOKEN,
      environment: ENVIRONMENT,
    })
      .ContentType(contentType)
      .Query()
      .query(query)
      .find();
    return {
      content: [{ type: "application/json", text: JSON.stringify(entries) }],
    };
  }
);
mcp.tool(
  "createEntry",
  { contentType: z.string(), entry: z.any() },
  async ({ contentType, entry }) => {
    if (!MANAGEMENT_TOKEN) throw new Error("Missing MANAGEMENT_TOKEN");
    const mgmt = contentstackManagement
      .client({ management_token: MANAGEMENT_TOKEN })
      .stack({ api_key: STACK_API_KEY });
    const created = await mgmt
      .contentType(contentType)
      .entry()
      .create({ entry });
    return {
      content: [{ type: "application/json", text: JSON.stringify(created) }],
    };
  }
);

const app = express();
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public"))); // if you have ai-plugin.json, openapi.json

// Store transports by session ID
const transports = {};

// SSE endpoint for remote MCP clients
app.get("/sse", (req, res) => {
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
  mcp.connect(transport);
  
  // Start the SSE transport to begin streaming
  transport.start();
  console.log(`Established SSE stream with session ID: ${sessionId}`);
});

// Messages endpoint for receiving client JSON-RPC requests
app.post('/messages', async (req, res) => {
  console.log('Received POST request to /messages');
  
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
    if (!res.headersSent) {
      res.status(500).send('Error handling request');
    }
  }
});

// health check
app.get("/ping", (_, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`MCP Server listening on port ${PORT}`);
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
  
  await mcp.close();
  console.log('Server shutdown complete');
  process.exit(0);
});
