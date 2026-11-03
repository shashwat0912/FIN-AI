import { Router, Request, Response } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken, requireRole(['ADMIN']));

// Fixed read-only endpoints; operator credentials and approval never reach the browser.
for (const operation of ['investigate', 'deployment-review', 'cost-analysis']) {
  router.post(`/${operation}`, async (req: Request, res: Response): Promise<void> => {
    const base = process.env.AGENT_SERVICE_URL;
    const token = process.env.AGENT_API_TOKEN;
    if (!base || !token) {
      res.status(503).json({ success: false, message: 'Cloud Ops is disabled. Configure the optional agent service.', timestamp: new Date().toISOString() });
      return;
    }
    try {
      const target = new URL(`/api/v1/agent/${operation}`, base);
      if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
        throw new Error('Invalid internal service URL');
      }
      const upstream = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(70000),
        redirect: 'error',
      });
      if (!upstream.ok) {
        res.status(upstream.status === 422 ? 422 : 502).json({ success: false, message: upstream.status === 422 ? 'Invalid Cloud Ops request.' : 'Agent service is unavailable or authentication is misconfigured.', timestamp: new Date().toISOString() });
        return;
      }
      const body = await upstream.text();
      if (body.length > 300000) throw new Error('Agent response too large');
      res.json({ success: true, message: 'Cloud Ops assessment complete', data: JSON.parse(body), timestamp: new Date().toISOString() });
    } catch {
      res.status(502).json({ success: false, message: 'Could not contact the agent service.', timestamp: new Date().toISOString() });
    }
  });
}

export default router;
