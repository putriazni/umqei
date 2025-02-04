import { OkPacket, RowDataPacket } from "mysql2";
import { AccessLayer, Table } from "../constants/global";
import * as mysql from "../db";
import { GENERAL_QUERIES } from "../constants/global";
import { logHelper } from "../middleware/logger";
import { errorLogger } from "./utils.error";


interface CustomQuery extends CustomQueryBase {
    where?: Clause[] | Clause;
    set?: Array<string> | string;
}

interface CustomQueryBase {
    table: string;
    fields?: Array<string> | string;
}

interface Clause {
    column: string;
    value: any | any[];
}

/**
 * Checks if a database query result represents an OkPacket.
 * An OkPacket typically signifies a successful database operation.
 *
 * @param result - The result object to check.
 * @returns True if the result is an OkPacket, indicating success; otherwise, false.
 */
export function isOkPacket(result: any): result is OkPacket {
    return (result as OkPacket).affectedRows !== undefined;
}

function formatQuery(query: string, values?: any | any[] | { [param: string]: any } | CustomQueryBase): string {
    if (!values) {
        return query;
    }

    let currentIndex = 0;
    return query.replace(/\?\?|\?|\(\?\?\)|\(\?\)/g, (match) => {
        if (match === '??') {
            currentIndex++;
            return typeof values === 'string' ? values : values.table;
        } else if (match === '?') {
            if (values.fields !== undefined && Array.isArray(values.fields)) {
                return values.fields.map((field: string, index: number) => {
                    return index < values.fields.length - 1 ? `${field}, ` : field;
                }).join('');
            } else if (values.fields !== undefined) {
                return values.fields;
            }
        } else if (match === '(??)') {
            if (Array.isArray(values.fields)) {
                return `(${values.fields.join(', ')}) VALUES ?`;
            } else {
                return `(${values.fields}) VALUES ?`
            }
        }
        return match;
    });
}

/**
 * Builds a SQL query string based on the provided query template and query options.
 *
 * @param query - The default query template.
 * @param queryOptions - An optional object used to construct the WHERE clause and SET clause (for updates).
 * @returns The formatted SQL query string.
 */
function buildQuery(query: string, queryOptions?: CustomQuery): string {

    let builtQuery = query;
    let baseQueryObject: CustomQueryBase | string;

    // Check if there are SET clauses to append to the query
    if (queryOptions?.set) {
        builtQuery += ' SET ';
        if (Array.isArray(queryOptions.set)) {
            queryOptions.set.forEach((column, index) => {
                if (index > 0) {
                    builtQuery += ', ';
                }
                builtQuery += `${column} = ?`;
            })
        } else {
            builtQuery += `${queryOptions.set} = ?`;
        }
    }

    // Check if there are WHERE conditions to append to the query
    if (queryOptions?.where) {
        const whereConditions = Array.isArray(queryOptions.where) ? queryOptions.where : [queryOptions.where];

        if (whereConditions.length > 0) {
            builtQuery += ' WHERE';


            whereConditions.forEach((condition, index) => {
                if (index > 0) {
                    builtQuery += ' AND';
                }

                if (Array.isArray(condition.value)) {
                    // Use ? placeholders for each value in the IN condition
                    const placeholders = condition.value.map(() => '!').join(', ');
                    builtQuery += ` ${condition.column} IN (${placeholders})`;
                } else {
                    // Use ? placeholder for a single value
                    builtQuery += ` ${condition.column} = !`;
                }
            });
        }
    }

    baseQueryObject = {
        table: queryOptions?.table!,
        fields: queryOptions?.fields
    }
    return formatQuery(builtQuery, baseQueryObject);
}

function replaceParameter(query: string): string {
    return query.replace(/!/g, '?');
}

function replaceInClause(query: string, numPlaceholders: number): string {
    const placeholders = Array.from({ length: numPlaceholders }, (_, index) => '?').join(', ');
    return query.replace(/IN \([\s\S]+?\)/g, `IN (${placeholders})`);
}

function generateInClause(numPlaceholders: number): string {
    if (numPlaceholders <= 0) {
        throw new Error('Number of placeholders should be greater than 0');
    }

    let inClause = '(';
    for (let i = 0; i < numPlaceholders; i++) {
        inClause += '!';
        if (i < numPlaceholders - 1) {
            inClause += ', ';
        }
    }
    inClause += ')';
    return inClause;
}

function getValuesFromClause(clause: Clause[] | Clause | undefined): any[] {
    const values: any[] = [];

    if (clause) {
        if (Array.isArray(clause)) {
            clause.forEach((condition) => {
                values.push(condition.value);
            });
        } else {
            values.push(clause.value);
        }
    }
    return values;
}

/**
 * Retrieves data from a database table using a SELECT query.
 *
 * @param table - The name of the database table from which to retrieve data.
 * @param customFields - An array of custom field names to select, or a single field as a string.
 * @param clause - Optional WHERE clause conditions to filter the data.
 * @returns Data retrieved from the database table.
 */
export async function retrieve(table: Table, customFields: string[] | string, clause?: Clause[] | Clause,) {

    let tableName: string = table;
    let queryObject: CustomQuery = {
        table: tableName,
    }
    let query: string = "";

    if (tableName) {
        queryObject.fields = customFields;
        queryObject.where = clause;

        query = buildQuery(GENERAL_QUERIES.SELECT, queryObject);

        try {
            let result;
            if (clause) {
                let rebuildValue = getValuesFromClause(clause);
                let inClauseString = generateInClause(rebuildValue[0].length);
                if (query.includes(`IN ${inClauseString}`)) {
                    let rebuiltQuery = replaceParameter(query);
                    [result] = await mysql.query(replaceInClause(rebuiltQuery, rebuildValue[0].length), rebuildValue[0]) as RowDataPacket[];
                } else {
                    [result] = await mysql.query(replaceParameter(query), getValuesFromClause(clause)) as RowDataPacket[];
                }
            } else {
                [result] = await mysql.query(query) as RowDataPacket[];
            }
            // const [result] = await mysql.query(query) as RowDataPacket[];
            logHelper('Data retrieval', 'retrieve', AccessLayer.Utilities);
            return result;
        } catch (error) {
            logHelper('retrieve data', 'retrieve', AccessLayer.Utilities, error);
            errorLogger({
                error: error,
                queryUsed: query,
                table: tableName,
                action: GENERAL_QUERIES.SELECT
            })
        }
    }
}

/**
 * Inserts new data into a database table using an INSERT query.
 *
 * @param table - The name of the database table to insert data into.
 * @param customFields - An array of custom field names to insert data into.
 * @param data - An array of arrays containing the data to be inserted, or a single array if inserting a single row.
 * @returns The new ID of the inserted row, or the number of affected rows in case of multiple inserts.
 */
export async function insert(table: Table, customFields: string[], data: any[][] | any[]): Promise<number> {

    let outputValue = 0;
    let tableName: string = table;
    let queryObject: CustomQuery;
    let query: string = "";

    if (tableName) {
        queryObject = {
            table: tableName,
            fields: customFields,
        }
        query = formatQuery(GENERAL_QUERIES.INSERT, queryObject);

        try {
            const [result] = await mysql.query(query, [data]) as RowDataPacket[];

            if (isOkPacket(result)) {
                if (data.length > 1) {
                    if (result.affectedRows > 1 && result.affectedRows === data.length) {
                        outputValue = result.affectedRows;
                    }
                } else if (result.affectedRows === 1) {
                    outputValue = result.insertId;
                }
            }
        } catch (error) {
            logHelper('Data insertion', 'insert', AccessLayer.Utilities, error);
            errorLogger({
                error: error,
                queryUsed: query,
                table: tableName,
                action: GENERAL_QUERIES.INSERT
            })
        }
    }
    logHelper('insert data', 'insert', AccessLayer.Utilities);
    return outputValue;
}

/**
 * Updates data in a database table using an UPDATE query.
 *
 * @param table - The name of the database table to update data in.
 * @param customFields - An array of custom field names to update.
 * @param values - An array of values to set for the specified fields, or a single value if updating a single field.
 * @param clause - An optional array or single clause object specifying the conditions for the update.
 * @returns `true` when data is updated successfully, `false` otherwise.
 */
export async function update(
    table: Table,
    customFields: string[] | string,
    values: any[] | any,
    clause?: Clause[] | Clause
): Promise<boolean> {

    let tableName: string = table;
    let queryObject: CustomQuery = {
        table: tableName,
    }
    let query: string = "";
    let isSuccess: boolean = false;

    if (tableName) {
        queryObject.set = customFields;
        queryObject.where = clause;

        query = buildQuery(GENERAL_QUERIES.UPDATE, queryObject);

        try {
            let valArr = [];
            let whereValue = getValuesFromClause(clause);
            if (Array.isArray(values)) {
                valArr.push(...values);
            } else {
                valArr.push(values);
            }
            valArr.push(...whereValue);

            const [result] = await mysql.query(replaceParameter(query), valArr) as RowDataPacket[];

            if (isOkPacket(result)) {
                if (result.affectedRows === 1) {
                    isSuccess = true;
                }
            }

        } catch (error) {
            logHelper('Data updation', 'update', AccessLayer.Utilities, error);
            errorLogger({
                error: error,
                queryUsed: query,
                table: tableName,
                action: GENERAL_QUERIES.UPDATE
            })
        }
    }
    logHelper('update data', 'update', AccessLayer.Utilities);
    return isSuccess;
}


export async function remove(table: Table, clause: Clause[] | Clause): Promise<boolean> {
    let tableName: string = table;
    let queryObject: CustomQuery = {
        table: tableName,
    }

    let query: string = "";
    let isSuccess: boolean = false;

    if (tableName) {
        queryObject.where = clause;

        query = buildQuery(GENERAL_QUERIES.DELETE, queryObject);

        try {
            const [result] = await mysql.query(replaceParameter(query), getValuesFromClause(clause)) as RowDataPacket[];

            if (isOkPacket(result)) {
                if (result.affectedRows === 1) {
                    isSuccess = true;
                }
            }
        } catch (error) {
            logHelper('remove data', 'remove', AccessLayer.Utilities, error);
            errorLogger({
                error: error,
                queryUsed: query,
                table: tableName,
                action: GENERAL_QUERIES.DELETE
            })
        }
    }
    logHelper('Data removal', 'remove', AccessLayer.Utilities);
    return isSuccess;
}

/**
 * Counts the number of rows in a database table based on specified conditions.
 *
 * @param table - The name of the database table to count rows in.
 * @param as - An optional alias to assign to the count result.
 * @param clause - An optional array or single clause object specifying the conditions for counting rows.
 * @returns The count of rows in the table based on the specified conditions.
 */
export async function count(table: Table, as?: string, clause?: Clause[] | Clause) {

    let tableName: string = table;

    let queryObject: CustomQuery = {
        table: tableName,
    }
    let query: string = GENERAL_QUERIES.COUNT_ALL;

    if (tableName) {
        queryObject.where = clause;

        if (as) {
            query = `${query} as ${as} FROM ??`;
        } else {
            query = `${query} FROM ??`;
        }
        query = buildQuery(query, queryObject);

        try {
            const [result] = await mysql.query(replaceParameter(query), getValuesFromClause(clause)) as RowDataPacket[];
            logHelper('Data counting', 'count', AccessLayer.Utilities);
            return result;

        } catch (error) {
            logHelper('count data', 'count', AccessLayer.Utilities, error);
            errorLogger({
                error: error,
                queryUsed: query,
                table: tableName,
                action: GENERAL_QUERIES.COUNT_ALL
            })
        }
    }
}