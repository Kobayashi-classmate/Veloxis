import * as XLSX from 'xlsx';
import * as fs from 'fs';
import ExcelJS from 'exceljs';

export class ExcelConverter {
    /**
     * Small files (≤ 20 MB): in-memory conversion using xlsx library.
     * Returns CSV string.
     */
    static toCSV(filePath: string, sheetIndex: number = 0): string {
        const workbook = XLSX.readFile(filePath, {
            type: 'file',
            cellDates: true,
            dense: true,
        });
        const sheetName = workbook.SheetNames[sheetIndex];
        const sheet = workbook.Sheets[sheetName];
        return XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    }

    /**
     * Large files (> 20 MB): true streaming conversion using ExcelJS.
     * Reads the xlsx row-by-row via a SAX-based XML parser — peak memory
     * is proportional to a single row, not the full workbook.
     * Writes output CSV directly to destPath.
     */
    static async toCSVFileStream(filePath: string, destPath: string): Promise<void> {
        const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
            sharedStrings: 'cache',
            hyperlinks: 'ignore',
            styles: 'ignore',
            entries: 'emit',
            worksheets: 'emit',
        } as any);

        const escapeCell = (val: unknown): string => {
            if (val === null || val === undefined) return '';
            let s: string;
            if (val instanceof Date) {
                s = val.toISOString().slice(0, 10);
            } else {
                s = String(val);
            }
            if (s.includes(',') || s.includes('\n') || s.includes('"')) {
                return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
        };

        const writeStream = fs.createWriteStream(destPath);

        // parse() yields { eventType: 'worksheet', value: worksheetObj } for each sheet.
        // Each worksheetObj is itself async-iterable, yielding ExcelJS Row objects.
        // Row.values is 1-indexed (index 0 is null); iterate from 1..length-1.
        let processedFirstSheet = false;

        for await (const { eventType, value } of (workbook as any).parse()) {
            if (eventType === 'worksheet') {
                if (processedFirstSheet) {
                    // Only process the first worksheet
                    break;
                }
                processedFirstSheet = true;
                const worksheet = value as any;
                for await (const row of worksheet) {
                    const cells: string[] = [];
                    const values: any[] = (row as any).values ?? [];
                    // row.values is 1-indexed; skip index 0
                    const lastIdx = values.length - 1;
                    for (let c = 1; c <= lastIdx; c++) {
                        cells.push(escapeCell(values[c]));
                    }
                    writeStream.write(cells.join(',') + '\n');
                }
            }
        }

        await new Promise<void>((resolve, reject) => {
            writeStream.end();
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });
    }

    /**
     * @deprecated Use toCSVFileStream for large files. Kept for compatibility.
     * Synchronous streaming variant — blocks the event loop for large files.
     */
    static toCSVFile(filePath: string, destPath: string, sheetIndex: number = 0): void {
        const workbook = XLSX.readFile(filePath, {
            type: 'file',
            cellDates: true,
            dense: true,
        });
        const sheetName = workbook.SheetNames[sheetIndex];
        const ws = workbook.Sheets[sheetName];

        const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
        const fd = fs.openSync(destPath, 'w');

        const escapeCell = (val: unknown): string => {
            if (val === null || val === undefined) return '';
            const s = val instanceof Date
                ? val.toISOString().slice(0, 10)
                : String(val);
            if (s.includes(',') || s.includes('\n') || s.includes('"')) {
                return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
        };

        for (let R = range.s.r; R <= range.e.r; R++) {
            const row = (ws as any)[R] as (XLSX.CellObject | undefined)[] | undefined;
            if (!row) {
                fs.writeSync(fd, '\n');
                continue;
            }
            const cells: string[] = [];
            for (let C = range.s.c; C <= range.e.c; C++) {
                const cell = row[C];
                cells.push(escapeCell(cell ? (cell.w ?? cell.v) : undefined));
            }
            fs.writeSync(fd, cells.join(',') + '\n');
        }

        fs.closeSync(fd);
    }
}
