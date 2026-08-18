import { Link } from 'react-router-dom';
import PitcherMLMark from '@/components/brand/PitcherMLMark';

export default function Footer() {
  return (
    <footer
      style={{
        background: '#070a10',
        borderTop: '1px solid #1a2240',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <PitcherMLMark size={22} />
            <span className="text-sm font-bold" style={{ color: '#e8eaf0' }}>PitcherML</span>
          </Link>
          <p className="text-xs" style={{ color: '#2d3748' }}>
            © 2026 PitcherML. Free to try.
          </p>
        </div>
      </div>
    </footer>
  );
}
