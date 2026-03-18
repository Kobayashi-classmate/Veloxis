import { ReactNode, useMemo } from 'react';
import cubejs from '@cubejs-client/core';
import { CubeProvider } from '@cubejs-client/react';
import { useAuth } from './AuthContext';

export const CubeContextWrapper = ({ children }: { children: ReactNode }) => {
    const { token } = useAuth();

    const cubejsApi = useMemo(() => {
        if (!token) return null;
        
        // Pass the Directus token (or a dedicated Cube.js JWT) to the Cube.js API.
        // Since Directus and Cube.js are on the same auth perimeter in our setup, 
        // we pass the token and configure X-Tenant-Id for multi-tenancy.
        return cubejs(token, {
            apiUrl: '/cubejs-api/v1',
            headers: {
                // In a real app, you'd get the selected project ID from a ProjectContext.
                // For now, we mock a default_project to pass the queryRewrite filters.
                'X-Tenant-Id': 'default_project'
            }
        });
    }, [token]);

    if (!cubejsApi) {
        return <>{children}</>;
    }

    return (
        <CubeProvider cubejsApi={cubejsApi}>
            {children}
        </CubeProvider>
    );
};
