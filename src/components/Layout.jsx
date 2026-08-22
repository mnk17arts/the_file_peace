import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

const Layout = () => {
  return (
    <div style={styles.container}>
      <Navbar />
      <main style={styles.main}>
        <Outlet /> {/* Page content renders here */}
      </main>
      <Footer />
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh', /* Forces footer to the bottom */
  },
  main: {
    flex: 1,
    padding: '2rem',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  },
};

export default Layout;