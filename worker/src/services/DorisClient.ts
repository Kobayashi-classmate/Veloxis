import axios from 'axios';
import { config } from '../config';
import { Readable } from 'stream';

export class DorisClient {
    private httpBase: string;
    private authHeader: string;

    constructor() {
        this.httpBase = `http://${config.doris.host}:${config.doris.httpPort}`;
        // Stream Load uses Basic Auth
        const creds = `${config.doris.user}:${config.doris.password}`;
        this.authHeader = `Basic ${Buffer.from(creds).toString('base64')}`;
    }

    /**
     * Highly optimized Stream Load for Doris (GB-scale friendly)
     * @param tableName Destination table in Doris Staging Layer
     * @param dataStream The readable stream containing CSV data
     * @param options E.g., column separator
     */
    async streamLoadCSV(tableName: string, dataStream: Readable, options?: { columnSeparator?: string }) {
        const url = `${this.httpBase}/api/${config.doris.database}/${tableName}/_stream_load`;
        const label = `veloxis_ingest_${tableName}_${Date.now()}`;
        
        console.log(`[Doris] Initiating Stream Load to ${tableName} with label ${label}`);

        try {
            const response = await axios.put(url, dataStream, {
                headers: {
                    'Authorization': this.authHeader,
                    'label': label,
                    'format': 'csv',
                    'column_separator': options?.columnSeparator || ',',
                    'Expect': '100-continue',
                    // Optional: 'max_filter_ratio': '0.1' // Allows up to 10% bad rows
                },
                // Allow large streams to be sent directly without buffering in memory
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });

            if (response.data && response.data.Status === 'Success') {
                console.log(`[Doris] Successfully loaded data to ${tableName}`, response.data);
                return true;
            } else {
                console.error(`[Doris] Stream Load failed or partially failed:`, response.data);
                throw new Error(`Stream Load failed: ${response.data.Message}`);
            }
        } catch (error: any) {
            console.error(`[Doris] Error executing Stream Load:`, error?.response?.data || error.message);
            throw error;
        }
    }
}
