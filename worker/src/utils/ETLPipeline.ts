import fs from 'fs';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';

export interface ETLOperator {
    type: 'rename' | 'filter' | 'uppercase' | 'lowercase';
    field?: string;
    from?: string;
    to?: string;
    condition?: string; // For future complex filters
}

export class ETLPipeline {
    /**
     * Streams the input CSV, applies the array of ETL operators, and writes a new CSV.
     * This avoids memory bloat for gigabyte-scale files.
     * @returns A promise that resolves to the array of *new* column headers.
     */
    static async process(inputPath: string, outputPath: string, operators: ETLOperator[]): Promise<string[]> {
        if (!operators || operators.length === 0) {
            return [];
        }

        console.log(`[ETL] Starting pipeline with ${operators.length} operators...`);

        return new Promise((resolve, reject) => {
            const parser = parse({
                columns: true, // Auto-discover headers from row 1
                skip_empty_lines: true,
                trim: true
            });

            let outputHeaders: string[] = [];
            let headersResolved = false;

            const stringifier = stringify({
                header: true
            });

            const inputStream = fs.createReadStream(inputPath);
            const outputStream = fs.createWriteStream(outputPath);

            const onError = (err: Error) => reject(err);
            parser.on('error', onError);
            stringifier.on('error', onError);
            inputStream.on('error', onError);
            outputStream.on('error', onError);

            outputStream.on('finish', () => resolve(outputHeaders));
            stringifier.pipe(outputStream);

            // Use 'data' event (flowing mode) — compatible with pipe-driven input streams.
            // 'readable' + parser.read() conflicts with pipe's flowing mode and causes
            // the readable event to never fire, leaving outputHeaders empty.
            parser.on('data', (record: Record<string, string>) => {
                // Build a rename map: originalKey -> newKey
                // We preserve insertion order by rebuilding the row object in the
                // original column sequence — delete+re-insert in JS moves the key
                // to the end, which corrupts the column order for Doris.
                const renameMap: Record<string, string> = {};
                for (const op of operators) {
                    if (op.type === 'rename' && op.from && op.to) {
                        renameMap[op.from] = op.to;
                    }
                }

                // Rebuild the row with keys in original order, applying renames
                const processRow: Record<string, string> = {};
                for (const origKey of Object.keys(record)) {
                    const newKey = renameMap[origKey] ?? origKey;
                    processRow[newKey] = record[origKey];
                }

                // Apply non-rename operators on the already-renamed row
                let dropRow = false;
                for (const op of operators) {
                    const targetKey = op.field ? (renameMap[op.field] ?? op.field) : undefined;
                    if (op.type === 'uppercase' && targetKey) {
                        if (processRow[targetKey]) processRow[targetKey] = String(processRow[targetKey]).toUpperCase();
                    } else if (op.type === 'lowercase' && targetKey) {
                        if (processRow[targetKey]) processRow[targetKey] = String(processRow[targetKey]).toLowerCase();
                    } else if (op.type === 'filter' && targetKey) {
                        if (!processRow[targetKey] || processRow[targetKey] === '') dropRow = true;
                    }
                }

                if (dropRow) return;

                if (!headersResolved) {
                    outputHeaders = Object.keys(processRow);
                    headersResolved = true;
                }

                stringifier.write(processRow);
            });

            parser.on('end', () => {
                // If all rows were dropped (or file was header-only), derive headers
                // from the rename operators so the caller still gets a valid column list.
                if (!headersResolved) {
                    const renameOps = operators.filter(op => op.type === 'rename' && op.to);
                    if (renameOps.length > 0) {
                        outputHeaders = renameOps.map(op => op.to!);
                    }
                }
                stringifier.end();
            });

            inputStream.pipe(parser);
        });
    }
}

