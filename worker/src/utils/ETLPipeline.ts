import fs from 'fs';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import { pipeline } from 'stream/promises';

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

            let isFirstRow = true;
            let outputHeaders: string[] = [];

            const stringifier = stringify({
                header: true // Automatically infers columns from the first object keys
            });

            const inputStream = fs.createReadStream(inputPath);
            const outputStream = fs.createWriteStream(outputPath);

            parser.on('error', reject);
            stringifier.on('error', reject);
            inputStream.on('error', reject);
            outputStream.on('error', reject);

            outputStream.on('finish', () => resolve(outputHeaders));

            inputStream.pipe(parser);

            parser.on('readable', function() {
                let record;
                while ((record = parser.read()) !== null) {
                    
                    let processRow = { ...record };
                    let dropRow = false;

                    // 1. Apply Operators Sequentially
                    for (const op of operators) {
                        if (op.type === 'rename' && op.from && op.to) {
                            if (processRow[op.from] !== undefined) {
                                processRow[op.to] = processRow[op.from];
                                delete processRow[op.from];
                            }
                        }
                        else if (op.type === 'uppercase' && op.field) {
                            if (processRow[op.field]) {
                                processRow[op.field] = String(processRow[op.field]).toUpperCase();
                            }
                        }
                        else if (op.type === 'lowercase' && op.field) {
                            if (processRow[op.field]) {
                                processRow[op.field] = String(processRow[op.field]).toLowerCase();
                            }
                        }
                        else if (op.type === 'filter' && op.field) {
                            if (!processRow[op.field] || processRow[op.field] === '') {
                                dropRow = true;
                            }
                        }
                    }

                    if (dropRow) continue;

                    // Rebuild the object to ensure keys are in a stable order if needed, 
                    // though Object.keys will handle it. We just let stringifier infer.
                    if (isFirstRow) {
                        outputHeaders = Object.keys(processRow);
                        isFirstRow = false;
                    }

                    stringifier.write(processRow);
                }
            });

            parser.on('end', () => {
                stringifier.end();
            });

            stringifier.pipe(outputStream);
        });
    }
}
