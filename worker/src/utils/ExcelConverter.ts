import * as XLSX from 'xlsx';
import { Readable } from 'stream';

export class ExcelConverter {
    /**
     * Converts a specific sheet of an Excel file into a CSV string.
     * For 100k rows, this fits in memory (a few MB).
     */
    static toCSV(filePath: string, sheetIndex: number = 0): string {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[sheetIndex];
        const sheet = workbook.Sheets[sheetName];
        return XLSX.utils.sheet_to_csv(sheet);
    }
}
