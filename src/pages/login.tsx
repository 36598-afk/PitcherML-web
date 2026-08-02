import { useState } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signIn } from '@/lib/auth/auth-client';
import { motion } from 'motion/react';
import { login } from 'virtual:content';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/players';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message || 'Invalid email or password.');
      } else {
        navigate(from, { replace: true });
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>{login.meta.title}</title>
        <meta name="description" content={login.meta.description} />
        <link rel="canonical" href="https://pitcherml.com/login" />
        <meta name="robots" content="noindex" />
      </Helmet>
      <main
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: '#0a0d14' }}
      >
        {/* Radial glow */}
        <div
          className="pointer-events-none fixed inset-0"
          style={{
            background: 'radial-gradient(ellipse 60% 40% at 50% 30%, rgba(29,140,248,0.08) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' as const }}
          className="w-full max-w-md"
        >
          {/* Logo / wordmark */}
          <div className="mb-8 text-center">
            <Link to="/" className="inline-block">
              <span
                className="text-2xl font-black tracking-tight"
                style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}
              >
                Pitcher<span style={{ color: '#1d8cf8' }}>ML</span>
              </span>
            </Link>
          </div>

          <div
            className="rounded-lg p-8"
            style={{ background: '#0f1420', border: '1px solid #1a2240' }}
          >
            <h1
              className="text-2xl font-bold mb-1"
              style={{ fontFamily: 'var(--font-heading)', color: '#e8eaf0' }}
            >
              {login.heading}
            </h1>
            <p className="text-sm mb-6" style={{ color: '#6b7a99' }}>
              {login.subheading}
            </p>

            {error && (
              <div
                className="mb-4 px-4 py-3 rounded text-sm"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                  style={{ color: '#6b7a99' }}
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded text-sm outline-none transition-all"
                  style={{
                    background: '#0a0d14',
                    border: '1px solid #1a2240',
                    color: '#e8eaf0',
                    fontFamily: 'var(--font-sans)',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#1d8cf8')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#1a2240')}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                  style={{ color: '#6b7a99' }}
                >
                  {login.passwordLabel}
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded text-sm outline-none transition-all"
                  style={{
                    background: '#0a0d14',
                    border: '1px solid #1a2240',
                    color: '#e8eaf0',
                    fontFamily: 'var(--font-sans)',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#1d8cf8')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#1a2240')}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded text-sm font-semibold transition-all duration-150 mt-2 disabled:opacity-60"
                style={{
                  background: '#1d8cf8',
                  color: '#ffffff',
                  fontFamily: 'var(--font-sans)',
                  boxShadow: '0 0 20px rgba(29,140,248,0.3)',
                }}
                onMouseEnter={(e) => !loading && ((e.currentTarget as HTMLElement).style.background = '#3a9ef9')}
                onMouseLeave={(e) => !loading && ((e.currentTarget as HTMLElement).style.background = '#1d8cf8')}
              >
                {loading ? login.submitLoading : login.submitIdle}
              </button>
            </form>

            <p className="mt-6 text-center text-sm" style={{ color: '#6b7a99' }}>
              {login.noAccount}{' '}
              <Link to="/signup" className="font-semibold" style={{ color: '#1d8cf8' }}>
                {login.signUpLink}
              </Link>
            </p>
          </div>
        </motion.div>
      </main>
    </>
  );
}
