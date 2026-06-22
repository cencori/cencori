import { createServer } from "node:http";
import { resolve } from "node:path";
import { loadAgent } from "../loader.js";
import { runAgent, streamAgent } from "../runner/index.js";

export async function devCommand(options: {
  port: string;
  agentDir: string;
}): Promise<void> {
  const port = parseInt(options.port, 10);
  const agentDirPath = resolve(process.cwd(), options.agentDir);

  console.log(`\n  Jett dev server\n`);
  console.log(`  Agent: ${agentDirPath}`);
  console.log(`  Server: http://localhost:${port}\n`);

  try {
    const agent = await loadAgent(agentDirPath);
    console.log(`  Model: ${agent.manifest.config.model}`);
    const toolCount = Object.keys(agent.manifest.tools).length;
    console.log(`  Tools: ${toolCount}`);
    console.log();
  } catch (err) {
    console.error(`  Failed to load agent:`, err);
    process.exit(1);
  }

  const server = createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/") {
      let body = "";
      for await (const chunk of req) body += chunk;

      try {
        const { message, stream } = JSON.parse(body);

        if (stream) {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });

          for await (const chunk of streamAgent(agentDirPath, message)) {
            res.write(`data: ${JSON.stringify({ type: "text", delta: chunk })}\n\n`);
          }
          res.write("data: [DONE]\n\n");
          res.end();
        } else {
          const result = await runAgent(agentDirPath, message);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        }
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  server.listen(port, () => {
    console.log(`  Listening on http://localhost:${port}`);
    console.log(`  POST / with { "message": "hello" }`);
    console.log();
  });
}
