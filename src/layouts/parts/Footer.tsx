import { Link } from 'react-router-dom';

const footerLinks = {
  Product: ['Features', 'How It Works', 'Pricing', 'Changelog'],
  Company: ['About', 'Blog', 'Careers', 'Contact'],
  Legal: ['Privacy Policy', 'Terms of Service'],
};

export default function Footer() {
  return (
    <footer
      style={{
        background: '#070a10',
        borderTop: '1px solid #1a2240',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="inline-block mb-4">
              <img
                src="/airo-assets/images/logo/horizontal"
                alt="PitcherML"
                className="block h-auto max-h-8 w-auto max-w-full object-contain"
              />
            </Link>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: '#4a5568' }}>
              Broadcast-grade pitch analytics for coaches and players who demand precision.
            </p>
            {/* Social Icons */}
            <div className="flex gap-4 mt-6">
              {['X', 'IG', 'YT'].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="w-8 h-8 flex items-center justify-center text-xs font-bold transition-colors duration-150"
                  style={{
                    color: '#4a5568',
                    border: '1px solid #1a2240',
                    borderRadius: '3px',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = '#1d8cf8';
                    (e.currentTarget as HTMLElement).style.borderColor = '#1d8cf8';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = '#4a5568';
                    (e.currentTarget as HTMLElement).style.borderColor = '#1a2240';
                  }}
                  aria-label={s}
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4
                className="text-xs font-semibold uppercase tracking-widest mb-4"
                style={{ color: '#1d8cf8', letterSpacing: '0.12em' }}
              >
                {category}
              </h4>
              <ul className="flex flex-col gap-3">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm transition-colors duration-150"
                      style={{ color: '#4a5568' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#e8eaf0')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#4a5568')}
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid #1a2240' }}
        >
          <p className="text-xs" style={{ color: '#2d3748' }}>
            © 2026 PitcherML. All rights reserved.
          </p>
          <p className="text-xs font-mono" style={{ color: '#2d3748' }}>
            MLB-grade accuracy. Built for the game.
          </p>
        </div>
      </div>
    </footer>
  );
}
