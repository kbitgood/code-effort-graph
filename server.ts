import indexPage from "./index.html";

const requestedPort = Number(process.env.PORT ?? 3000);

const createServer = (port: number) =>
  Bun.serve({
    port,
    routes: {
      "/": indexPage,
      "/index.html": indexPage,
    },
    fetch() {
      return new Response("Not Found", { status: 404 });
    },
  });

const fallbackPorts = [requestedPort, requestedPort + 1, requestedPort + 2];
let server: ReturnType<typeof createServer> | null = null;
let lastError: unknown = null;

for (const port of fallbackPorts) {
  try {
    server = createServer(port);
    break;
  } catch (error) {
    lastError = error;
  }
}

if (!server) {
  throw lastError;
}

console.log(`Presentation app server running at http://localhost:${server.port}`);
