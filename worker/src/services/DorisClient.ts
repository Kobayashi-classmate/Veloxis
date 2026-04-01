import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { Readable } from 'stream';
import mysql from 'mysql2/promise';

export class DorisClient {
    private httpBase: string;
    private authHeader: string;

    constructor() {
        this.httpBase = `http://${config.doris.host}:${config.doris.httpPort}`;
        const creds = `${config.doris.user}:${config.doris.password}`;
        this.authHeader = `Basic ${Buffer.from(creds).toString('base64')}`;
    }

    /**
     * Dynamically creates a Doris table based on CSV headers
     */
    async ensureTableExists(tableName: string, headers: string[]) {
        if (headers.length === 0) throw new Error("Cannot create table without headers");

        const db = await mysql.createConnection({
            host: config.doris.host,
            port: 9030,
            user: config.doris.user,
            password: config.doris.password
        });

        await db.query(`CREATE DATABASE IF NOT EXISTS ${config.doris.database}`);
        
        // Use the first column as the hash bucket key
        const firstCol = headers[0];
        const columnsDef = headers.map(h => `\`${h}\` VARCHAR(65533)`).join(', ');
        
        const createQuery = `
            CREATE TABLE IF NOT EXISTS ${config.doris.database}.\`${tableName}\` (
                ${columnsDef},
                \`project_id\` VARCHAR(36)
            )
            DUPLICATE KEY(\`${firstCol}\`)
            DISTRIBUTED BY HASH(\`${firstCol}\`) BUCKETS 1
            PROPERTIES (
                "replication_allocation" = "tag.location.default: 1"
            );
        `;

        try {
            await db.query(createQuery);
            console.log(`[Doris] Ensured table \`${tableName}\` exists with project_id.`);
        } catch(e: any) {
            console.error(`[Doris] Failed to create table:`, e.message);
            throw e;
        } finally {
            await db.end();
        }
    }

    /**
     * Production-grade Stream Load with 307 Redirect handling
     * @param tableName Destination table
     * @param data Buffer or Stream
     */
    async streamLoad(tableName: string, data: Buffer | Readable, options?: { columnSeparator?: string, headers?: string[], projectId?: string }) {
        const feUrl = `${this.httpBase}/api/${config.doris.database}/${tableName}/_stream_load`;
        const label = `veloxis_ingest_${tableName}_${Date.now()}`;

        // Build the columns mapping: inject project_id as a literal for multi-tenant isolation
        let columnsHeader: string | undefined;
        if (options?.headers && options.headers.length > 0 && options?.projectId) {
            const baseColumns = options.headers.map(h => `\`${h}\``).join(',');
            columnsHeader = `${baseColumns}, project_id='${options.projectId}'`;
        }

        const requestHeaders: Record<string, string> = {
            'Authorization': this.authHeader,
            'format': 'csv',
            'column_separator': options?.columnSeparator || ',',
            'label': label,
            'Expect': '100-continue',
            'skip_header': '1',
        };
        if (columnsHeader) {
            requestHeaders['columns'] = columnsHeader;
        }

        /**
         * Doris Stream Load redirect pattern (stream-safe):
         *
         * Problem: Doris FE always returns 307 redirect to the actual BE node.
         * If we send a ReadStream body to FE first, the stream gets fully consumed
         * before the 307 response arrives — leaving nothing to send to BE (0 rows).
         *
         * Solution: Two-phase approach
         *  1. PROBE: Send an empty-body PUT to FE to discover the BE URL (307 redirect).
         *  2. LOAD:  Send the real data stream directly to BE.
         *
         * If FE responds with 200 directly (single-node, FE==BE), skip the probe and
         * send data straight to FE.
         */
        console.log(`[Doris] Initiating Stream Load to FE: ${feUrl} (label: ${label})`);

        // Phase 1: Probe FE with empty body to get the BE redirect URL
        let targetUrl = feUrl;
        let isSingleNode = false;

        try {
            const probeResponse = await axios.put(feUrl, '', {
                headers: requestHeaders,
                maxRedirects: 0,
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                validateStatus: (s) => s === 307 || (s >= 200 && s < 300),
            });

            if (probeResponse.status === 307 && probeResponse.headers?.location) {
                targetUrl = probeResponse.headers.location;
            } else {
                // FE returned 200 directly (single-node deployment: FE == BE)
                isSingleNode = true;
            }
        } catch (err: any) {
            if (err.response?.status === 307 && err.response?.headers?.location) {
                targetUrl = err.response.headers.location;
            } else {
                console.error(`[Doris] FE probe failed:`, err.response?.data || err.message);
                throw err;
            }
        }

        // Phase 2: Send the real data stream to the resolved target URL
        if (isSingleNode) {
            // Single-node: send directly to FE
            console.log(`[Doris] Single-node deployment, sending data directly to FE.`);
        } else {
            console.log(`[Doris] Redirected to BE: ${targetUrl}`);
        }

        try {
            const response = await axios.put(targetUrl, data, {
                headers: requestHeaders,
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            });

            if (response.data?.Status === 'Success') {
                console.log(`[Doris] ✅ Load Successful: ${response.data.NumberLoadedRows} rows.`);
                return response.data;
            }
            console.error(`[Doris] ❌ Load Failed:`, response.data);
            throw new Error(response.data?.Message || response.data?.msg || 'Stream Load Failed');
        } catch (error: any) {
            console.error(`[Doris] BE data push failed:`, error.response?.data || error.message);
            throw error;
        }
    }
}
