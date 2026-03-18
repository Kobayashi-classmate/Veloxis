import { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
    children: ReactNode;
    title: string;
}

export default function Layout({ children, title }: LayoutProps) {
    const { user, logout } = useAuth();
    const location = useLocation();

    const getLinkStyle = (path: string) => ({
        color: location.pathname === path ? 'white' : '#9ca3af',
        textDecoration: 'none',
        padding: '0.5rem',
        borderRadius: '4px',
        background: location.pathname === path ? '#374151' : 'transparent',
        transition: 'background 0.2s, color 0.2s',
        display: 'block'
    });

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
            <aside style={{ width: '250px', background: '#1f2937', color: 'white', padding: '2rem 1rem', display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ marginBottom: '2rem', paddingLeft: '0.5rem' }}>Veloxis</h2>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <Link to="/" style={getLinkStyle('/')} aria-current={location.pathname === '/' ? 'page' : undefined}>
                        Dashboard
                    </Link>
                    <Link to="/data-sources" style={getLinkStyle('/data-sources')} aria-current={location.pathname === '/data-sources' ? 'page' : undefined}>
                        Data Sources
                    </Link>
                </nav>
            </aside>
            <main style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem 1.5rem', background: 'white', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#111827' }}>{title}</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <span style={{ color: '#4b5563', fontSize: '0.875rem' }}>
                            {user?.first_name || user?.email}
                        </span>
                        <button 
                            onClick={logout} 
                            style={{ padding: '0.5rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                            aria-label="Logout"
                        >
                            Logout
                        </button>
                    </div>
                </header>
                <div style={{ flex: 1, overflow: 'auto' }}>
                    {children}
                </div>
            </main>
        </div>
    );
}
