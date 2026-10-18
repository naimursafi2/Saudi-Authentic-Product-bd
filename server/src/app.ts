import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import compression from "compression";
import hpp from "hpp";

import { clientOrigins, env, isProduction } from "./config/env";
import { apiLimiter } from "./middlewares/rateLimit.middleware";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { sanitizeRequest } from "./middlewares/sanitize.middleware";
import { bustProductCacheOnWrite } from "./middlewares/productCache.middleware";
import routes from "./routes";
import sslcommerzCallbackRoutes from "./routes/sslcommerzCallback.routes";

export function createApp(): Express {
  const app = express();

  // Trust the first proxy hop (needed for correct client IPs / secure cookies
  // behind a reverse proxy or load balancer in production).
  app.set("trust proxy", 1);

  app.use(helmet());

  // SSLCommerz posts the customer's browser back from its own domain, so these
  // few gateway callbacks must sit before the CORS allow-list below. They are
  // unauthenticated and verify everything with SSLCommerz server-to-server.
  app.use(`${env.API_PREFIX}/payments/sslcommerz`, sslcommerzCallbackRoutes);
  app.use(
    cors({
      // `clientOrigins` is an allow-list (one origin, or several
      // comma-separated in `CLIENT_ORIGIN`) — requests from any other
      // origin are rejected. `!origin` covers non-browser/same-origin
      // requests (curl, server-to-server, the `/health` check) which don't
      // send an `Origin` header at all.
      origin(origin, callback) {
        if (!origin || clientOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use(cookieParser());
  app.use(compression());
  app.use(sanitizeRequest);
  app.use(hpp());

  if (!isProduction) {
    app.use(morgan("dev"));
  }

  app.get("/health", (_req, res) => {
    res.status(200).json({ success: true, message: "OK", data: { uptime: process.uptime() } });
  });

  app.use(env.API_PREFIX, apiLimiter, bustProductCacheOnWrite, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
