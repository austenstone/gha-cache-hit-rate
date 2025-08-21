import { format, parseISO, isValid, subDays, startOfDay, endOfDay } from 'date-fns';
export function parseDate(dateString) {
    const date = parseISO(dateString);
    if (!isValid(date)) {
        throw new Error(`Invalid date format: ${dateString}. Use YYYY-MM-DD format.`);
    }
    return date;
}
export function formatDate(date) {
    return format(date, 'yyyy-MM-dd');
}
export function formatDateTime(date) {
    return format(date, 'yyyy-MM-dd HH:mm:ss');
}
export function getDefaultDateRange() {
    const to = endOfDay(new Date());
    const from = startOfDay(subDays(to, 30));
    return { from, to };
}
export function daysBetween(from, to) {
    const diffTime = Math.abs(to.getTime() - from.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
export function formatDuration(ms) {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    else if (ms < 60000) {
        return `${(ms / 1000).toFixed(1)}s`;
    }
    else if (ms < 3600000) {
        return `${(ms / 60000).toFixed(1)}m`;
    }
    else {
        return `${(ms / 3600000).toFixed(1)}h`;
    }
}
export function formatBytes(bytes) {
    if (bytes === 0) {
        return '0B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))}${sizes[i]}`;
}
export function percentage(part, total, decimals = 1) {
    if (total === 0) {
        return 0;
    }
    return parseFloat(((part / total) * 100).toFixed(decimals));
}
