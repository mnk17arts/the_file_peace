import favicon from "../assets/favicon.png"

const Logo = ({ size = 32 }) => {
  return (
    <div 
      style={{ 
        width: `${size}px`, 
        height: `${size}px`, 
        borderRadius: '7px', 
        overflow: 'hidden', 
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        backgroundColor: 'transparent'
      }}
    >
      <img 
        src={favicon} 
        alt="The File Peace Logo" 
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'contain',
          display: 'block' 
        }} 
      />
    </div>
  );
};

export default Logo;