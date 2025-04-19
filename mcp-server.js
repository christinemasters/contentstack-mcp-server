import express from "express";
import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk";
import { HttpServerTransport } from "@modelcontextprotocol/sdk";
import Contentstack from "contentstack";
import contentstackManagement from "@contentstack/management";
import { z } from "zod";

dotenv.config();
const {
  STACK_API_KEY,
  DELIVERY_TOKEN,
  ENVIRONMENT,
  MANAGEMENT_TOKEN,
  PORT = 3000,
} = process.env;

if (!STACK_API_KEY || !DELIVERY_TOKEN || !ENVIRONMENT) {
  console.error("Missing STACK_API_KEY, DELIVERY_TOKEN or ENVIRONMENT");
  process.exit(1);
}

// Initialize Contentstack clients
const stack = Contentstack.Stack({
  api_key: STACK_API_KEY,
  delivery_token: DELIVERY_TOKEN,
  environment: ENVIRONMENT,
});
const managementStack = MANAGEMENT_TOKEN
  ? contentstackManagement
      .client({ management_token: MANAGEMENT_TOKEN })
      .stack({ api_key: STACK_API_KEY })
  : null;

// Initialize MCP server
const mcp = new McpServer({ name: "Contentstack MCP", version: "0.1.0" });

// Tool: searchEntries
mcp.tool(
  "searchEntries",
  { contentType: z.string(), query: z.any().optional() },
  async ({ contentType, query = {} }) => {
    const [entries] = await stack
      .ContentType(contentType)
      .Query()
      .query(query)
      .find();
    return {
      content: [{ type: "application/json", text: JSON.stringify(entries) }],
    };
  }
);

// Tool: createEntry
mcp.tool(
  "createEntry",
  { contentType: z.string(), entry: z.any() },
  async ({ contentType, entry }) => {
    if (!managementStack) throw new Error("MANAGEMENT_TOKEN required");
    const created = await managementStack
      .contentType(contentType)
      .entry()
      .create({ entry });
    return {
      content: [{ type: "application/json", text: JSON.stringify(created) }],
    };
  }
);

// Express setup
const app = express();
app.use(express.json());

// SSE endpoint (Supermachine & other remote MCP clients use this)
app.get("/sse", (req, res) => {
  const transport = new HttpServerTransport({ req, res });
  mcp.connect(transport);
});

// Health check (optional)
app.get("/ping", (_, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`MCP Server listening on http://localhost:${PORT}`);
});
