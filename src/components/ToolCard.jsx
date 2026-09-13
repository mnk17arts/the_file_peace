import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';

const ToolCard = ({
  title,
  description,
  icon: Icon,
  to,
  iconColor = 'var(--primary-color)',
  category = null,
  badge = null
}) => {
  return (
    <Link to={to} className="tool-card" aria-label={`${title} - ${description}`}>
      <div className="tool-card-top">
        <div
          className="tool-card-icon-wrap"
          style={{
            backgroundColor: `color-mix(in srgb, ${iconColor} 12%, transparent)`,
            color: iconColor,
          }}
        >
          <Icon className="tool-icon" />
        </div>
        {badge && <span className="tool-card-badge">{badge}</span>}
      </div>

      <div className="tool-card-content">
        {category && <span className="tool-card-category">{category}</span>}
        <h3 className="tool-card-title">{title}</h3>
        <p className="tool-card-desc">{description}</p>
      </div>

      <div className="tool-card-footer">
        <span className="tool-card-action">
          Open Tool <FiArrowRight className="tool-arrow-icon" />
        </span>
      </div>
    </Link>
  );
};

export default ToolCard;