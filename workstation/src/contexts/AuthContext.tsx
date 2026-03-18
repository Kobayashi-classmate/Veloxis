import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { directus } from '../lib/directus';
import { readMe } from '@directus/sdk';

interface AuthContextType {
    user: any | null;
    token: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<any | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const loadUser = async () => {
        try {
            const tokenRes = await directus.getToken();
            if (tokenRes) {
                setToken(tokenRes);
                const userData = await directus.request(readMe());
                setUser(userData);
            }
        } catch (error) {
            console.error("Not authenticated", error);
            setUser(null);
            setToken(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUser();
    }, []);

    const login = async (email: string, password: string) => {
        setLoading(true);
        await directus.login(email, password);
        await loadUser();
    };

    const logout = async () => {
        await directus.logout();
        setUser(null);
        setToken(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
