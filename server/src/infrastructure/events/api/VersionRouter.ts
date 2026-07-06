import express from 'express';
import { Router } from 'express';

export class VersionRouter {
  private routers: Map<string, Router> = new Map();

  register(version: string, router: Router): void {
    this.routers.set(version, router);
  }

  getRouter(): Router {
    const router = express.Router();

    // Versioned endpoints
    router.use('/v1', this.routers.get('v1') || express.Router());

    // Version negotiation via Accept header
    router.use((req, res, next) => {
      const accept = req.headers['accept'] || '';
      const match = accept.match(/application\/vnd\.ifysora\.v(\d+)\+json/);
      
      if (match) {
        const version = `v${match[1]}`;
        const versionRouter = this.routers.get(version);
        if (versionRouter) {
          // Forward to the correct version
          req.url = req.url.replace(/^\/api/, `/api/${version}`);
        }
      }
      next();
    });

    // Default to latest version
    router.use((req, res, next) => {
      if (req.url.startsWith('/api/')) {
        // Default to v1
        const newUrl = req.url.replace(/^\/api/, '/api/v1');
        req.url = newUrl;
      }
      next();
    });

    return router;
  }

  // Deprecation headers
  deprecateVersion(version: string, sunsetDate: Date): void {
    const router = this.routers.get(version);
    if (router) {
      router.use((req, res, next) => {
        res.setHeader('Deprecation', 'true');
        res.setHeader('Sunset', sunsetDate.toUTCString());
        res.setHeader('Link', `<https://api.ifysora.com/api/v2>; rel="successor-version"`);
        next();
      });
    }
  }
}
