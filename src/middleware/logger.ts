import { createLogger, format, transports } from "winston";
import path from 'path';
import { Request, Response } from 'express';
import { ErrorDetails } from "../utils/utils.error";
import { AccessLayer } from "../constants/global";


export const logger = createLogger({
    transports: [
        new transports.File({
            filename: getLogFileName(),
            format: format.combine(
                format.timestamp({ format: 'ddd, MMM D, YYYY h:mm A' }),
                format.json(),
                format.prettyPrint()
            )
        })
    ]
})

export function requestResponseLoggerMiddleware(req: Request, res: Response, next: () => void) {
    const startTime = process.hrtime();

    const requestBody = req.body;

    res.on('finish', () => {
        const elapsedHrTime = process.hrtime(startTime);
        const responseTimeInMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6;

        const generalInfo = {
            request: {
                method: req.method,
                endpoint: req.originalUrl,
                body: requestBody,
            },
            response: {
                statusCode: res.statusCode,
                statusMessage: res.statusMessage,
                contentLength: res.get('Content-Length'),
                responseTime: responseTimeInMs + ' ms',
            }
        };

        let logMessage = '';

        if (res.statusCode >= 200 && res.statusCode < 300) {
            logMessage = 'API call completed successfully';
        } else if (res.statusCode >= 400) {
            logMessage = 'API call completed with a warning';
        }

        logger.info(logMessage, { ...generalInfo });
    });
    next();
}

/**
 * A utility function for logging actions or events in the application.
 *
 * @param {string} action - Describes the action or event that occurred.
 * @param {string} context - Provides additional context or description of the action.
 * @param {string} folder - Indicates the source or folder from which the action originates.
 * @param {Error | any} [error] - An optional error object. If provided, the function logs the action as a failure and includes the error message.
 *                                If not provided, the function logs the action as a success.
 *
 * @example
 * // Log a successful action
 * logHelper("Data retrieval", "Fetching user data", AccessLayer.Services);
 *
 * // Log a failed action with an error
 * const error = new Error("Failed to retrieve data");
 * logHelper("Data retrieval", "Fetching user data", AccessLayer.Services, error);
 *
 * @remarks
 * The `logHelper` function provides a standardized way to log actions or events in the application. It categorizes logs based on the source or folder,
 * distinguishing between controllers, services, and utilities. When an error is provided, it is logged as a warning or error, depending on the context.
 * If no error is provided, the action is logged as a success.
 */
export function logHelper(action: string, context: string, folder: string, error?: Error | any, rawSQL?: boolean) {
    const logInfo = {
        folder,
        context,
    };

    if (error) {
        if (folder === AccessLayer.Controllers) {
            if (rawSQL) {
                logger.warn(
                    `Unexpected issue encountered when ${action}`,
                    {
                        ...logInfo,
                        warning: error,
                    }
                );
            } else {
                if (typeof error === 'object') {
                    const errorDetails: ErrorDetails = JSON.parse((error as Error).message);
                    logger.warn(
                        `Unexpected issue encountered when ${action}`,
                        {
                            ...logInfo,
                            warning: errorDetails.errorMessage,
                        }
                    );
                } else {
                    logger.warn(
                        `Unexpected issue encountered when ${action}`,
                        {
                            ...logInfo,
                            warning: error,
                        }
                    );
                }
            }
        } else if (folder === AccessLayer.Services) {
            if (rawSQL) {
                logger.error(
                    `Unexpected issue encountered when ${action}`,
                    {
                        ...logInfo,
                        error: error,
                    }
                );
            } else {
                if (typeof error === 'object') {
                    const errorDetails: ErrorDetails = JSON.parse((error as Error).message);
                    logger.error(
                        `Unexpected issue encountered when ${action}`,
                        {
                            ...logInfo,
                            error: errorDetails,
                        }
                    );
                } else {
                    logger.error(
                        `Unexpected issue encountered when ${action}`,
                        {
                            ...logInfo,
                            error: error,
                        }
                    );
                }
            }
        } else if (folder === AccessLayer.Utilities) {
            logger.error(
                `Unexpected issue encountered when ${action}`,
                {
                    ...logInfo,
                    error: error.message,
                }
            );
        }
    } else {
        logger.info(
            `${action} successfully`,
            logInfo
        );
    }
}

function getLogFileName() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return path.join(__dirname, `../../../log/server-log-${dateStr}.log`);
}
