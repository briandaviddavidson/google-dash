import "dotenv/config";
import { createStore } from "./storage/index.js";
import { authConfigFromEnv, firebaseVerifier, parseAllowlist } from "./auth.js";
import { createApp } from "./app.js";

async function main() {
  const auth = authConfigFromEnv();
  if (auth.disabled) {
    console.warn("AUTH_DISABLED=true: anyone who can reach this API can edit annotations.");
  }

  const app = createApp({
    store: await createStore(),
    auth,
    verifyToken: auth.disabled ? undefined : await firebaseVerifier(process.env.GCP_PROJECT_ID),
    allowedOrigins: parseAllowlist(process.env.ALLOWED_ORIGINS),
    backendName: process.env.STORAGE_BACKEND || "firestore",
  });

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => {
    console.log(`google-dash API listening on port ${port}`);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
