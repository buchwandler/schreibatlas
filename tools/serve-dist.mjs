import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer(async (request, response) => {
  let pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const basePath = process.env.SITE_BASE_PATH ?? "";
  if (basePath && basePath !== "/") {
    if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) {
      response.writeHead(404).end();
      return;
    }
    pathname = pathname.slice(basePath.length) || "/";
  }
  const relativePath = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const filePath = resolve(root, `.${relativePath}`);

  if (!filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end();
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, { "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream" });
    response.end(content);
  } catch {
    response.writeHead(404).end();
  }
}).listen(4322, "127.0.0.1");
