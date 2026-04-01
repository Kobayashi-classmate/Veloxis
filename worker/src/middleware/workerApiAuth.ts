import { NextFunction, Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config';

export interface WorkerApiRequest extends Request {
    workerAccessToken?: string;
    workerUser?: any;
}

export async function authenticateWorkerApi(req: WorkerApiRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization ?? '';
    if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization Bearer token is required' });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
        return res.status(401).json({ error: 'Authorization Bearer token is required' });
    }

    try {
        const meRes = await axios.get(`${config.directus.url}/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        req.workerAccessToken = token;
        req.workerUser = meRes.data?.data ?? null;
        return next();
    } catch (err: any) {
        const status = err?.response?.status;
        if (status === 403) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}
