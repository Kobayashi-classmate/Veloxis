import fs from 'fs';

export class CsvHelper {
    static getHeaders(filePath: string): string[] {
        // Read just enough to get the first line
        const buffer = Buffer.alloc(4096);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, 4096, 0);
        fs.closeSync(fd);
        
        const data = buffer.toString('utf-8');
        const firstLine = data.split('\n')[0];
        if (!firstLine) return [];
        
        return firstLine.split(',').map((h, index) => {
            let clean = h.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
            return clean ? clean : `col_${index}`;
        });
    }
}
