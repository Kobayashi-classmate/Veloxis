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
        
        console.log(`[Doris] Step 1: Requesting Stream Load from FE: ${feUrl}`);

        let targetUrl = feUrl;
        
        // Build the columns mapping if projectId is provided
        let columnsHeader = undefined;
        if (options?.headers && options?.projectId) {
            // Map the native headers, and inject project_id
            const baseColumns = options.headers.map(h => `\`${h}\``).join(',');
            columnsHeader = `${baseColumns}, project_id='${options.projectId}'`;
        }

        // Step 1: Handle FE to BE redirection (Doris FE redirects to a specific BE for the load)
        try {
            // We send a small empty request or just use axios with maxRedirects: 0 to catch the 307
            const redirectRes = await axios.put(feUrl, null, {
                headers: {
                    'Authorization': this.authHeader,
                    'Expect': '100-continue',
                    'label': label
                },
                maxRedirects: 0,
                validateStatus: (status) => status === 307 || (status >= 200 && status < 300)
            });

            if (redirectRes.status === 307) {
                targetUrl = redirectRes.headers.location;
                console.log(`[Doris] Step 2: Redirected to BE: ${targetUrl}`);
            }

        } catch (error: any) {
            console.error(`[Doris] FE Request Failed:`, error.response?.data || error.message);
            throw error;
        }

        // Step 3: Perform the actual load to the BE
        console.log(`[Doris] Step 3: Pushing data to target...`);
        
        const headersToPass: any = {
            'Authorization': this.authHeader,
            'format': 'csv',
            'column_separator': options?.columnSeparator || ',',
            'label': label,
            'Expect': '100-continue',
            'skip_header': '1' // Always skip CSV header row
        };

        if (columnsHeader) {
            headersToPass['columns'] = columnsHeader;
        }

        try {
            const response = await axios.put(targetUrl, data, {
                headers: headersToPass,
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });

            if (response.data && response.data.Status === 'Success') {
                console.log(`[Doris] ✅ Load Successful: ${response.data.NumberLoadedRows} rows.`);
                return response.data;
            } else {
                console.error(`[Doris] ❌ Load Failed:`, response.data);
                throw new Error(response.data.Message || 'Stream Load Failed');
            }
        } catch (error: any) {
            console.error(`[Doris] BE Data Push Failed:`, error.response?.data || error.message);
            throw error;
        }
    }
}
