// Gọi một tool qua stdio để thử tay: node try.mjs <workspace> <tool> '<json args>'
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const [ws, tool, json = "{}"] = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url));
const client = new Client({ name: "try", version: "0" });
await client.connect(
  new StdioClientTransport({
    command: "node",
    args: [resolve(here, "server.mjs"), "--workspace", ws],
  }),
);
if (!tool) {
  for (const t of (await client.listTools()).tools) console.log(t.name, "—", t.description);
} else {
  const r = await client.callTool({ name: tool, arguments: JSON.parse(json) });
  for (const c of r.content) console.log(c.text);
  if (r.isError) process.exitCode = 1;
}
await client.close();
