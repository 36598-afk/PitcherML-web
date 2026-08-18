import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import PitcherMLMark from '@/components/brand/PitcherMLMark';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-200"
      style={{
        background: scrolled
          ? 'rgba(10, 13, 20, 0.97)'
          : 'rgba(10, 13, 20, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: scrolled ? '1px solid rgba(26, 34, 64, 0.8)' : '1px solid transparent',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 min-w-0">
          <PitcherMLMark size={26} />
          <span className="text-[1.05rem] font-bold tracking-[-0.01em]" style={{ color: '#e8eaf0', fontFamily: 'var(--font-sans)' }}>
            PitcherML
          </span>
        </Link>

        {/* Desktop CTA -- login/signup only, per request */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            to="/login"
            className="text-sm font-medium transition-colors duration-150"
            style={{ color: '#6b7a99', fontFamily: 'var(--font-sans)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#e8eaf0')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7a99')}
          >
            Log In
          </Link>
          <Link
            to="/signup"
            className="text-sm font-semibold px-5 py-2 transition-all duration-150"
            style={{
              background: '#1d8cf8',
              color: '#ffffff',
              fontFamily: 'var(--font-sans)',
              borderRadius: '3px',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#3a9ef9';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#1d8cf8';
            }}
          >
            Sign Up Free
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden p-2 transition-colors"
          style={{ color: '#6b7a99' }}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Menu -- login/signup only, per request */}
      {mobileOpen && (
        <div
          className="md:hidden border-t"
          style={{
            background: 'rgba(10, 13, 20, 0.98)',
            borderColor: '#1a2240',
          }}
        >
          <nav aria-label="Mobile navigation" className="flex flex-col px-6 py-4 gap-4">
            <Link
              to="/login"
              className="text-sm font-medium py-2"
              style={{ color: '#6b7a99', fontFamily: 'var(--font-sans)' }}
              onClick={() => setMobileOpen(false)}
            >
              Log In
            </Link>
            <Link
              to="/signup"
              className="text-sm font-semibold px-5 py-2.5 text-center mt-2"
              style={{
                background: '#1d8cf8',
                color: '#ffffff',
                fontFamily: 'var(--font-sans)',
                borderRadius: '3px',
              }}
              onClick={() => setMobileOpen(false)}
            >
              Sign Up Free
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
