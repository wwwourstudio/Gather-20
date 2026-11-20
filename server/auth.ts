import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedProjectId: string | null = null;

function getFirebaseProjectId(): string | null {
  if (cachedProjectId !== null) return cachedProjectId;
  try {
    const cfgPath = path.resolve(__dirname, '..', 'firebase-applet-config.json');
    if (!fs.existsSync(cfgPath)) return null;
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as { projectId?: string };
    if (raw.projectId && !raw.projectId.includes('remixed')) {
      cachedProjectId = raw.projectId;
      return cachedProjectId;
    }
  } catch {
    // ignore invalid config
  }
  return null;
}

// firebase-admin is imported lazily: its auth module pulls in jwks-rsa, which require()s an
// ESM-only package and crashes some serverless runtimes at cold start. Loading it on first
// use keeps every other /api route working even where token verification is unavailable.
async function getAdminAuth() {
  const projectId = getFirebaseProjectId();
  if (!projectId) return null;
  try {
    const [{ getApp, getApps, initializeApp }, { getAuth }] = await Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/auth'),
    ]);
    const app = getApps().length ? getApp() : initializeApp({ projectId });
    return getAuth(app);
  } catch (err) {
    console.warn('firebase-admin unavailable; ID tokens will not be verified.', err);
    return null;
  }
}

export interface VerifiedTokenIdentity {
  uid: string;
  email?: string;
  emailVerified: boolean;
}

/**
 * Verifies a Firebase ID token cryptographically using firebase-admin/auth.
 * Note: verifyIdToken(token) without checkRevoked requires no IAM grants and works on all tiers.
 */
export async function verifyFirebaseIdToken(
  token: string | undefined | null
): Promise<VerifiedTokenIdentity | null> {
  if (!token || typeof token !== 'string' || token.length < 20) return null;
  const adminAuth = await getAdminAuth();
  if (!adminAuth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: typeof decoded.email === 'string' ? decoded.email : undefined,
      emailVerified: Boolean(decoded.email_verified),
    };
  } catch {
    return null;
  }
}
