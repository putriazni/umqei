import dayjs from "dayjs";

export function underscoreToCamelCase(nameWithUnderscore: string) {
    return nameWithUnderscore.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function isValidDateTimeFormat(dateTimeString: string) {
    const pattern = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
    return dayjs(dateTimeString, 'YYYY-MM-DD HH:mm:ss', true).isValid() && pattern.test(dateTimeString);
}

export function isStringValid(str: string | null | undefined): boolean {
    return str != null && str.trim() !== "";
}

export function isStatusValid(value: number): boolean {
    return value === 0 || value === 1;
}

export function isNumberExceed(value: number, minValue: number, maxValue: number): boolean {
    return value >= minValue && value <= maxValue;
}

export function isNumberValid(value: any): boolean {
    return typeof value === 'number' && !isNaN(value);
}

export function isRoleValid(value: string): boolean {
    return value === 'PTJ' || value === 'Auditor';
}
