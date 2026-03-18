import { useState, useMemo } from 'react';
import { useCubeQuery, useCubeMeta } from '@cubejs-client/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import Layout from '../components/Layout';
import { useProject } from '../contexts/ProjectContext';
import { BarChart2, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

export default function Dashboard() {
    const { activeProject } = useProject();
    const { meta, isLoading: metaLoading } = useCubeMeta();
    
    const [selectedCube, setSelectedCube] = useState<string>('');
    const [selectedMeasure, setSelectedMeasure] = useState<string>('');
    const [selectedDimension, setSelectedDimension] = useState<string>('');
    const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');

    // Extract available cubes
    const cubes = useMemo(() => {
        if (!meta) return [];
        return meta.cubes().map(c => ({
            name: c.name,
            title: c.title,
            measures: c.measures,
            dimensions: c.dimensions
        }));
    }, [meta]);

    // Update available options when cube changes
    const activeCubeObj = cubes.find(c => c.name === selectedCube);

    const query = useMemo(() => {
        if (!selectedMeasure) return null;
        
        const q: any = { measures: [selectedMeasure] };
        if (selectedDimension) {
            q.dimensions = [selectedDimension];
        }
        return q;
    }, [selectedMeasure, selectedDimension]);

    const { resultSet, isLoading: queryLoading, error } = useCubeQuery(query, {
        skip: !query || !activeProject
    });

    const chartData = useMemo(() => {
        if (!resultSet) return [];
        
        return resultSet.series().reduce((acc: any[], series) => {
            series.series.forEach((s, idx) => {
                if (!acc[idx]) {
                    // Extract dimension label (usually X axis)
                    const label = s.x || 'Total';
                    acc[idx] = { name: label };
                }
                // Extract measure value (Y axis)
                acc[idx][series.title] = s.value;
            });
            return acc;
        }, []);
    }, [resultSet]);

    const measureTitle = activeCubeObj?.measures.find(m => m.name === selectedMeasure)?.shortTitle || 'Value';

    const renderChart = () => {
        if (!resultSet || chartData.length === 0) return null;

        if (chartType === 'bar') {
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280'}} />
                        <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
                        <Legend />
                        <Bar dataKey={resultSet.series()[0].title} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            );
        }

        if (chartType === 'line') {
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280'}} />
                        <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
                        <Legend />
                        <Line type="monotone" dataKey={resultSet.series()[0].title} stroke="#10b981" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                    </LineChart>
                </ResponsiveContainer>
            );
        }

        if (chartType === 'pie') {
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                        <Pie data={chartData} dataKey={resultSet.series()[0].title} nameKey="name" cx="50%" cy="50%" outerRadius={150} label>
                            {chartData.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            );
        }
    };

    return (
        <Layout title="Dynamic Dashboard">
            {!activeProject ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280', background: 'white', borderRadius: '8px' }}>
                    <h2>Welcome to Veloxis</h2>
                    <p>Please select a project from the top navigation to begin analyzing your data.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: '2rem', height: '100%', flexDirection: 'column' }}>
                    
                    {/* Controls Panel */}
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', gap: '2rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        
                        <div style={{ flex: '1 1 200px' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>Select Dataset (Cube)</label>
                            <select 
                                value={selectedCube} 
                                onChange={(e) => {
                                    setSelectedCube(e.target.value);
                                    setSelectedMeasure('');
                                    setSelectedDimension('');
                                }}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: 'white' }}
                            >
                                <option value="">-- Select a Cube --</option>
                                {cubes.map(c => <option key={c.name} value={c.name}>{c.title}</option>)}
                            </select>
                        </div>

                        <div style={{ flex: '1 1 200px' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>Select Measure (Y-Axis)</label>
                            <select 
                                value={selectedMeasure} 
                                onChange={(e) => setSelectedMeasure(e.target.value)}
                                disabled={!selectedCube}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: !selectedCube ? '#f3f4f6' : 'white' }}
                            >
                                <option value="">-- Select a Measure --</option>
                                {activeCubeObj?.measures.map(m => <option key={m.name} value={m.name}>{m.title}</option>)}
                            </select>
                        </div>

                        <div style={{ flex: '1 1 200px' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>Select Dimension (X-Axis/Group)</label>
                            <select 
                                value={selectedDimension} 
                                onChange={(e) => setSelectedDimension(e.target.value)}
                                disabled={!selectedCube}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', background: !selectedCube ? '#f3f4f6' : 'white' }}
                            >
                                <option value="">-- None (Total) --</option>
                                {activeCubeObj?.dimensions.map(d => <option key={d.name} value={d.name}>{d.title}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => setChartType('bar')} style={{ padding: '0.5rem', border: '1px solid #d1d5db', background: chartType === 'bar' ? '#e0e7ff' : 'white', borderRadius: '4px', cursor: 'pointer', color: chartType === 'bar' ? '#3b82f6' : '#6b7280' }} title="Bar Chart"><BarChart2 size={20} /></button>
                            <button onClick={() => setChartType('line')} style={{ padding: '0.5rem', border: '1px solid #d1d5db', background: chartType === 'line' ? '#d1fae5' : 'white', borderRadius: '4px', cursor: 'pointer', color: chartType === 'line' ? '#10b981' : '#6b7280' }} title="Line Chart"><TrendingUp size={20} /></button>
                            <button onClick={() => setChartType('pie')} style={{ padding: '0.5rem', border: '1px solid #d1d5db', background: chartType === 'pie' ? '#fef3c7' : 'white', borderRadius: '4px', cursor: 'pointer', color: chartType === 'pie' ? '#f59e0b' : '#6b7280' }} title="Pie Chart"><PieChartIcon size={20} /></button>
                        </div>

                    </div>

                    {/* Chart Area */}
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: '0 0 1.5rem 0', color: '#111827', fontSize: '1.125rem', fontWeight: 600 }}>
                            {selectedMeasure ? measureTitle : 'Analysis Canvas'}
                        </h3>
                        
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', borderRadius: '4px', border: '1px dashed #d1d5db' }}>
                            {metaLoading && <p style={{ color: '#6b7280' }}>Loading Models...</p>}
                            {!selectedMeasure && !metaLoading && <p style={{ color: '#9ca3af' }}>Select a measure to generate a chart.</p>}
                            {queryLoading && selectedMeasure && <p style={{ color: '#3b82f6' }}>Querying CubeStore...</p>}
                            {error && <p style={{ color: '#ef4444' }}>{error.toString()}</p>}
                            {!queryLoading && !error && resultSet && chartData.length > 0 && (
                                renderChart()
                            )}
                            {!queryLoading && !error && resultSet && chartData.length === 0 && (
                                <p style={{ color: '#6b7280' }}>No data available for this selection in the current project context.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
