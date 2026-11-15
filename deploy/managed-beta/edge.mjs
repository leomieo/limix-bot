import { createConnection, createServer } from "node:net";

// The application's Unix listener treats every connection as remote and requires pairing.
createServer(client => {
  const upstream = createConnection("/run/limix-edge/http.sock");
  client.on("error", () => upstream.destroy());
  upstream.on("error", () => client.destroy());
  client.on("close", () => upstream.destroy());
  upstream.on("close", () => client.destroy());
  client.pipe(upstream).pipe(client);
}).listen(8080, "0.0.0.0");
