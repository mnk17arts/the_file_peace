import { Link } from 'react-router-dom';
import Logo from './Logo';
import {
  FiGithub,
  FiLinkedin,
  FiArrowUp,
  FiShield,
  FiAlertCircle,
  FiArrowRight,
  FiHeart
} from 'react-icons/fi';

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-container">
        {/* Main Columns Grid */}
        <div className="footer-grid">
          {/* Brand & Mission Column */}
          <div className="footer-brand-col">
            <Link to="/" className="footer-logo">
              <Logo size={32} />
              <span className="footer-logo-text">The File Peace</span>
            </Link>

            <p className="footer-mission-text">
              The private, offline-first document and media utility suite. Process PDFs, images, and videos
              directly in your browser with zero server uploads and zero tracking.
            </p>

            <div className="footer-privacy-badge">
              <FiShield className="footer-privacy-icon" />
              <span>100% Client-Side • In-Memory Processing</span>
            </div>

            {/* Bug Report / Feedback Card */}
            <div className="footer-issue-card">
              <div className="footer-issue-header">
                <FiAlertCircle className="footer-issue-icon" />
                <span className="footer-issue-title">Found a bug or need a tool?</span>
              </div>
              <p className="footer-issue-desc">
                We are actively building new features. Share your feedback directly on GitHub.
              </p>
              <a
                href="https://github.com/mnk17arts/the_file_peace/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-issue-btn"
              >
                <span>Report an Issue</span>
                <FiArrowRight />
              </a>
            </div>
          </div>

          {/* Column 1: PDF Utilities */}
          <div className="footer-nav-col">
            <h4 className="footer-col-title">PDF Utilities</h4>
            <ul className="footer-nav-list">
              <li><Link to="/chat-pdf">Chat with PDF (AI)</Link></li>
              <li><Link to="/merge-pdf">Merge PDF</Link></li>
              <li><Link to="/split-pdf">Split PDF</Link></li>
              <li><Link to="/compress-pdf">Compress PDF</Link></li>
              <li><Link to="/organize-pdf">Organize Pages</Link></li>
              <li><Link to="/crop-pdf">Crop PDF</Link></li>
              <li><Link to="/rotate-pdf">Rotate PDF</Link></li>
              <li><Link to="/flip-pdf">Flip & Mirror PDF</Link></li>
              <li><Link to="/invert-pdf">Dark Mode (Invert)</Link></li>
              <li><Link to="/pdf-to-docx">PDF to Word (DOCX)</Link></li>
              <li><Link to="/pdf-to-text">PDF to Text (TXT)</Link></li>
              <li><Link to="/pdf-reader">Read PDF</Link></li>
            </ul>
          </div>

          {/* Column 2: Security & Privacy */}
          <div className="footer-nav-col">
            <h4 className="footer-col-title">Security & Privacy</h4>
            <ul className="footer-nav-list">
              <li><Link to="/redact-pdf">Redact PDF</Link></li>
              <li><Link to="/pdf-metadata">PDF Metadata Scrub</Link></li>
              <li><Link to="/strip-exif">Strip Image EXIF</Link></li>
              <li><Link to="/file-hash">File Hash & Verifier</Link></li>
              <li><Link to="/edit-pdf">Edit & Annotate PDF</Link></li>
              <li><Link to="/protect-pdf">Protect PDF (Encrypt)</Link></li>
              <li><Link to="/unlock-pdf">Unlock PDF (Decrypt)</Link></li>
              <li><Link to="/flatten-pdf">Flatten PDF</Link></li>
              <li><Link to="/compare-pdf">Compare PDF</Link></li>
              <li><Link to="/add-watermark">Add Watermark</Link></li>
              <li><Link to="/page-numbers">Page Numbers</Link></li>
            </ul>
          </div>

          {/* Column 3: Media, Archives & Sharing */}
          <div className="footer-nav-col">
            <h4 className="footer-col-title">Media & Archives</h4>
            <ul className="footer-nav-list">
              <li><Link to="/zip-tools">ZIP Studio</Link></li>
              <li><Link to="/qr-tools">QR Code Studio</Link></li>
              <li><Link to="/p2p-share">P2P File Transfer</Link></li>
              <li><Link to="/workflow-builder">Workflow Builder</Link></li>
              <li><Link to="/add-audio-to-video">Add Audio to Video</Link></li>
              <li><Link to="/transcribe-audio">Speech Transcriber</Link></li>
              <li><Link to="/text-to-handwriting">Text to Handwriting</Link></li>
              <li><Link to="/summarize-pdf">AI PDF Summarizer</Link></li>
              <li><Link to="/translate-pdf">AI PDF Translator</Link></li>
              <li><Link to="/edit-image">Edit Image Studio</Link></li>
              <li><Link to="/crop-image">Crop Image</Link></li>
              <li><Link to="/compress-image">Compress Image</Link></li>
              <li><Link to="/convert-image">Convert Image</Link></li>
              <li><Link to="/extract-audio">Extract Audio from Video</Link></li>
              <li><Link to="/audio-tools">Audio Converter & Trimmer</Link></li>
              <li><Link to="/compress-video">Compress Video</Link></li>
              <li><Link to="/image-to-pdf">Image to PDF</Link></li>
              <li><Link to="/pdf-to-image">PDF to Image</Link></li>
              <li><Link to="/text-to-pdf">Text & Code to PDF</Link></li>
            </ul>
          </div>

          {/* Column 4: Quick Links & Resources */}
          <div className="footer-nav-col">
            <h4 className="footer-col-title">Resources</h4>
            <ul className="footer-nav-list">
              <li><Link to="/blog">Blog & Tool Guides</Link></li>
              <li><Link to="/changelog">Release Changelog (v2.0)</Link></li>
              <li><Link to="/faq">Frequently Asked Questions</Link></li>
              <li>
                <a
                  href="https://github.com/mnk17arts/the_file_peace"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub Repository
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/mnk17arts/the_file_peace/blob/main/LICENSE"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  License (MIT)
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/mnk17arts/the_file_peace#readme"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Documentation
                </a>
              </li>
            </ul>

            {/* Social Links */}
            <div className="footer-social-row">
              <a
                href="https://github.com/mnk17arts"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-link"
                title="GitHub Profile"
                aria-label="GitHub Profile"
              >
                <FiGithub />
              </a>
              <a
                href="https://linkedin.com/in/mnk17arts"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-link"
                title="LinkedIn Profile"
                aria-label="LinkedIn Profile"
              >
                <FiLinkedin />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Sub-Bar */}
        <div className="footer-bottom-bar">
          <div className="footer-copyright">
            © {currentYear} The File Peace. Built with <FiHeart className="footer-heart-icon" /> for private file workflows.
          </div>

          <div className="footer-attribution">
            Developed by{' '}
            <a
              href="https://linkedin.com/in/mnk17arts"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-author-link"
            >
              @mnk17arts
            </a>
          </div>

          <button
            onClick={scrollToTop}
            className="footer-scroll-top-btn"
            title="Scroll to top"
            aria-label="Scroll to top"
          >
            <FiArrowUp />
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;