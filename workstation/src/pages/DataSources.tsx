import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { directus } from '../lib/directus';
import { readItems, createItem, uploadFiles } from '@directus/sdk';

export default function DataSources() {
    const [datasets, setDatasets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [projectName, setProjectName] = useState('Default Project');
    const [datasetName, setDatasetName] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const loadDatasets = useCallback(async () => {
        try {
            setLoading(true);
            const result = await directus.request(readItems('datasets', { 
                fields: ['id', 'name', 'type', 'status', 'project_id.name', 'date_created'] 
            }));
            setDatasets(result as any[]);
        } catch (error) {
            console.error('Failed to load datasets:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDatasets();
    }, [loadDatasets]);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !datasetName) return;

        try {
            setUploading(true);
            
            // 1. Upload File
            const formData = new FormData();
            formData.append('title', file.name);
            formData.append('file', file);
            // Ignore type error for now due to complex Directus SDK generic inferences
            const fileRes = await directus.request(uploadFiles(formData) as any);

            // 2. Ensure Project exists (Normally we'd have a project selector, but we simplify here)
            // Just create a new project for the demo, or query if it exists.
            const projRes = await directus.request(createItem('projects', { name: projectName }));

            // 3. Create Dataset
            const dsRes = await directus.request(createItem('datasets', {
                name: datasetName,
                project_id: projRes.id,
                type: 'csv',
                status: 'draft'
            }));

            // 4. Create Dataset Version (Triggers the Webhook to Data Worker)
            await directus.request(createItem('dataset_versions', {
                dataset_id: dsRes.id,
                version_name: 'v1.0',
                file_id: fileRes.id,
                status: 'processing'
            }));

            setIsModalOpen(false);
            setFile(null);
            setDatasetName('');
            loadDatasets(); // Refresh list

        } catch (error: any) {
            console.error('Upload flow failed:', error);
            alert(`Upload failed: ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    return (
        <Layout title="Data Sources">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                >
                    + New Dataset
                </button>
            </div>

            {/* Datasets Table */}
            <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading datasets...</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }} role="table" aria-label="Datasets">
                        <thead>
                            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                <th style={{ padding: '1rem', fontWeight: 500, color: '#374151' }}>Name</th>
                                <th style={{ padding: '1rem', fontWeight: 500, color: '#374151' }}>Project</th>
                                <th style={{ padding: '1rem', fontWeight: 500, color: '#374151' }}>Type</th>
                                <th style={{ padding: '1rem', fontWeight: 500, color: '#374151' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {datasets.map((ds) => (
                                <tr key={ds.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '1rem', color: '#111827' }}>{ds.name}</td>
                                    <td style={{ padding: '1rem', color: '#4b5563' }}>{ds.project_id?.name || 'Unknown'}</td>
                                    <td style={{ padding: '1rem', color: '#4b5563' }}>{ds.type}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{ 
                                            display: 'inline-block', 
                                            padding: '0.25rem 0.5rem', 
                                            borderRadius: '9999px', 
                                            fontSize: '0.75rem',
                                            fontWeight: 500,
                                            background: ds.status === 'ready' ? '#d1fae5' : '#fef3c7',
                                            color: ds.status === 'ready' ? '#065f46' : '#92400e'
                                        }}>
                                            {ds.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {datasets.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                                        No datasets found. Create one to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Simple Modal */}
            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50 }}>
                    <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#111827' }}>Upload New Dataset</h2>
                        <form onSubmit={handleUpload}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>Project Name</label>
                                <input required type="text" value={projectName} onChange={e => setProjectName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }} />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>Dataset Name</label>
                                <input required type="text" value={datasetName} onChange={e => setDatasetName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }} />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>CSV File</label>
                                <input required type="file" accept=".csv" onChange={e => setFile(e.target.files?.[0] || null)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', background: '#f9fafb' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: '6px', cursor: 'pointer' }} disabled={uploading}>Cancel</button>
                                <button type="submit" style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: uploading ? 0.7 : 1 }} disabled={uploading}>
                                    {uploading ? 'Uploading...' : 'Upload & Process'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
}
