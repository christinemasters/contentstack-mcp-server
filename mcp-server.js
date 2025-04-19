// Contentstack MCP Server – Node.js/Express + SSE MCP transport
import express from "express";
import dotenv from "dotenv";
import path from "path";

// pull in the MCP server & transport from their sub‑paths
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";

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

// SSE endpoint for remote MCP clients
app.get("/sse", (req, res) => {
  const transport = new HttpServerTransport({ req, res });
  mcp.connect(transport);
});

// health check
app.get("/ping", (_, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`MCP Server listening on port ${PORT}`);
});
