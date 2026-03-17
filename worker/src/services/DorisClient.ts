import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { Readable } from 'stream';

export class DorisClient {
    private httpBase: string;
    private authHeader: string;

    constructor() {
        this.httpBase = `http://${config.doris.host}:${config.doris.httpPort}`;
        const creds = `${config.doris.user}:${config.doris.password}`;
        this.authHeader = `Basic ${Buffer.from(creds).toString('base64')}`;
    }

    /**
     * Production-grade Stream Load with 307 Redirect handling
     * @param tableName Destination table
     * @param data Buffer or Stream
     */
    async streamLoad(tableName: string, data: Buffer | Readable, options?: { columnSeparator?: string }) {
        const feUrl = `${this.httpBase}/api/${config.doris.database}/${tableName}/_stream_load`;
        const label = `veloxis_ingest_${tableName}_${Date.now()}`;
        
        console.log(`[Doris] Step 1: Requesting Stream Load from FE: ${feUrl}`);

        let targetUrl = feUrl;
        
        // Step 1: Handle FE to BE redirection (Doris FE redirects to a specific BE for the load)
        try {
            // We send a small empty request or just use axios with maxRedirects: 0 to catch the 307
            await axios.put(feUrl, null, {
                headers: {
                    'Authorization': this.authHeader,
                    'Expect': '100-continue',
                    'label': label
                },
                maxRedirects: 0,
                validateStatus: (status) => status === 307 || (status >= 200 && status < 300)
            });
        } catch (error: any) {
            if (error.response && error.response.status === 307) {
                targetUrl = error.response.headers.location;
                console.log(`[Doris] Step 2: Redirected to BE: ${targetUrl}`);
            } else {
                console.error(`[Doris] FE Request Failed:`, error.response?.data || error.message);
                throw error;
            }
        }

        // Step 3: Perform the actual load to the BE
        console.log(`[Doris] Step 3: Pushing data to target...`);
        try {
            const response = await axios.put(targetUrl, data, {
                headers: {
                    'Authorization': this.authHeader,
                    'format': 'csv',
                    'column_separator': options?.columnSeparator || ',',
                    'label': label
                },
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
