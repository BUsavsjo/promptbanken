// Myntar en tidsbegränsad JWT för den begränsade "mcp_server"-rollen.
// Resultatet klistras in i mcp_promptbanken/.env på VPS:en som
// SUPABASE_SERVICE_ROLE_KEY (ersätter den riktiga service-role-nyckeln).
// Kräver SUPABASE_JWT_SECRET (Dashboard → Settings → API → JWT Secret).
// Körs aldrig i produktion, aldrig i Git.
//
// Token går ut efter EXPIRES_IN_DAYS (default 90) — kör om scriptet och
// uppdatera .env på VPS:en innan dess för att undvika avbrott. Ett kort
// utgångsdatum begränsar hur länge en läckt token kan missbrukas.
//
// Användning:
//   SUPABASE_JWT_SECRET=... node scripts/mint-mcp-server-jwt.js
//   SUPABASE_JWT_SECRET=... EXPIRES_IN_DAYS=30 node scripts/mint-mcp-server-jwt.js

import jwt from "jsonwebtoken";

const secret = process.env.SUPABASE_JWT_SECRET;
if (!secret) {
  console.error("SUPABASE_JWT_SECRET saknas. Sätt den som env-variabel innan körning.");
  process.exit(1);
}

const expiresInDays = Number(process.env.EXPIRES_IN_DAYS || 90);
if (!Number.isFinite(expiresInDays) || expiresInDays <= 0) {
  console.error("EXPIRES_IN_DAYS måste vara ett positivt tal.");
  process.exit(1);
}

const token = jwt.sign(
  { role: "mcp_server", iss: "supabase" },
  secret,
  { algorithm: "HS256", expiresIn: `${expiresInDays}d` }
);

console.log(token);
console.error(`(Token går ut om ${expiresInDays} dagar. Rotera innan dess.)`);
