import { useCubeQuery } from '@cubejs-client/react';
import Layout from '../components/Layout';

export default function Dashboard() {
    // Example query using our ExcelData cube
    // Make sure 'ExcelData.count' exists in your cube schema
    const { resultSet, isLoading, error } = useCubeQuery({
        measures: ['ExcelData.count']
    });

    return (
        <Layout title="Dashboard">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ margin: '0 0 1rem 0', color: '#6b7280', fontSize: '1rem', fontWeight: 500 }}>Total Uploaded Records</h3>
                    {isLoading && <div style={{ color: '#9ca3af' }}>Loading data...</div>}
                    {error && <div style={{ color: '#ef4444' }}>Error: {error.toString()}</div>}
                    {resultSet && (
                        <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#111827' }}>
                            {resultSet.series()[0]?.series[0]?.value || 0}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
