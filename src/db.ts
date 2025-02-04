import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';
import { logger } from './middleware/logger';

dotenv.config();
 export const connection = createPool({
	host: process.env.DB_HOST,
	user: process.env.DB_USERNAME,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_DATABASE,
	connectionLimit: 10,
	decimalNumbers: true //Added this to receive decimal from mysql as number, otherwise it will be received as string for high precision. (It's unlikely that we need high precision decimal)
});

connection
    .getConnection()
    .then((conn) => {
        conn.release();
        logger.info('Connected to the database');
    })
    .catch((err) => {
        logger.error('Error connecting to the database:', err);
    });

export async function query(query: string, values?: any | any[] | { [param: string]: any }) {
	if (values) {
		return await connection.query(query, values);
	} else {
		return await connection.query(query);
	}
}