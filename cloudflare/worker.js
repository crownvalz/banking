const corsHeaders = (origin, env) => ({
  "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || origin,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Cf-Access-Jwt-Assertion",
  "Vary": "Origin"
});
function response(data, status, origin, env) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin, env) } });
}
function parseCsv(text) {
  const rows = []; let row = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (c === '"' && quoted && next === '"') { value += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(value); value = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && next === "\n") i++;
      row.push(value); if (row.some(v => v.trim())) rows.push(row); row = []; value = "";
    } else value += c;
  }
  row.push(value); if (row.some(v => v.trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map(v => v.trim().toLowerCase().replace(/^\uFEFF/, ""));
  return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, (values[i] || "").trim()])));
}
function csvCell(value) { const s = String(value ?? ""); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text); let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function decodeBase64(value) {
  const binary = atob(value.replace(/\n/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
}
async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function verifyAccessJwt(request, env) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new Error("Sign in through Cloudflare Access first.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid access token.");
  const decodePart = value => JSON.parse(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")));
  const header = decodePart(parts[0]), claims = decodePart(parts[1]);
  const issuer = "https://" + env.ACCESS_TEAM_DOMAIN;
  const audienceValid = Array.isArray(claims.aud) ? claims.aud.includes(env.ACCESS_AUD) : claims.aud === env.ACCESS_AUD;
  if (claims.iss !== issuer || !audienceValid) throw new Error("Access token issuer or audience is invalid.");
  if (!claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) throw new Error("Your session expired. Sign in again.");
  const jwksResponse = await fetch(issuer + "/cdn-cgi/access/certs");
  if (!jwksResponse.ok) throw new Error("Unable to verify access session.");
  const jwks = await jwksResponse.json(), jwk = jwks.keys.find(key => key.kid === header.kid);
  if (!jwk) throw new Error("Access signing key was not found.");
  const publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const signature = Uint8Array.from(atob(parts[2].replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parts[2].length / 4) * 4, "=")), c => c.charCodeAt(0));
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature, new TextEncoder().encode(parts[0] + "." + parts[1]))) throw new Error("Access token signature is invalid.");
  const email = String(claims.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Your authenticated account has no email claim.");
  return { owner: await sha256(email) };
}
async function githubRequest(env, path, options = {}) {
  const res = await fetch("https://api.github.com/repos/" + env.GITHUB_REPOSITORY + "/" + path, {
    ...options,
    headers: { "Authorization": "Bearer " + env.GITHUB_TOKEN, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Banking-CSV-Library", ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "GitHub returned " + res.status + ".");
  return data;
}
async function readIndex(env) {
  try {
    const file = await githubRequest(env, "contents/links.csv?ref=main");
    return { sha: file.sha, rows: parseCsv(decodeBase64(file.content)) };
  } catch (error) {
    if (String(error.message).includes("Not Found")) return { sha: null, rows: [] };
    throw error;
  }
}
async function saveIndex(env, index) {
  const keys = ["stored_name", "original_name", "owner_hash", "row_count", "uploaded_at"];
  const content = [keys.join(","), ...index.rows.map(row => keys.map(key => csvCell(row[key])).join(","))].join("\n") + "\n";
  const body = { message: "Update CSV library index", content: encodeBase64(content), branch: "main" };
  if (index.sha) body.sha = index.sha;
  return githubRequest(env, "contents/links.csv", { method: "PUT", body: JSON.stringify(body) });
}
function validateCsv(content) {
  if (typeof content !== "string" || !content.trim()) throw new Error("CSV content is empty.");
  if (new TextEncoder().encode(content).length > 1024 * 1024) throw new Error("CSV files must not exceed 1 MB.");
  const rows = parseCsv(content);
  if (!rows.length || !Object.keys(rows[0]).includes("title") || !Object.keys(rows[0]).includes("url")) throw new Error("CSV must have title and url column headers.");
  const clean = [];
  for (const row of rows) {
    const title = String(row.title || "").trim().slice(0, 120); let parsed;
    try { parsed = new URL(String(row.url || "").trim()); } catch { continue; }
    if (!title || !["http:", "https:"].includes(parsed.protocol)) continue;
    clean.push({ title, url: parsed.href, category: String(row.category || "Uploaded CSV").trim().slice(0, 60), icon: String(row.icon || "fa-link").trim().slice(0, 50), keywords: String(row.keywords || title).trim().slice(0, 300) });
  }
  if (!clean.length) throw new Error("No valid title and HTTP/HTTPS URL rows were found.");
  const keys = ["title", "url", "category", "icon", "keywords"];
  return [keys.join(","), ...clean.map(row => keys.map(key => csvCell(row[key])).join(","))].join("\n") + "\n";
}
async function listFiles(user, env, origin) {
  const index = await readIndex(env);
  const files = index.rows.filter(row => row.owner_hash === user.owner).map(row => ({ file_name: row.stored_name, original_name: row.original_name, row_count: Number(row.row_count || 0), uploaded_at: row.uploaded_at }));
  return response({ files }, 200, origin, env);
}
async function uploadFile(request, user, env, origin) {
  const body = await request.json(), originalName = String(body.original_name || "uploaded.csv").replace(/[\\/\r\n]/g, "_").slice(0, 120);
  const content = validateCsv(body.content), rowCount = parseCsv(content).length;
  const index = await readIndex(env), used = new Set(index.rows.map(row => row.stored_name));
  let number = 1; while (used.has("link" + number + ".csv")) number++;
  const fileName = "link" + number + ".csv";
  await githubRequest(env, "contents/bank_links/" + fileName, { method: "PUT", body: JSON.stringify({ message: "Upload " + fileName + " to CSV library", content: encodeBase64(content), branch: "main" }) });
  index.rows.push({ stored_name: fileName, original_name: originalName, owner_hash: user.owner, row_count: String(rowCount), uploaded_at: new Date().toISOString() });
  try { await saveIndex(env, index); }
  catch (error) { throw new Error("File " + fileName + " was uploaded but the index update failed. Contact the administrator before retrying. " + error.message); }
  return response({ success: true, file_name: fileName, row_count: rowCount }, 201, origin, env);
}
async function downloadFile(url, user, env, origin) {
  const name = url.searchParams.get("file") || "";
  if (!/^link[1-9][0-9]*\.csv$/.test(name)) return response({ error: "Invalid file name." }, 400, origin, env);
  const index = await readIndex(env), entry = index.rows.find(row => row.stored_name === name && row.owner_hash === user.owner);
  if (!entry) return response({ error: "File not found in your library." }, 404, origin, env);
  const file = await githubRequest(env, "contents/bank_links/" + name + "?ref=main");
  return response({ file_name: name, content: decodeBase64(file.content) }, 200, origin, env);
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    if (origin !== (env.ALLOWED_ORIGIN || "")) return response({ error: "Origin not allowed." }, 403, origin, env);
    if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return response({ error: "Worker configuration is incomplete." }, 500, origin, env);
    try {
      const user = await verifyAccessJwt(request, env), url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/files") return await listFiles(user, env, origin);
      if (request.method === "POST" && url.pathname === "/api/upload") return await uploadFile(request, user, env, origin);
      if (request.method === "GET" && url.pathname === "/api/download") return await downloadFile(url, user, env, origin);
      return response({ error: "Not found." }, 404, origin, env);
    } catch (error) { return response({ error: error.message || "Request failed." }, 400, origin, env); }
  }
};