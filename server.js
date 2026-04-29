const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 8787);
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const ROOT = __dirname;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/api/deepseek") {
      await proxyDeepSeek(request, response);
      return;
    }

    if (request.method !== "GET") {
      send(response, 405, "Method Not Allowed", "text/plain; charset=utf-8");
      return;
    }

    const url = new URL(request.url, `http://localhost:${PORT}`);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.normalize(path.join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) {
      send(response, 403, "Forbidden", "text/plain; charset=utf-8");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        send(response, 404, "Not Found", "text/plain; charset=utf-8");
        return;
      }
      const contentType = mimeTypes[path.extname(filePath)] || "application/octet-stream";
      send(response, 200, data, contentType);
    });
  } catch (error) {
    send(response, 500, JSON.stringify({ error: { message: error.message } }), "application/json; charset=utf-8");
  }
});

async function proxyDeepSeek(request, response) {
  const body = await readBody(request);
  const apiKey = request.headers.authorization;
  if (!apiKey) {
    send(response, 401, JSON.stringify({ error: { message: "Missing Authorization header" } }), "application/json; charset=utf-8");
    return;
  }

  const upstream = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body,
  });
  const text = await upstream.text();
  send(response, upstream.status, text, upstream.headers.get("content-type") || "application/json; charset=utf-8");
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function send(response, status, body, contentType) {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  response.end(body);
}

server.listen(PORT, HOST, () => {
  console.log(`Writing system ready: http://${HOST}:${PORT}`);
});
