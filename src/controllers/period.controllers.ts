import { Request, Response } from "express";
import { Period } from "../interface/Period";
import { PeriodService } from "../services/periodService";
import { AccessLayer, serverError } from "../constants/global";
import { isNumberValid, isValidDateTimeFormat } from "../utils/utils.function";
import { logHelper } from "../middleware/logger";
import { ErrorDetails } from "../utils/utils.error";
import { App } from "../app";

export async function getAllSessions(req: Request, res: Response) {
	try {
		const activeSessions = await PeriodService.getActiveSessions();
		res.json({
			sessions: activeSessions,
		});
		logHelper(
			`GET ${req.originalUrl}`,
			"getAllSessions",
			AccessLayer.Controllers
		);
	} catch (error) {
		console.error(error);
		res.status(500).json(serverError);
		logHelper(
			`GET ${req.originalUrl}`,
			"getAllSessions",
			AccessLayer.Controllers,
			error
		);
	}
}

export async function createPeriod(req: Request, res: Response) {
	const requestPayload: Period = req.body;
	try {
		const validSessions = await PeriodService.getActiveSessions();

		if (
			!isNumberValid(Number(requestPayload.year)) || !isNumberValid(Number(requestPayload.enablerWeightage)) ||
			!isNumberValid(Number(requestPayload.resultWeightage))
		) {
			logHelper(
				`POST ${req.originalUrl}`,
				"createPeriod",
				AccessLayer.Controllers
			);
			return res.status(400).json({ message: "Invalid request" });
		}

		if (Number(requestPayload.enablerWeightage) + Number(requestPayload.resultWeightage) !== 100) {
			logHelper(
				`POST ${req.originalUrl}`,
				"createPeriod",
				AccessLayer.Controllers
			);
			return res.status(400).json({ message: "Invalid request" });
		}

		const invalidCharacters = /[?\/]/;
        if (invalidCharacters.test(requestPayload.yearSession)) {
            logHelper(`POST ${req.originalUrl}`, 'createPeriod', AccessLayer.Controllers, "Invalid request");
            return res.status(400).json(
                { message: "Invalid request" }
            );
        }

		if (
			!isValidDateTimeFormat(requestPayload.auditStartDate) ||
			!isValidDateTimeFormat(requestPayload.auditEndDate) ||
			!isValidDateTimeFormat(requestPayload.selfAuditStartDate) ||
			!isValidDateTimeFormat(requestPayload.selfAuditEndDate)
		) {
			logHelper(
				`POST ${req.originalUrl}`,
				"createPeriod",
				AccessLayer.Controllers
			);
			return res.status(400).json({ message: "Invalid request" });
		}

		if (Array.isArray(validSessions)) {
			const isDuplicated = validSessions.some(
				(session) =>
					session.yearSession.toLowerCase() ===
					requestPayload.yearSession.toLowerCase()
			);
			if (isDuplicated) {
				logHelper(
					`POST ${req.originalUrl}`,
					"createPeriod",
					AccessLayer.Controllers
				);
				return res.status(409).json({ message: "Invalid action" });
			}
		}

		const values = [
			[
				requestPayload.yearSession,
				requestPayload.auditStartDate,
				requestPayload.auditEndDate,
				requestPayload.selfAuditStartDate,
				requestPayload.selfAuditEndDate,
				requestPayload.year,
				requestPayload.enablerWeightage,
				requestPayload.resultWeightage
			],
		];
		await PeriodService.createSession(values);

		const sessionInfo = await PeriodService.getSession(
			requestPayload.yearSession
		);

		await App.updateQueue();
		res.status(200).json({ ...sessionInfo });
		logHelper(
			`POST ${req.originalUrl}`,
			"createPeriod",
			AccessLayer.Controllers
		);
	} catch (error) {
		const errorDetails: ErrorDetails = JSON.parse((error as Error).message);

		if (errorDetails.details.sqlState === "45000") {
			res.status(400).json({ message: errorDetails.details.sqlMessage });
		} else {
			res.status(500).json(serverError);
		}
		console.error(error);
		logHelper(
			`POST ${req.originalUrl}`,
			"createPeriod",
			AccessLayer.Controllers,
			error
		);
	}
}

export async function editPeriod(req: Request, res: Response) {
	const requestPayload: Period = req.body;
	const sessionID = req.body.yearSession;

	try {
		const existingSession = await PeriodService.getSession(sessionID);
		if (!existingSession) {
			logHelper(
				`PATCH ${req.originalUrl}`,
				"editPeriod",
				AccessLayer.Controllers,
				"Invalid request"
			);
			return res.status(404).json({ message: "Invalid session" });
		}

		if (
			!isNumberValid(Number(requestPayload.year)) || !isNumberValid(Number(requestPayload.enablerWeightage)) ||
			!isNumberValid(Number(requestPayload.resultWeightage))
		) {
			logHelper(
				`PATCH ${req.originalUrl}`,
				"editPeriod",
				AccessLayer.Controllers,
				"Invalid request"
			);
			return res.status(400).json({ message: "Invalid request" });
		}

		if (Number(requestPayload.enablerWeightage) + Number(requestPayload.resultWeightage) !== 100) {
			logHelper(
				`PATCH ${req.originalUrl}`,
				"editPeriod",
				AccessLayer.Controllers,
				"Invalid request"
			);
			return res.status(400).json({ message: "Invalid request" });
		}

		const invalidCharacters = /[?\/]/;
        if (invalidCharacters.test(requestPayload.yearSession)) {
            logHelper(`PATCH ${req.originalUrl}`, 'editPeriod', AccessLayer.Controllers, "Invalid request");
            return res.status(400).json(
                { message: "Invalid request" }
            );
        }

		if (
			!isValidDateTimeFormat(requestPayload.auditStartDate) ||
			!isValidDateTimeFormat(requestPayload.auditEndDate) ||
			!isValidDateTimeFormat(requestPayload.selfAuditStartDate) ||
			!isValidDateTimeFormat(requestPayload.selfAuditEndDate)
		) {
			logHelper(
				`PATCH ${req.originalUrl}`,
				"editPeriod",
				AccessLayer.Controllers
			);
			return res.status(400).json({ message: "Invalid request" });
		}

		const updatedPeriod: Period = {
			...existingSession,
			year: requestPayload.year,
			auditStartDate: requestPayload.auditStartDate,
			auditEndDate: requestPayload.auditEndDate,
			selfAuditStartDate: requestPayload.selfAuditStartDate,
			selfAuditEndDate: requestPayload.selfAuditEndDate,
			enablerWeightage: requestPayload.enablerWeightage,
			resultWeightage: requestPayload.resultWeightage
		};

		const values = [
			updatedPeriod.auditStartDate,
			updatedPeriod.auditEndDate,
			updatedPeriod.selfAuditStartDate,
			updatedPeriod.selfAuditEndDate,
			updatedPeriod.year,
			updatedPeriod.enablerWeightage,
			updatedPeriod.resultWeightage
		];

		const result = await PeriodService.updateSession(sessionID, values);

		if (result) {
			const sessionInfo = await PeriodService.getSession(sessionID);
			await App.updateQueue();
			res.status(200).json({
				...sessionInfo,
			});
			logHelper(
				`PATCH ${req.originalUrl}`,
				"editPeriod",
				AccessLayer.Controllers
			);
		}
	} catch (error) {
		const errorDetails: ErrorDetails = JSON.parse((error as Error).message);

		if (errorDetails.details.sqlState === "45000") {
			res.status(400).json({ message: errorDetails.details.sqlMessage });
		} else {
			res.status(500).json(serverError);
		}
		console.error(error);
		logHelper(
			`PATCH ${req.originalUrl}`,
			"editPeriod",
			AccessLayer.Controllers,
			error
		);
	}
}

export async function deletePeriod(req: Request, res: Response) {
	const sessionID = String(req.query.session);

	try {
		const existingSession = await PeriodService.getSession(sessionID);
		if (!existingSession) {
			logHelper(
				`POST ${req.originalUrl}`,
				"deletePeriod",
				AccessLayer.Controllers
			);
			return res.status(404).json({ message: "Invalid session" });
		}

		const result = await PeriodService.removePeriod(sessionID);

		if (result) {
			await App.updateQueue();
			res.json({ ...existingSession });
			logHelper(
				`POST ${req.originalUrl}`,
				"deletePeriod",
				AccessLayer.Controllers
			);
		}
	} catch (error) {
		console.error(error);
		res.status(500).json(serverError);
		logHelper(
			`POST ${req.originalUrl}`,
			"deletePeriod",
			AccessLayer.Controllers,
			error
		);
	}
}

export async function getCurrentPeriodSession(req: Request, res: Response) {
	try {
		const result = await PeriodService.getCurrentPeriodSession();
		const currentPeriodSession: Period = result[0] as Period;
		if (currentPeriodSession === undefined) {
			const temp = await PeriodService.getLatestPeriodSession();
			const lastPeriodSession: Period = temp[0] as Period;
			if (lastPeriodSession === undefined) {
				// No periods available at all
				res.json(null);
			} else {
				lastPeriodSession.isCurrentPeriod = false;
				res.json(lastPeriodSession);
			}
		} else {
			currentPeriodSession.isCurrentPeriod = true;
			res.json(currentPeriodSession);
		}
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Error fetching current sessions" });
	}
}

export async function filterUpcomingSession() {
	//To get all upcoming sessions
	let upcomingSessions: Period[] = [];
	const activeSessions = await PeriodService.getActiveSessions();
	const currentDate = new Date().getTime();

	if (Array.isArray(activeSessions)) {
		upcomingSessions = activeSessions
			.filter((session) => {
				const selfAuditStartDate = new Date(
					session.selfAuditStartDate
				).getTime();
				return selfAuditStartDate >= currentDate;
			})
			.sort((a, b) => {
				const selfAuditStartDateA = new Date(a.selfAuditStartDate);
				const selfAuditStartDateB = new Date(b.selfAuditStartDate);
				return selfAuditStartDateA.getTime() - selfAuditStartDateB.getTime();
			});
	}
	return upcomingSessions;
}
