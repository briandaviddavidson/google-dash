import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import type { AnnotationStore } from "./storage/index.js";
import { bearerToken, isAllowed, type AuthConfig, type TokenVerifier } from "./auth.js";
import { isValidId, validateFeature } from "./validate.js";

export interface AppOptions {
  store: AnnotationStore;
  auth: AuthConfig;
  /** Required unless auth.disabled. */
  verifyToken?: TokenVerifier;
  /** Origins allowed to call the API cross-origin. Empty = same-origin only. */
  allowedOrigins?: string[];
  backendName?: string;
}

export function createApp({ store, auth, verifyToken, allowedOrigins = [], backendName }: AppOptions) {
  if (!auth.disabled && !verifyToken) {
    throw new Error("verifyToken is required when auth is enabled");
  }

  const app = express();
  app.disable("x-powered-by");
  if (allowedOrigins.length > 0) {
    app.use(cors({ origin: allowedOrigins }));
  }
  app.use(express.json({ limit: "1mb" }));

  // Resolves to true if the request may proceed; otherwise responds and
  // resolves to false.
  async function authorize(req: Request, res: Response): Promise<boolean> {
    if (auth.disabled) return true;
    const token = bearerToken(req.header("authorization"));
    if (!token) {
      res.status(401).json({ error: "sign in required" });
      return false;
    }
    try {
      const user = await verifyToken!(token);
      if (!isAllowed(user.email, auth.allowedEmails)) {
        res.status(403).json({ error: `${user.email} is not allowed to edit` });
        return false;
      }
      return true;
    } catch {
      res.status(401).json({ error: "invalid or expired sign-in" });
      return false;
    }
  }

  const requireUser = async (req: Request, res: Response, next: NextFunction) => {
    if (await authorize(req, res)) next();
  };
  const requireUserUnlessPublicRead = async (req: Request, res: Response, next: NextFunction) => {
    if (auth.publicRead || (await authorize(req, res))) next();
  };

  app.get("/health", (_req, res) => {
    res.json({ ok: true, backend: backendName ?? "unknown" });
  });

  // Upsert a single annotation feature.
  app.post("/saveannotation", requireUser, async (req, res) => {
    const problem = validateFeature(req.body);
    if (problem) return res.status(400).json({ error: problem });
    try {
      await store.save(req.body);
      res.json({ ok: true });
    } catch (err) {
      console.error("saveannotation failed", err);
      res.status(500).json({ error: "save failed" });
    }
  });

  // Return all annotations as a GeoJSON FeatureCollection.
  app.get("/getannotations", requireUserUnlessPublicRead, async (_req, res) => {
    try {
      const features = await store.getAll();
      res.json({ type: "FeatureCollection", features });
    } catch (err) {
      console.error("getannotations failed", err);
      res.status(500).json({ error: "read failed" });
    }
  });

  // Delete an annotation by id.
  app.post("/deleteannotation", requireUser, async (req, res) => {
    const id = req.body?.id;
    if (!isValidId(id)) return res.status(400).json({ error: "a valid id is required" });
    try {
      await store.delete(String(id));
      res.json({ ok: true });
    } catch (err) {
      console.error("deleteannotation failed", err);
      res.status(500).json({ error: "delete failed" });
    }
  });

  return app;
}
