export declare function parseDate(dateString: string): Date;
export declare function formatDate(date: Date): string;
export declare function formatDateTime(date: Date): string;
export declare function getDefaultDateRange(): {
    from: Date;
    to: Date;
};
export declare function daysBetween(from: Date, to: Date): number;
export declare function formatDuration(ms: number): string;
export declare function formatBytes(bytes: number): string;
export declare function percentage(part: number, total: number, decimals?: number): number;
