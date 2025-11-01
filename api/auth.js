import { createOrUpdateUser, getUserByUserId } from "../lib/db.js";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = "aes-256-cbc";

function encrypt(text) {
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY not configured");
  }
  const iv = crypto.randomBytes(16);
  // Convert hex string to buffer (64 hex chars = 32 bytes)
  const keyBuffer = Buffer.from(ENCRYPTION_KEY, "hex");
  if (keyBuffer.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
    );
  }
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text) {
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY not configured");
  }
  const parts = text.split(":");
  const iv = Buffer.from(parts.shift(), "hex");
  const encryptedText = Buffer.from(parts.join(":"), "hex");
  // Convert hex string to buffer (64 hex chars = 32 bytes)
  const keyBuffer = Buffer.from(ENCRYPTION_KEY, "hex");
  if (keyBuffer.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
    );
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.status(400).json({ error: "Missing code or state parameter" });
  }

  const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
  const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
  const REDDIT_REDIRECT_URI =
    process.env.REDDIT_REDIRECT_URI ||
    `${req.headers["x-forwarded-proto"] || "https"}://${
      req.headers.host
    }/api/auth`;

  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
    return res.status(500).json({ error: "Reddit credentials not configured" });
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch(
      "https://www.reddit.com/api/v1/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`
          ).toString("base64")}`,
          "User-Agent": "RedditScheduler/1.0 by YourUsername",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: REDDIT_REDIRECT_URI,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return res.redirect(
        `/?error=${encodeURIComponent("Failed to exchange authorization code")}`
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token } = tokenData;

    if (!refresh_token) {
      return res.redirect(
        `/?error=${encodeURIComponent("No refresh token received")}`
      );
    }

    // Get user info from Reddit
    const userResponse = await fetch("https://oauth.reddit.com/api/v1/me", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "User-Agent": "RedditScheduler/1.0 by YourUsername",
      },
    });

    if (!userResponse.ok) {
      return res.redirect(
        `/?error=${encodeURIComponent("Failed to get user info")}`
      );
    }

    const userData = await userResponse.json();
    const userId = userData.name;

    // Encrypt and store refresh token
    const encryptedRefreshToken = encrypt(refresh_token);
    await createOrUpdateUser(userId, encryptedRefreshToken);

    // Redirect to frontend with success message
    const frontendUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:5173";

    return res.redirect(
      `${frontendUrl}/?auth=success&user=${encodeURIComponent(
        JSON.stringify({
          username: userId,
          userId: userId,
        })
      )}`
    );
  } catch (error) {
    console.error("Auth error:", error);
    return res.redirect(
      `/?error=${encodeURIComponent("Authentication failed")}`
    );
  }
}
