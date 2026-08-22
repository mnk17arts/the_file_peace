const Footer = () => {
    return (
      <footer style={styles.footer}>
        <p>&copy; {new Date().getFullYear()} The File Peace. All processing is done locally on your device.</p>
      </footer>
    );
  };
  
  const styles = {
    footer: {
      textAlign: 'center',
      padding: '1.5rem',
      backgroundColor: 'var(--card-bg)',
      borderTop: '1px solid var(--border-color)',
      marginTop: 'auto',
      fontSize: '0.9rem',
    },
  };
  
  export default Footer;