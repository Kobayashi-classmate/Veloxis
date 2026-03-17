import * as XLSX from 'xlsx';
import mysql from 'mysql2/promise';
import axios from 'axios';

const config = {
    doris: { host: 'doris-fe', httpPort: '8030', user: 'root', password: '', database: 'veloxis_data' }
};

async function run() {
    console.log("🚀 [Excel Test] 100k Ingestion (Redirect-aware)...");
    const workbook = XLSX.readFile('/app/test_file/test.xlsx');
    const csvData = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);

    const db = await mysql.createConnection({ host: config.doris.host, port: 9030, user: config.doris.user, password: config.doris.password });
    await db.query(`CREATE DATABASE IF NOT EXISTS ${config.doris.database}`);
    const tableName = 'excel_test_final';
    await db.query(`DROP TABLE IF EXISTS ${config.doris.database}.${tableName}`);
    await db.query(`CREATE TABLE ${config.doris.database}.${tableName} (c1 VARCHAR(255), c2 TEXT, c3 TEXT, c4 TEXT, c5 TEXT, c6 TEXT, c7 TEXT, c8 TEXT, c9 TEXT, c10 TEXT) DUPLICATE KEY(c1) DISTRIBUTED BY HASH(c1) BUCKETS 1 PROPERTIES ("replication_allocation" = "tag.location.default: 1");`);
    await db.end();

    console.log("[Excel Test] Step 1: Get redirect from FE...");
    const feUrl = `http://${config.doris.host}:${config.doris.httpPort}/api/${config.doris.database}/${tableName}/_stream_load`;
    const auth = 'Basic ' + Buffer.from('root:').toString('base64');
    
    let beUrl = feUrl;
    try {
        await axios.put(feUrl, null, {
            headers: { 'Authorization': auth, 'Expect': '100-continue' },
            maxRedirects: 0
        });
    } catch (err: any) {
        if (err.response && err.response.status === 307) {
            beUrl = err.response.headers.location;
            console.log(`[Excel Test] Redirected to BE: ${beUrl}`);
        } else {
             throw err;
        }
    }

    console.log("[Excel Test] Step 2: Push data to BE...");
    const response = await axios.put(beUrl, Buffer.from(csvData), {
        headers: { 'Authorization': auth, 'format': 'csv', 'column_separator': ',' },
        maxBodyLength: Infinity
    });

    console.log("[Excel Test] 🏁 Result:", JSON.stringify(response.data, null, 2));
    process.exit(0);
}
run().catch(console.error);
