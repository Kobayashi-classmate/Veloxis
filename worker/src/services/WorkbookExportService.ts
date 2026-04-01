import axios from 'axios';
import { config } from '../config';

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkbookMeta {
    id: string;
    project_id: string;
    name: string;
    description: string | null;
    date_created: string;
    date_updated: string;
}

export interface ChartExport {
    id: string;
    canvas_id: string;
    type: string;
    title: string | null;
    x: number;
    y: number;
    w: number;
    h: number;
    order: number;
    option_json: string | null;
    binding_json: string | null;
}

export interface CanvasExport {
    id: string;
    category_id: string;
    group_id: string | null;
    name: string;
    order: number;
    charts: ChartExport[];
}

export interface CanvasGroupExport {
    id: string;
    category_id: string;
    name: string;
    order: number;
}

export interface CategoryExport {
    id: string;
    workbook_id: string;
    name: string;
    color: string | null;
    icon: string | null;
    order: number;
    groups: CanvasGroupExport[];
    canvases: CanvasExport[];
}

export interface WorkbookExport {
    /** Schema version — increment on breaking changes. */
    export_version: number;
    exported_at: string;
    workbook: WorkbookMeta;
    categories: CategoryExport[];
}

// ─────────────────────────────────────────────────────────────────────────────
// WorkbookExportService
// ─────────────────────────────────────────────────────────────────────────────

export class WorkbookExportService {
    /**
     * Assembles a complete workbook export by fetching:
     *   workbook → categories → (canvas_groups + canvases → charts)
     *
     * All Directus requests share a single token obtained at the start.
     * This avoids token-per-request overhead for what can be ~5 serial calls.
     *
     * @param workbookId UUID of the workbook to export.
     * @returns Fully nested WorkbookExport object ready for JSON serialization.
     */
    async exportWorkbook(workbookId: string, accessToken: string): Promise<WorkbookExport> {
        console.log(`[WorkbookExportService] Starting export for workbook ${workbookId}`);

        const headers = { Authorization: `Bearer ${accessToken}` };

        // ── 1. Fetch workbook root ────────────────────────────────────────────
        let wbRes: any;
        try {
            wbRes = await axios.get(
                `${config.directus.url}/items/workbooks/${workbookId}`,
                { headers }
            );
        } catch (err: any) {
            if (err?.response?.status === 404) {
                throw Object.assign(
                    new Error(`Workbook ${workbookId} not found`),
                    { code: 'WORKBOOK_NOT_FOUND' }
                );
            }
            throw err;
        }
        const workbook: WorkbookMeta = wbRes.data.data;
        if (!workbook) {
            throw Object.assign(
                new Error(`Workbook ${workbookId} not found`),
                { code: 'WORKBOOK_NOT_FOUND' }
            );
        }

        // ── 2. Fetch all categories for this workbook ─────────────────────────
        const catRes = await axios.get(
            `${config.directus.url}/items/wb_categories`,
            {
                headers,
                params: {
                    filter: JSON.stringify({ workbook_id: { _eq: workbookId } }),
                    sort: 'order',
                    limit: -1,
                },
            }
        );
        const rawCategories: any[] = catRes.data.data ?? [];

        const categoryIds: string[] = rawCategories.map((c: any) => c.id);

        // ── 3. Fetch canvas groups (batch, one request) ───────────────────────
        let rawGroups: any[] = [];
        if (categoryIds.length > 0) {
            const grpRes = await axios.get(
                `${config.directus.url}/items/wb_canvas_groups`,
                {
                    headers,
                    params: {
                        filter: JSON.stringify({ category_id: { _in: categoryIds } }),
                        sort: 'order',
                        limit: -1,
                    },
                }
            );
            rawGroups = grpRes.data.data ?? [];
        }

        // ── 4. Fetch canvases (batch) ─────────────────────────────────────────
        let rawCanvases: any[] = [];
        if (categoryIds.length > 0) {
            const canvasRes = await axios.get(
                `${config.directus.url}/items/wb_canvases`,
                {
                    headers,
                    params: {
                        filter: JSON.stringify({ category_id: { _in: categoryIds } }),
                        sort: 'order',
                        limit: -1,
                    },
                }
            );
            rawCanvases = canvasRes.data.data ?? [];
        }

        // ── 5. Fetch charts (batch) ───────────────────────────────────────────
        const canvasIds: string[] = rawCanvases.map((c: any) => c.id);
        let rawCharts: any[] = [];
        if (canvasIds.length > 0) {
            const chartRes = await axios.get(
                `${config.directus.url}/items/wb_charts`,
                {
                    headers,
                    params: {
                        filter: JSON.stringify({ canvas_id: { _in: canvasIds } }),
                        sort: 'order',
                        limit: -1,
                    },
                }
            );
            rawCharts = chartRes.data.data ?? [];
        }

        // ── 6. Assemble nested structure ──────────────────────────────────────

        // Index charts by canvas_id
        const chartsByCanvas: Record<string, ChartExport[]> = {};
        for (const ch of rawCharts) {
            if (!chartsByCanvas[ch.canvas_id]) chartsByCanvas[ch.canvas_id] = [];
            chartsByCanvas[ch.canvas_id].push({
                id: ch.id,
                canvas_id: ch.canvas_id,
                type: ch.type,
                title: ch.title ?? null,
                x: ch.x ?? 0,
                y: ch.y ?? 0,
                w: ch.w ?? 6,
                h: ch.h ?? 4,
                order: ch.order ?? 0,
                option_json: ch.option_json ?? null,
                binding_json: ch.binding_json ?? null,
            });
        }

        // Index canvases by category_id
        const canvasesByCategory: Record<string, CanvasExport[]> = {};
        for (const cv of rawCanvases) {
            if (!canvasesByCategory[cv.category_id]) canvasesByCategory[cv.category_id] = [];
            canvasesByCategory[cv.category_id].push({
                id: cv.id,
                category_id: cv.category_id,
                group_id: cv.group_id ?? null,
                name: cv.name,
                order: cv.order ?? 0,
                charts: chartsByCanvas[cv.id] ?? [],
            });
        }

        // Index groups by category_id
        const groupsByCategory: Record<string, CanvasGroupExport[]> = {};
        for (const g of rawGroups) {
            if (!groupsByCategory[g.category_id]) groupsByCategory[g.category_id] = [];
            groupsByCategory[g.category_id].push({
                id: g.id,
                category_id: g.category_id,
                name: g.name,
                order: g.order ?? 0,
            });
        }

        const categories: CategoryExport[] = rawCategories.map((cat: any) => ({
            id: cat.id,
            workbook_id: cat.workbook_id,
            name: cat.name,
            color: cat.color ?? null,
            icon: cat.icon ?? null,
            order: cat.order ?? 0,
            groups: groupsByCategory[cat.id] ?? [],
            canvases: canvasesByCategory[cat.id] ?? [],
        }));

        const exportPayload: WorkbookExport = {
            export_version: 1,
            exported_at: new Date().toISOString(),
            workbook,
            categories,
        };

        const totalCharts = rawCharts.length;
        const totalCanvases = rawCanvases.length;
        console.log(`[WorkbookExportService] Export complete: ${categories.length} categories, ${totalCanvases} canvases, ${totalCharts} charts`);

        return exportPayload;
    }
}
