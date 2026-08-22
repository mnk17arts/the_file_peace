import { Link } from 'react-router-dom';

const ToolCard = ({ title, description, icon: Icon, to, iconColor = "var(--primary-color)" }) => {
  return (
    <Link to={to} className="tool-card">
      <Icon style={{ fontSize: '3rem', color: iconColor, marginBottom: '1rem' }} />
      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>{title}</h3>
      <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem', lineHeight: '1.4' }}>
        {description}
      </p>
    </Link>
  );
};

export default ToolCard;