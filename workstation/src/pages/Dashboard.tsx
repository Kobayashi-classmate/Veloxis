import { useAuth } from '../contexts/AuthContext';
import { useCubeQuery } from '@cubejs-client/react';

export default function Dashboard() {
    const { user, logout } = useAuth();
    
    // Example query using our ExcelData cube
    // Make sure 'ExcelData.count' exists in your cube schema
    const { resultSet, isLoading, error } = useCubeQuery({
        measures: ['ExcelData.count']
    });

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5' }}>
            <aside style={{ width: '250px', background: '#1f2937', color: 'white', padding: '2rem 1rem' }}>
                <h2 style={{ marginBottom: '2rem' }}>Veloxis</h2>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <a href="#" style={{ color: 'white', textDecoration: 'none' }}>Dashboard</a>
                    <a href="#" style={{ color: '#9ca3af', textDecoration: 'none' }}>Data Sources</a>
                    <a href="#" style={{ color: '#9ca3af', textDecoration: 'none' }}>Pipelines</a>
                    <a href="#" style={{ color: '#9ca3af', textDecoration: 'none' }}>Settings</a>
                </nav>
            </aside>
            <main style={{ flex: 1, padding: '2rem' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#333' }}>Dashboard</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span>Welcome, {user?.first_name || user?.email}</span>
                        <button onClick={logout} style={{ padding: '0.5rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
                    </div>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: '#6b7280' }}>Total Uploaded Records</h3>
                        {isLoading && <div>Loading data...</div>}
                        {error && <div style={{ color: 'red' }}>Error: {error.toString()}</div>}
                        {resultSet && (
                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#111827' }}>
                                {resultSet.series()[0]?.series[0]?.value || 0}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
