import { Link } from 'react-router-dom';
import { FiArrowLeft, FiHelpCircle } from 'react-icons/fi';
import FaqSection from '../components/FaqSection';

export default function FaqPage() {
  return (
    <div className="faq-page-wrapper" style={{ maxWidth: '1050px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
      <div className="blog-nav-bar" style={{ marginBottom: '1.5rem' }}>
        <Link to="/" className="blog-back-link">
          <FiArrowLeft />
          <span>Back to Home</span>
        </Link>
        <nav className="blog-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span className="crumb-sep">/</span>
          <span className="crumb-current">FAQ</span>
        </nav>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div className="blog-hero-badge" style={{ marginBottom: '1rem' }}>
          <FiHelpCircle className="blog-hero-badge-icon" />
          <span>Help &amp; Answers</span>
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-color)', margin: '0 0 0.5rem 0' }}>
          Frequently Asked Questions
        </h1>
        <p style={{ fontSize: '1.05rem', color: 'var(--text-color)', opacity: 0.8, maxWidth: '650px', margin: '0 auto' }}>
          Everything you need to know about The File Peace, 100% in-browser document processing, and privacy guarantees.
        </p>
      </div>

      <FaqSection />
    </div>
  );
}
