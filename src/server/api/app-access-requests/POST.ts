/**
 * POST /api/app-access-requests
 *
 * Captures an email from the landing page's "Request the app" form. Not
 * connected to TestFlight yet -- storing the email is the whole job right
 * now. Once there's an actual TestFlight link/tester-list process to wire
 * up, this is the endpoint to extend (either add the address as an
 * external tester via App Store Connect's API, or just redirect straight
 * to a public TestFlight link once one exists).
 */
import type { Request, Response } from 'express';
import { db } from '../../db/client.js';
import { appAccessRequests } from '../../db/schema.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: Request, res: Response) {
  try {
    const { email } = req.body as { email?: string };
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }

    await db.insert(appAccessRequests).values({ email: email.trim().toLowerCase() });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to save request', message: String(error) });
  }
}
