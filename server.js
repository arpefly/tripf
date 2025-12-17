import { createServer } from "https";
import { parse, fileURLToPath } from "url";
import next from "next";
import fs from "fs";
import path from "path";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = 3000;

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

const localIP = getLocalIP();

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, "certificates", "localhost-key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "certificates", "localhost.pem")),
};

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  }).listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on https://localhost:${port}`);
    console.log(`> Ready on https://${localIP}:${port}`);
  });
});
