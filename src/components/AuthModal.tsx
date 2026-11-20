import React, { useEffect, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  Check,
  DollarSign,
  Eye,
  EyeOff,
  Layers,
  Lock,
  LogOut,
  Mail,
  Radio,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { PayoutSettings } from '../types/studio';
import { GatherLogo } from './GatherLogo';

interface AuthModalProps {
  open: boolean;
  user: User | null;
  payouts: PayoutSettings;
  onUpdatePayouts: (next: PayoutSettings) => void;
  onClose: () => void;
}

const GoogleGlyph: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

function mapFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const msg = err instanceof Error ? err.message : String(err || '');
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email or password did not match an account. Double-check and try again.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account already exists with this email. Switch to Sign in instead.';
  }
  if (code === 'auth/weak-password') {
    return 'Use a password with at least 6 characters.';
  }
  if (code === 'auth/invalid-email') {
    return 'Enter a valid email address.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Email & password sign-in must be enabled in Firebase Authentication -> Sign-in method.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Wait a moment and try again.';
  }
  if (msg.includes('popup-closed-by-user')) {
    return 'Sign-in popup was closed before completing.';
  }
  return msg || 'Unable to sign in right now.';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  user,
  payouts,
  onUpdatePayouts,
  onClose,
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [infoNotice, setInfoNotice] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  const [paypalHandle, setPaypalHandle] = useState(payouts.paypalHandle || '');
  const [venmoHandle, setVenmoHandle] = useState(payouts.venmoHandle || '');
  const [cashappTag, setCashappTag] = useState(payouts.cashappTag || '');
  const [stripeUrl, setStripeUrl] = useState(payouts.stripeUrl || '');

  useEffect(() => {
    setPaypalHandle(payouts.paypalHandle || '');
    setVenmoHandle(payouts.venmoHandle || '');
    setCashappTag(payouts.cashappTag || '');
    setStripeUrl(payouts.stripeUrl || '');
  }, [payouts]);

  useEffect(() => {
    if (!open) return;
    setError('');
    setInfoNotice('');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (authMode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    setError('');
    setInfoNotice('');
    try {
      if (authMode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const cleanName = fullName.trim().slice(0, 40);
        if (cleanName) {
          await updateProfile(cred.user, { displayName: cleanName });
        }
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      }
      onClose();
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordReset = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Enter your email address first to receive a password reset link.');
      return;
    }
    setBusy(true);
    setError('');
    setInfoNotice('');
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setInfoNotice(`Password reset link sent to ${cleanEmail}.`);
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setError('');
    setInfoNotice('');
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    setError('');
    try {
      await signOut(auth);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-out failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSavePayouts = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: PayoutSettings = {
      enabled: true,
      paypalHandle: paypalHandle.trim().replace(/^@/, '').slice(0, 60),
      venmoHandle: venmoHandle.trim().replace(/^@/, '').slice(0, 60),
      cashappTag: cashappTag.trim().replace(/^\$/, '').slice(0, 40),
      stripeUrl: stripeUrl.trim().slice(0, 240),
    };
    onUpdatePayouts(next);

    if (user) {
      setBusy(true);
      const userPath = `users/${user.uid}`;
      try {
        const userRef = doc(db, 'users', user.uid);
        const existingSnap = await getDoc(userRef);
        const sharedFields = {
          displayName: (user.displayName || 'Creator').slice(0, 40),
          email: (user.email || '').slice(0, 120),
          photoURL: (user.photoURL || '').slice(0, 500),
          paypalHandle: next.paypalHandle || '',
          venmoHandle: next.venmoHandle || '',
          cashappTag: next.cashappTag || '',
          stripeUrl: next.stripeUrl || '',
          updatedAt: serverTimestamp(),
        };
        if (existingSnap.exists()) {
          await updateDoc(userRef, sharedFields);
        } else {
          await setDoc(userRef, {
            uid: user.uid,
            ...sharedFields,
            createdAt: serverTimestamp(),
          });
        }
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 2200);
      } catch (err) {
        const rawMsg = err instanceof Error ? err.message : String(err);
        try {
          handleFirestoreError(err, OperationType.WRITE, userPath);
        } catch {
          if (rawMsg.includes('api-key-not-valid')) {
            setError(
              'Saved locally. Cloud sync failed because the Firebase API key is invalid or restricted.'
            );
          } else if (rawMsg.includes('the client is offline')) {
            setError(
              'Saved locally. Could not reach Cloud Firestore (check Firebase configuration or network).'
            );
          } else {
            setError('Saved locally; verify email or sign in with Google to sync cloud profile.');
          }
        }
      } finally {
        setBusy(false);
      }
    } else {
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    }
  };

  const inputCls =
    'w-full h-9 px-3 rounded-[8px] bg-[var(--fill)] border border-[var(--line-2)] text-xs text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)] transition-colors';

  const providerLabel = user?.providerData?.some((p) => p.providerId === 'google.com')
    ? 'Google account synced'
    : 'Email account synced';

  return (
    <div
      className="fixed inset-0 z-50 gather-lightbox-scrim flex items-center justify-center p-4 animate-gather-backdrop"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full rounded-[16px] gather-glass-elevated overflow-hidden animate-gather-modal ${
          user ? 'max-w-[500px]' : 'max-w-[820px]'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close account modal"
          className="absolute top-4 right-4 z-10 h-8 w-8 grid place-items-center rounded-[8px] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-hover)] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {!user ? (
          <div className="grid grid-cols-1 md:grid-cols-[270px_minmax(0,1fr)]">
            <div
              className="hidden md:flex flex-col justify-between gap-6 p-7 border-r border-[var(--line)]"
              style={{
                background:
                  'radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 62%), var(--surface-2)',
              }}
            >
              <div className="space-y-4">
                <GatherLogo size={40} />
                <h3 className="font-display text-[20px] font-medium leading-snug tracking-[-0.02em] text-[var(--ink)]">
                  Your studio, synced everywhere.
                </h3>
                <ul className="space-y-3 text-[13px] text-[var(--ink-2)]">
                  <li className="flex items-center gap-2.5">
                    <Radio className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
                    <span>Save camera look &amp; stage presets</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <DollarSign className="w-4 h-4 text-[var(--ok)] shrink-0" />
                    <span>Direct 0%-fee PayPal &amp; Venmo tips</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
                    <span>Sync Shopify &amp; Etsy live drops</span>
                  </li>
                </ul>
              </div>
              <p className="text-xs text-[var(--ink-3)]">
                100% Free · Made in Texas
              </p>
            </div>

            <div className="p-6 sm:p-7 flex flex-col justify-center gap-4">
              <div className="space-y-1.5 pr-8">
                <div className="md:hidden mb-2">
                  <GatherLogo size={32} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-[21px] font-medium tracking-[-0.025em] text-[var(--ink)]">
                    {authMode === 'signin' ? 'Sign in to gather.' : 'Create your account.'}
                  </h2>
                </div>
                <p className="text-[12.5px] leading-relaxed text-[var(--ink-2)]">
                  {authMode === 'signin'
                    ? 'Sign in with email or Google to sync your brand kits, stage presets, and direct payout handles.'
                    : 'Create a free Gather creator account to save kits, custom scenes, and broadcast settings.'}
                </p>
              </div>

              {/* Sign In / Create Account Mode Switcher */}
              <div
                className="gather-seg grid grid-cols-2 w-full"
                role="tablist"
                aria-label="Account mode"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'signin'}
                  onClick={() => {
                    setAuthMode('signin');
                    setError('');
                    setInfoNotice('');
                  }}
                  className={`gather-seg-btn h-8 text-[12px] ${authMode === 'signin' ? 'active' : ''}`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'signup'}
                  onClick={() => {
                    setAuthMode('signup');
                    setError('');
                    setInfoNotice('');
                  }}
                  className={`gather-seg-btn h-8 text-[12px] ${authMode === 'signup' ? 'active' : ''}`}
                >
                  Create account
                </button>
              </div>

              <form onSubmit={handleEmailAuthSubmit} className="space-y-2.5">
                {authMode === 'signup' && (
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-[var(--ink-2)]">Display name</span>
                    <div className="relative">
                      <UserIcon className="w-3.5 h-3.5 text-[var(--ink-3)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="How viewers see you"
                        autoComplete="name"
                        maxLength={40}
                        className={`${inputCls} pl-8`}
                      />
                    </div>
                  </label>
                )}

                <label className="block space-y-1">
                  <span className="text-[11px] font-medium text-[var(--ink-2)]">Email address</span>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-[var(--ink-3)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@studio.com"
                      autoComplete="email"
                      className={`${inputCls} pl-8`}
                    />
                  </div>
                </label>

                <label className="block space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[var(--ink-2)]">Password</span>
                    {authMode === 'signin' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handlePasswordReset()}
                        className="text-[11px] font-medium text-[var(--accent-text)] hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-[var(--ink-3)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={authMode === 'signup' ? 'At least 6 characters' : 'Your password'}
                      autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                      className={`${inputCls} pl-8 pr-9`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full h-10 rounded-[10px] gather-btn-primary text-[13px] font-semibold inline-flex items-center justify-center transition-all cursor-pointer disabled:opacity-60"
                >
                  {busy
                    ? authMode === 'signup'
                      ? 'Creating account…'
                      : 'Signing in…'
                    : authMode === 'signup'
                    ? 'Create account'
                    : 'Sign in'}
                </button>
              </form>

              <div className="relative flex items-center gap-3 text-[11px] text-[var(--ink-3)]">
                <span className="h-px flex-1 bg-[var(--line)]" />
                <span>or</span>
                <span className="h-px flex-1 bg-[var(--line)]" />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleGoogleSignIn}
                className="w-full h-10 px-4 rounded-[10px] bg-white hover:bg-[#f8faff] text-[#1f1f1f] border border-[#dadce0] shadow-sm text-[13.5px] font-medium inline-flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <GoogleGlyph />
                <span>Continue with Google</span>
              </button>

              {error && <p className="text-xs text-[var(--danger)] leading-relaxed">{error}</p>}
              {infoNotice && <p className="text-xs text-[var(--ok)] leading-relaxed">{infoNotice}</p>}

              <div className="pt-3 border-t border-[var(--line)] space-y-2 text-xs text-[var(--ink-3)]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[var(--ok)] shrink-0" />
                  <span>Viewers tip your PayPal, Venmo, or Cash App directly — 0% cut.</span>
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <span>Just testing or joining a room?</span>
                  <button
                    type="button"
                    onClick={onClose}
                    className="font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
                  >
                    Continue as guest
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Signed-in Creator Profile & Direct Super Chat Payouts */
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-2.5 pr-8 pb-4 border-b border-[var(--line)]">
              <GatherLogo size={26} />
              <div>
                <h2 className="font-display text-[16px] font-medium text-[var(--ink)] leading-tight">
                  Creator Account &amp; Payouts
                </h2>
                <p className="text-[11px] text-[var(--ink-3)] mt-0.5">
                  {providerLabel} · Direct 0%-fee Super Chats
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[var(--line)]">
              <div className="flex items-center gap-3 min-w-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Creator'}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-full object-cover border border-[var(--line-2)] shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-[var(--accent)] text-white font-display font-medium grid place-items-center shrink-0">
                    {(user.displayName || 'G')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium text-[var(--ink)] truncate">
                    {user.displayName || 'Gather Creator'}
                  </div>
                  <div className="text-[11px] text-[var(--ink-3)] truncate">{user.email}</div>
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleSignOut}
                className="h-8 px-3 rounded-[8px] bg-[var(--fill)] hover:bg-[var(--live)] hover:text-white border border-[var(--line-2)] text-xs font-semibold text-[var(--ink-2)] inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>

            <form onSubmit={handleSavePayouts} className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--ink)] inline-flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-[var(--ok)]" />
                  <span>Direct Super Chat Handles</span>
                </span>
                <span className="text-[11px] text-[var(--ink-3)]">0% platform fee</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="space-y-1">
                  <span className="text-[11px] text-[var(--ink-3)]">PayPal.me username</span>
                  <input
                    type="text"
                    value={paypalHandle}
                    onChange={(e) => setPaypalHandle(e.target.value)}
                    placeholder="yourhandle"
                    className={inputCls}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-[var(--ink-3)]">Venmo @username</span>
                  <input
                    type="text"
                    value={venmoHandle}
                    onChange={(e) => setVenmoHandle(e.target.value)}
                    placeholder="your-venmo"
                    className={inputCls}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="space-y-1">
                  <span className="text-[11px] text-[var(--ink-3)]">Cash App $cashtag</span>
                  <input
                    type="text"
                    value={cashappTag}
                    onChange={(e) => setCashappTag(e.target.value)}
                    placeholder="YourCashtag"
                    className={inputCls}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-[var(--ink-3)]">Stripe / Tip URL</span>
                  <input
                    type="url"
                    value={stripeUrl}
                    onChange={(e) => setStripeUrl(e.target.value)}
                    placeholder="https://buy.stripe.com/..."
                    className={inputCls}
                  />
                </label>
              </div>

              {error && <p className="text-[11px] text-[var(--danger)]">{error}</p>}

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[var(--ok)] font-medium">
                  {savedNotice ? (
                    <span className="inline-flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Payout handles saved
                    </span>
                  ) : (
                    ''
                  )}
                </span>
                <button
                  type="submit"
                  disabled={busy}
                  className="h-9 px-4 rounded-[8px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  Save payout handles
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
