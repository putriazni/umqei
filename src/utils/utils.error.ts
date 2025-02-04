interface ErrorLog {
    error: unknown;
    queryUsed: string;
    table: string;
    action?: string;
}

export interface ErrorDetails {
    errorMessage: string;
    details: {
        code: string;
        errno: number;
        sql: string;
        sqlState: string;
        sqlMessage: string;
    }
}

/**
 * Show error with customized message in development
 * @param log gather important information
 */
export function errorLogger(log: ErrorLog) {
    const errorInfo: ErrorDetails = {
        errorMessage: `Perform ${log.action} on TABLE ${log.table} with ${log.queryUsed}`,
        details: {
            code: "",
            errno: 0,
            sql: "",
            sqlState: "",
            sqlMessage: ""
        }
    };
    if (isSqlError(log.error)) {
        errorInfo.details = {
            code: log.error.code,
            errno: log.error.errno,
            sql: log.error.sql,
            sqlState: log.error.sqlState,
            sqlMessage: log.error.sqlMessage
        };
    }
    throw new Error(JSON.stringify(errorInfo));
}

function isSqlError(error: any): error is { sqlMessage: string, sqlState: string, errno: number, code: string, sql: string } {
    return 'sqlMessage' in error && 'sqlState' in error && 'code' in error && 'errno' in error && 'sql' in error;
}