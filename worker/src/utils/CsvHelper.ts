import fs from 'fs';

export class CsvHelper {
    /**
     * Reads only the first line of a CSV file and returns the parsed column names.
     * Handles RFC-4180 quoted fields (e.g. "city, state", "name ""quoted""").
     * Parsed values are normalized into Doris-safe identifiers.
     */
    static getHeaders(filePath: string): string[] {
        const firstLine = CsvHelper.readFirstLine(filePath);
        if (!firstLine) return [];

        const rawHeaders = CsvHelper.parseCSVLine(firstLine);
        return rawHeaders.map((header, index) => {
            const clean = header.trim().replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
            return clean ? clean : `col_${index}`;
        });
    }

    /**
     * Reads the first CSV line safely without fixed-size truncation.
     * Stops at '\n' and supports very long header lines.
     */
    private static readFirstLine(filePath: string): string {
        const READ_CHUNK = 4096;
        const MAX_HEADER_BYTES = 2 * 1024 * 1024; // 2 MB hard guard

        const fd = fs.openSync(filePath, 'r');
        const chunks: Buffer[] = [];
        let total = 0;
        let done = false;

        try {
            while (!done) {
                const buffer = Buffer.allocUnsafe(READ_CHUNK);
                const bytesRead = fs.readSync(fd, buffer, 0, READ_CHUNK, null);
                if (bytesRead <= 0) break; // EOF

                const slice = buffer.subarray(0, bytesRead);
                const newlineIdx = slice.indexOf(0x0a); // '\n'

                if (newlineIdx >= 0) {
                    const upToNewline = slice.subarray(0, newlineIdx);
                    chunks.push(upToNewline);
                    total += upToNewline.length;
                    done = true;
                } else {
                    chunks.push(slice);
                    total += slice.length;
                }

                if (total > MAX_HEADER_BYTES) {
                    throw new Error(`CSV header too large (> ${MAX_HEADER_BYTES} bytes)`);
                }
            }
        } finally {
            fs.closeSync(fd);
        }

        if (chunks.length === 0) return '';
        const line = Buffer.concat(chunks, total).toString('utf-8');
        return line.endsWith('\r') ? line.slice(0, -1) : line;
    }

    /**
     * Minimal RFC-4180 CSV line parser.
     * Handles quoted fields that may contain commas and escaped double-quotes ("").
     */
    private static parseCSVLine(line: string): string[] {
        const fields: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];

            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (ch === ',' && !inQuotes) {
                fields.push(current.trim());
                current = '';
                continue;
            }

            current += ch;
        }

        fields.push(current.trim());
        return fields;
    }
}
