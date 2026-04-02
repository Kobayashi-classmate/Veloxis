import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { ExcelConverter } from './ExcelConverter';

function createWorkbookFile(): string {
    const wb = XLSX.utils.book_new();
    const sheetA = XLSX.utils.aoa_to_sheet([
        ['name', 'age'],
        ['Alice', '18'],
    ]);
    const sheetB = XLSX.utils.aoa_to_sheet([
        ['city', 'country'],
        ['Shanghai', 'CN'],
    ]);
    XLSX.utils.book_append_sheet(wb, sheetA, 'People');
    XLSX.utils.book_append_sheet(wb, sheetB, 'Geo');

    const filePath = path.join(os.tmpdir(), `excel-converter-test-${Date.now()}.xlsx`);
    XLSX.writeFile(wb, filePath);
    return filePath;
}

test('ExcelConverter should read the specified sheet by name', () => {
    const filePath = createWorkbookFile();
    try {
        const csv = ExcelConverter.toCSV(filePath, { sheetName: 'Geo' });
        assert.match(csv, /city,country/);
        assert.match(csv, /Shanghai,CN/);
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
});

test('ExcelConverter should throw when sheet is missing', () => {
    const filePath = createWorkbookFile();
    try {
        assert.throws(() => ExcelConverter.toCSV(filePath, { sheetName: 'NotFound' }));
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
});

