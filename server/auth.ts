import type { Request, Response, NextFunction } from "express";
import { ADMIN_PIN } from "@shared/schema";

// Soft server-side gate for mutation/admin endpoints on the public URL.
// The PIN also lives in the client bundle, so this is not strong security —
// it stops casual unauthenticated requests (e.g. someone curling /api/admin/reset).
export function requirePin(req: Request, res: Response, next: NextFunction) {
  const pin = req.get("x-admin-pin") || (req.body && req.body.pin);
  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}
