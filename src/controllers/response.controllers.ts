import { Request, response, Response } from 'express';
import { AuditorRecommendationAndComment, FormResponse, FormResponseDetails, QuestionResponse, QuestionResponseDB, ResponseCriterion, ResponseSubCriterion, ResultQuestionResponse, SavedResponse, SavedResultResponse } from '../interface/Response';
import { FormResponseService } from "../services/formResponseService";
import { PeriodService } from "../services/periodService";
import { FileService } from "../services/fileService";
import { NewFormResponse, NewQuestionResponse } from "../constants/dataType";
import { AccessLayer, serverError } from '../constants/global';
import { logHelper } from '../middleware/logger';
import { UserService } from '../services/userService';
import { EmailService } from '../services/emailService';
import { FormService } from '../services/formService';
import { ProgressOverviewService } from '../services/progressOverviewService';
import { RowDataPacket } from 'mysql2';


interface QuestionResponseDetails {
    criterionID: number,
    questionResponseDetails: {
        [subCriterionID: number]: number[]
    }
}

export async function getFormResponseDetails(req: Request, res: Response) {
    try {
        const formId = req.params.formId;
        const groupId = req.params.groupId;
        const respectiveGroupId = req.params.respectiveGroupId
        const yearSession = req.params.yearSession;

        const tempFormResponse = await FormResponseService.getFormResponses(+formId, yearSession);
        if (!tempFormResponse || !tempFormResponse.length)
            return res.json(null);

        const formResponse: FormResponse[] = tempFormResponse.filter((fr: FormResponse) => fr.groupID === +groupId && fr.respectiveGroupID === +respectiveGroupId);
        if (!formResponse || !formResponse.length) {
            return res.json(null);
        }

        const questionResponse = await FormResponseService.getQuestionResponse(formResponse[0].formResponseID);
        await FormResponseService.updateInSession(formResponse[0].formResponseID, true);
        resetSessionTimer(formResponse[0].formResponseID, true);
        formResponse[0].inSession = true;
        formResponse[0].submitted = formResponse[0].submitted ? true : false;
        if (!questionResponse || !questionResponse.length)
            return res.json(formResponse[0]);

        const questionResponseDetails = await FormResponseService.getEnablerResponseDetails(formResponse[0].formResponseID);

        if (groupId === respectiveGroupId) {
            const checkAuditCompleted = await FormResponseService.checkAuditCompleted(+respectiveGroupId, +formId);
            const checkRejected = await FormResponseService.checkResponseRejected(+respectiveGroupId, +formId);
            formResponse[0].rejected = checkRejected[0].isRejected ? true : false;
            if (formResponse[0].rejected)
                formResponse[0].respectiveAuditGroupID = checkRejected[0].groupID ? checkRejected[0].groupID : -1;
            formResponse[0].auditCompleted = checkAuditCompleted[0].isCompleted ? true : false;
            if (formResponse[0].auditCompleted)
                formResponse[0].respectiveAuditGroupID = checkAuditCompleted[0].groupID ? checkAuditCompleted[0].groupID : -1;
        }

        const getEvidenceFiles = async (questionResponseID: number) => {
            return await FileService.getEvidenceInfo(questionResponseID);
        };

        let questionResponseWithEvidence = await Promise.all(questionResponse.map(async (qr: QuestionResponseDB) => {
            const evidenceFiles = await getEvidenceFiles(qr.questionResponseID);
            return {
                questionResponseID: qr.questionResponseID,
                questionID: qr.questionID,
                scale: qr.scale,
                uploadedEvidenceFiles: evidenceFiles ? evidenceFiles : [],
                remark: qr.remark,
            };
        }));

        res.json({
            ...formResponse[0],
            details: {
                criterion: questionResponseDetails.map((qrd: QuestionResponseDetails) => {
                    let subCriterionIDs = Object.keys(qrd.questionResponseDetails);
                    return {
                        criterionID: qrd.criterionID,
                        subCriterion: subCriterionIDs.map((sc) => {
                            return {
                                subCriterionID: +sc,
                                questionResponse: questionResponseWithEvidence.filter((qr) =>
                                    qrd.questionResponseDetails[+sc].includes(qr.questionID)
                                )
                            }
                        })
                    }
                })
            },
        });
        logHelper(`GET ${req.originalUrl}`, 'getFormResponseDetails', AccessLayer.Controllers);
    } catch (error) {
        console.error('Error retrieving form response details:', error);
        res.status(500).send(serverError);
        logHelper(`GET ${req.originalUrl}`, 'getFormResponseDetails', AccessLayer.Controllers, error);
    }
};


let sessionTimerExpired = false;
interface TimerObject {
    formResponseID: number;
    timer: NodeJS.Timeout | undefined;
}

let timerObjectArray: TimerObject[] = [];

const resetSessionTimer = (formResponseID: number, resetTimer: boolean) => {
    if (resetTimer) {
        // Clear existing timer if it exists for the formResponseID
        const existingTimerIndex = timerObjectArray.findIndex(obj => obj.formResponseID === formResponseID);
        if (existingTimerIndex !== -1) {
            clearTimeout(timerObjectArray[existingTimerIndex].timer);
            timerObjectArray.splice(existingTimerIndex, 1);
        }

        const timer = setTimeout(async () => {
            await FormResponseService.updateInSession(formResponseID, false);
            sessionTimerExpired = true;
            // Remove the timer object from the array after it expires
            const expiredTimerIndex = timerObjectArray.findIndex(obj => obj.formResponseID === formResponseID);
            if (expiredTimerIndex !== -1) {
                timerObjectArray.splice(expiredTimerIndex, 1);
                logHelper(`POP TimerObject: ${formResponseID}`, 'resetSessionTimer', AccessLayer.Controllers);
            }
        }, 5 * 60 * 1000);

        // Store the timer object in the array
        timerObjectArray.push({ formResponseID, timer });
        logHelper(`PUSH TimerObject: ${formResponseID}`, 'resetSessionTimer', AccessLayer.Controllers);
        sessionTimerExpired = false;
    }
};

export async function resetTimer(req: Request, res: Response) {
    try {
        const reset = req.params.reset;
        const formResponseID = req.params.formResponseID;

        resetSessionTimer(+formResponseID, reset === "true" ? true : false);
        logHelper(`GET ${req.originalUrl}`, 'resetTimer', AccessLayer.Controllers);
        res.json({ message: 'Timer reset successfully - formResponseID: ', formResponseID });
    } catch (error) {
        logHelper(`GET ${req.originalUrl}`, 'resetTimer', AccessLayer.Controllers, error);
        console.error('Error resetting timer:', error);
        res.status(500).send(serverError);
    }
}

export async function getResultResponseDetails(req: Request, res: Response) {
    try {
        const formId = req.params.formId;
        const groupId = req.params.groupId;
        const respectiveGroupId = req.params.respectiveGroupId;
        const yearSession = req.params.yearSession;

        const timeline = await PeriodService.getSession(yearSession);

        const tempFormResponse = await FormResponseService.getFormResponses(+formId, yearSession);
        if (!tempFormResponse || !tempFormResponse.length)
            return res.json(null);

        const formResponse: FormResponse[] = tempFormResponse.filter((fr: FormResponse) => fr.groupID === +groupId && fr.respectiveGroupID === +respectiveGroupId);
        if (!formResponse || !formResponse.length) {
            return res.json(null);
        }

        const resultQuestionResponse = await FormResponseService.getResultQuestionResponse(formResponse[0].formResponseID);
        await FormResponseService.updateInSession(formResponse[0].formResponseID, true);
        resetSessionTimer(formResponse[0].formResponseID, true);
        if (!resultQuestionResponse || !resultQuestionResponse.length)
            return res.json(formResponse[0]);

        if (groupId === respectiveGroupId) {
            const checkAuditCompleted = await FormResponseService.checkAuditCompleted(+respectiveGroupId, +formId);
            const checkRejected = await FormResponseService.checkResponseRejected(+respectiveGroupId, +formId);
            formResponse[0].rejected = checkRejected[0].isRejected ? true : false;
            if (formResponse[0].rejected)
                formResponse[0].respectiveAuditGroupID = checkRejected[0].groupID ? checkRejected[0].groupID : -1;
            formResponse[0].auditCompleted = checkAuditCompleted[0].isCompleted ? true : false;
            if (formResponse[0].auditCompleted)
                formResponse[0].respectiveAuditGroupID = checkAuditCompleted[0].groupID ? checkAuditCompleted[0].groupID : -1;
        }

        const getResultEvidenceFiles = async (resultQuestionResponseID: number) => {
            return await FileService.getResultEvidenceInfo(resultQuestionResponseID);
        };

        const resultResponseWithEvidence = await Promise.all(resultQuestionResponse.map(async (rqr: ResultQuestionResponse) => {
            const evidenceFiles = await getResultEvidenceFiles(rqr.resultQuestionResponseID);
            return {
                resultQuestionResponseID: rqr.resultQuestionResponseID,
                resultQuestionID: rqr.resultQuestionID,
                scale: rqr.scale,
                uploadedResultEvidences: evidenceFiles ? evidenceFiles : [],
                remark: rqr.remark,
            };
        }));

        res.json({
            ...formResponse[0],
            details: {
                result: resultResponseWithEvidence
            }
        });
        logHelper(`GET ${req.originalUrl}`, 'getResultResponseDetails', AccessLayer.Controllers);
    } catch (error) {
        console.error('Error retrieving form response details:', error);
        res.status(500).send(serverError);
        logHelper(`GET ${req.originalUrl}`, 'getResultResponseDetails', AccessLayer.Controllers, error);
    }
}

export async function getRecommendationAndComment(req: Request, res: Response) {
    const groupID = req.params.groupID;
    const formID = req.params.formID;
    const yearSession = req.params.yearSession;
    try {
        const response = await FormResponseService.getFormResponses(+formID, yearSession);
        const auditorResponses: AuditorRecommendationAndComment[] = [];

        response.forEach((toReturn: {
            groupID: number;
            respectiveGroupID: number;
            reflection_recommendation: string;
            action_comment: string;
        }) => {
            if (toReturn.groupID !== toReturn.respectiveGroupID && toReturn.respectiveGroupID === +groupID) {
                auditorResponses.push({
                    auditorGroupID: toReturn.groupID,
                    ptjGroupID: +groupID,
                    recommendation: toReturn.reflection_recommendation,
                    comment: toReturn.action_comment,
                    yearSession: yearSession
                });
            }
        });
        res.json(auditorResponses);
        logHelper(`GET ${req.originalUrl}`, 'getRecommendationAndComment', AccessLayer.Controllers);
    } catch (error) {
        console.log(error);
        logHelper(`GET ${req.originalUrl}`, 'getRecommendationAndComment', AccessLayer.Controllers, error);
    }
}

export async function checkInSession(req: Request, res: Response) {
    try {
        const formResponseID = req.params.formResponseID;
        if (!isNaN(+formResponseID)) {
            const response = await FormResponseService.getInSession(+formResponseID);
            res.json(response);
            logHelper(`GET ${req.originalUrl}`, 'checkInSession', AccessLayer.Controllers);
        } else
            res.status(400).json({ error: 'No formResponseID' });
    } catch (error) {
        console.log(error);
        logHelper(`GET ${req.originalUrl}`, 'checkInSession', AccessLayer.Controllers, error);
    }
}

export async function resetInSession(req: Request, res: Response) {
    try {
        const formResponseID = req.params.formResponseID;
        await FormResponseService.updateInSession(+formResponseID, false);
        res.json({
            message: "inSession updated to false"
        })
        logHelper(`PATCH ${req.originalUrl}`, 'resetInSession', AccessLayer.Controllers);
    } catch (error) {
        console.log(error);
        logHelper(`PATCH ${req.originalUrl}`, 'resetInSession', AccessLayer.Controllers, error);
    }
}

export async function saveFormResponseDetails(req: Request, res: Response) {
    const formResponseToSave: SavedResponse = req.body;
    let savedFormResponseID: number;
    try {
        const currentYearSession = await PeriodService.getCurrentYearSession();
        const selectedSession = await PeriodService.getSession(formResponseToSave.yearSession);
        const currentDate = new Date();

        if ((formResponseToSave.yearSession !== currentYearSession[0].yearSession)) {
            return res.status(400).json(
                { message: "Invalid save - Invalid year session" }
            )
        }

        if (formResponseToSave.formResponse.groupID === formResponseToSave.formResponse.respectiveGroupID) {
            if (currentDate < new Date(selectedSession.selfAuditStartDate) || currentDate > new Date(selectedSession.selfAuditEndDate)) {
                return res.status(400).json(
                    { message: "Invalid save - Invalid self-audit date" }
                )
            }
        }
        else {
            if (currentDate < new Date(selectedSession.auditStartDate) || currentDate > new Date(selectedSession.auditEndDate)) {
                return res.status(400).json(
                    { message: "Invalid save - Invalid audit date" }
                )
            }
        }

        // First form response, no such response before
        if (!formResponseToSave.formResponse.formResponseID) {
            const newformResponse: NewFormResponse = [
                formResponseToSave.formResponse.groupID,
                formResponseToSave.formResponse.submitted,
                formResponseToSave.formResponse.inSession,
                formResponseToSave.formResponse.formID,
                formResponseToSave.formResponse.respectiveGroupID,
                formResponseToSave.formResponse.reflection_recommendation,
                formResponseToSave.formResponse.action_comment
            ];
            const insertedFormResponseId = await FormResponseService.createNewFormResponse(newformResponse);
            savedFormResponseID = insertedFormResponseId;
            resetSessionTimer(savedFormResponseID, true);

            const questionResponseArr: NewQuestionResponse[] = [];
            formResponseToSave.responseDetails.details.criterion.map((c: ResponseCriterion) => {
                c.subCriterion.map((sc: ResponseSubCriterion) => {
                    sc.questionResponse.map((qr: QuestionResponse) => {
                        const newQuestionResponse: NewQuestionResponse = [
                            qr.scale,
                            qr.remark,
                            insertedFormResponseId,
                            qr.questionID
                        ]
                        questionResponseArr.push(newQuestionResponse);
                    })
                })
            })
            await FormResponseService.addNewQuestionResponse(questionResponseArr);
        }
        else {
            const removedFileIDs = formResponseToSave.fileIDsToRemove;
            if (removedFileIDs && removedFileIDs.length > 0) {
                removedFileIDs.map(async (fileID: number) => {
                    await FileService.deleteEvidence(fileID);
                })
            };

            //Form Response Reject
            if (formResponseToSave.ptjFormResponseID && formResponseToSave.rejected) {
                await FormResponseService.patchSubmitted(formResponseToSave.ptjFormResponseID, false);
                await FormResponseService.updateToCurrentDateTime(formResponseToSave.formResponse.formResponseID, currentDate);
                await FormResponseService.updateToCurrentDateTime(formResponseToSave.ptjFormResponseID, currentDate);

                const getNotifyEmails = await UserService.getNotifyEmails(formResponseToSave.formResponse.respectiveGroupID, formResponseToSave.yearSession)
                const ptjEmailsArray = getNotifyEmails[0].ptjEmails.split(',');
                const auditorEmailsArray = getNotifyEmails[0].auditorEmails.split(',');
                const ptjGroup = await UserService.getUserGroup(formResponseToSave.formResponse.respectiveGroupID);
                const form = await FormService.getFormInfo(formResponseToSave.formResponse.formID);
                await EmailService.notifyFormRejected(ptjEmailsArray, auditorEmailsArray, ptjGroup!.groupName, form.title, formResponseToSave.yearSession);
            }

            await FormResponseService.updateFormResponse(
                formResponseToSave.formResponse.formResponseID,
                formResponseToSave.formResponse.reflection_recommendation,
                formResponseToSave.formResponse.action_comment);

            savedFormResponseID = formResponseToSave.formResponse.formResponseID;
            // Form response already exist, update question response
            formResponseToSave.responseDetails.details.criterion.map((c: ResponseCriterion) => {
                c.subCriterion.map((sc: ResponseSubCriterion) => {
                    sc.questionResponse.map(async (qr: QuestionResponse) => {
                        if (qr.changesMade) {
                            await FormResponseService.updateQuestionResponse(
                                formResponseToSave.formResponse.formResponseID,
                                qr.questionID,
                                qr.scale,
                                qr.remark
                            );
                            const updatedResponseId = await FormResponseService.getQuestionResponseID(formResponseToSave.formResponse.formResponseID, qr.questionID);
                            let result = 0;
                            if (Array.isArray(qr.evidenceFiles) && qr.evidenceFiles.length > 0) {
                                result = await FileService.createEvidence(updatedResponseId, qr.evidenceFiles);
                                console.log("result: " + result);
                            }
                        }
                        else if (qr.scale <= -1) {
                            await FormResponseService.updateQuestionResponse(
                                formResponseToSave.formResponse.formResponseID,
                                qr.questionID,
                                qr.scale,
                                qr.remark
                            );
                        }
                    })
                })
            })
        }
        res.json({
            message: 'Form saved successfully',
            formResponseToSave,
            savedFormResponseID
        });
        logHelper(`POST ${req.originalUrl}`, 'saveFormResponseDetails', AccessLayer.Controllers);
    } catch (error) {
        console.log(error);
        res.status(500).send(serverError);
        logHelper(`POST ${req.originalUrl}`, 'saveFormResponseDetails', AccessLayer.Controllers, error);
    }
}

export async function saveResultResponseDetails(req: Request, res: Response) {
    const resultResponseToSave: SavedResultResponse = req.body;
    let savedFormResponseID: number;

    try {
        const currentYearSession = await PeriodService.getCurrentYearSession();
        const selectedSession = await PeriodService.getSession(resultResponseToSave.yearSession);
        const currentDate = new Date();

        if (resultResponseToSave.yearSession !== currentYearSession[0].yearSession) {
            return res.status(400).json(
                { message: "Invalid save" }
            )
        }

        if (resultResponseToSave.formResponse.groupID === resultResponseToSave.formResponse.respectiveGroupID) {
            if (currentDate < new Date(selectedSession.selfAuditStartDate) || currentDate > new Date(selectedSession.selfAuditEndDate)) {
                return res.status(400).json(
                    { message: "Invalid save" }
                )
            }
        }
        else {
            if (currentDate < new Date(selectedSession.auditStartDate) || currentDate > new Date(selectedSession.auditEndDate)) {
                return res.status(400).json(
                    { message: "Invalid save" }
                )
            }
        }

        // First form response, no such response before
        if (!resultResponseToSave.formResponse.formResponseID) {
            const newformResponse: NewFormResponse = [
                resultResponseToSave.formResponse.groupID,
                resultResponseToSave.formResponse.submitted,
                resultResponseToSave.formResponse.inSession,
                resultResponseToSave.formResponse.formID,
                resultResponseToSave.formResponse.respectiveGroupID,
                resultResponseToSave.formResponse.reflection_recommendation,
                resultResponseToSave.formResponse.action_comment
            ];
            const insertedFormResponseId = await FormResponseService.createNewFormResponse(newformResponse);
            savedFormResponseID = insertedFormResponseId;
            resetSessionTimer(savedFormResponseID, true);

            const questionResponseArr: NewQuestionResponse[] = [];
            resultResponseToSave.responseDetails.details.result.map((rqr: ResultQuestionResponse) => {
                const newQuestionResponse: NewQuestionResponse = [
                    rqr.scale,
                    rqr.remark,
                    insertedFormResponseId,
                    rqr.resultQuestionID
                ]
                questionResponseArr.push(newQuestionResponse);
            })
            await FormResponseService.addNewResultQuestionResponse(questionResponseArr);
        }
        else {
            const removedFileIDs = resultResponseToSave.fileIDsToRemove;
            if (removedFileIDs && removedFileIDs.length > 0) {
                removedFileIDs.map(async (fileID: number) => {
                    await FileService.deleteResultEvidence(fileID);
                })
            };

            if (resultResponseToSave.ptjFormResponseID && resultResponseToSave.rejected) {
                await FormResponseService.patchSubmitted(resultResponseToSave.ptjFormResponseID, false);
                await FormResponseService.updateToCurrentDateTime(resultResponseToSave.formResponse.formResponseID, currentDate);
                await FormResponseService.updateToCurrentDateTime(resultResponseToSave.ptjFormResponseID, currentDate);

                const getNotifyEmails = await UserService.getNotifyEmails(resultResponseToSave.formResponse.respectiveGroupID, resultResponseToSave.yearSession)
                const ptjEmailsArray = getNotifyEmails[0].ptjEmails.split(',');
                const auditorEmailsArray = getNotifyEmails[0].auditorEmails.split(',');
                const ptjGroup = await UserService.getUserGroup(resultResponseToSave.formResponse.respectiveGroupID);
                const form = await FormService.getFormInfo(resultResponseToSave.formResponse.formID);
                await EmailService.notifyFormRejected(ptjEmailsArray, auditorEmailsArray, ptjGroup!.groupName, form.title, resultResponseToSave.yearSession);
            }

            await FormResponseService.updateFormResponse(
                resultResponseToSave.formResponse.formResponseID,
                resultResponseToSave.formResponse.reflection_recommendation,
                resultResponseToSave.formResponse.action_comment);

            savedFormResponseID = resultResponseToSave.formResponse.formResponseID;
            resultResponseToSave.responseDetails.details.result.map(async (rqr: ResultQuestionResponse) => {
                if (rqr.changesMade) {
                    await FormResponseService.updateResultQuestionResponse(
                        resultResponseToSave.formResponse.formResponseID,
                        rqr.resultQuestionID,
                        rqr.scale,
                        rqr.remark
                    );
                    const updatedResponseId = await FormResponseService.getResultQuestionResponseID(resultResponseToSave.formResponse.formResponseID, rqr.resultQuestionID);
                    let result = 0;
                    if (Array.isArray(rqr.evidences) && rqr.evidences.length > 0) {
                        result = await FileService.createResultEvidence(updatedResponseId, rqr.evidences);
                        console.log("result: " + result);
                    }
                }
            })
        }
        res.json(
            {
                message: 'Form saved successfully',
                resultResponseToSave,
                savedFormResponseID
            }
        );
        logHelper(`POST ${req.originalUrl}`, 'saveResultResponseDetails', AccessLayer.Controllers);
    } catch (error) {
        console.log(error)
        res.status(500).send(serverError);
        logHelper(`POST ${req.originalUrl}`, 'saveResultResponseDetails', AccessLayer.Controllers, error);
    }
}

export async function submitFormResponseDetails(req: Request, res: Response) {
    const formResponseToSave: SavedResponse = req.body;
    try {
        const currentYearSession = await PeriodService.getCurrentYearSession();
        const selectedSession = await PeriodService.getSession(formResponseToSave.yearSession);
        const currentDate = new Date();
        const groupID = formResponseToSave.formResponse.groupID;
        const groupInfo = await UserService.getUserGroup(groupID);

        if (formResponseToSave.yearSession !== currentYearSession[0].yearSession) {
            return res.status(400).json(
                { message: "Invalid save" }
            )
        }

        if (formResponseToSave.formResponse.groupID === formResponseToSave.formResponse.respectiveGroupID) {
            if (currentDate < new Date(selectedSession.selfAuditStartDate) || currentDate > new Date(selectedSession.selfAuditEndDate)) {
                return res.status(400).json(
                    { message: "Invalid save" }
                )
            }
        }
        else {
            if (currentDate < new Date(selectedSession.auditStartDate) || currentDate > new Date(selectedSession.auditEndDate)) {
                return res.status(400).json(
                    { message: "Invalid save" }
                )
            }
        }

        // First form response, no such response before
        if (!formResponseToSave.formResponse.formResponseID) {
            const newformResponse: NewFormResponse = [
                formResponseToSave.formResponse.groupID,
                true,
                formResponseToSave.formResponse.inSession,
                formResponseToSave.formResponse.formID,
                formResponseToSave.formResponse.respectiveGroupID,
                formResponseToSave.formResponse.reflection_recommendation,
                formResponseToSave.formResponse.action_comment
            ];
            const insertedFormResponseId = await FormResponseService.createNewFormResponse(newformResponse);

            const questionResponseArr: NewQuestionResponse[] = [];
            formResponseToSave.responseDetails.details.criterion.map((c: ResponseCriterion) => {
                c.subCriterion.map((sc: ResponseSubCriterion) => {
                    sc.questionResponse.map((qr: QuestionResponse) => {
                        const newQuestionResponse: NewQuestionResponse = [
                            qr.scale,
                            qr.remark,
                            insertedFormResponseId,
                            qr.questionID
                        ]
                        questionResponseArr.push(newQuestionResponse);
                    })
                })
            })
            await FormResponseService.addNewQuestionResponse(questionResponseArr);
        }
        else {
            const removedFileIDs = formResponseToSave.fileIDsToRemove;
            if (removedFileIDs && removedFileIDs.length > 0) {
                removedFileIDs.map(async (fileID: number) => {
                    await FileService.deleteEvidence(fileID);
                })
            };
            // Form response already exist, update question response
            await FormResponseService.updateFormResponse(
                formResponseToSave.formResponse.formResponseID,
                formResponseToSave.formResponse.reflection_recommendation,
                formResponseToSave.formResponse.action_comment);

            await FormResponseService.submitFormResponse(formResponseToSave.formResponse.formResponseID, true);
            formResponseToSave.responseDetails.details.criterion.map((c: ResponseCriterion) => {
                c.subCriterion.map((sc: ResponseSubCriterion) => {
                    sc.questionResponse.map(async (qr: QuestionResponse) => {
                        if (qr.changesMade) {
                            await FormResponseService.updateQuestionResponse(
                                formResponseToSave.formResponse.formResponseID,
                                qr.questionID,
                                qr.scale,
                                qr.remark
                            );
                            const updatedResponseId = await FormResponseService.getQuestionResponseID(formResponseToSave.formResponse.formResponseID, qr.questionID);
                            let result = 0;
                            if (Array.isArray(qr.evidenceFiles) && qr.evidenceFiles.length > 0) {
                                result = await FileService.createEvidence(updatedResponseId, qr.evidenceFiles);
                                console.log("result: " + result);
                            }
                        }
                    })
                })
            })
        }
        if (groupInfo?.role === "Auditor") {
            const getNotifyEmails = await UserService.getNotifyEmails(formResponseToSave.formResponse.respectiveGroupID, formResponseToSave.yearSession)
            const ptjEmailsArray = getNotifyEmails[0].ptjEmails ? getNotifyEmails[0].ptjEmails.split(',') : [];
            const auditorEmailsArray = getNotifyEmails[0].auditorEmails ? getNotifyEmails[0].auditorEmails.split(',') : [];
            const ptjGroup = await UserService.getUserGroup(formResponseToSave.formResponse.respectiveGroupID);
            const form = await FormService.getFormInfo(formResponseToSave.formResponse.formID);
            if (ptjEmailsArray.length !== 0)
                await EmailService.notifyFormAssessed(ptjEmailsArray, ptjGroup!.groupName, form.title, formResponseToSave.yearSession);

            const allFormSubmitted = await checkAllFormSubmitted(formResponseToSave.formResponse.respectiveGroupID, formResponseToSave.yearSession);
            const allFormSubmittedStat = allFormSubmitted.length === 0 ? -1 : allFormSubmitted[0].auditStat;
            const allCommented = allFormSubmitted.length === 0 ? false : allFormSubmitted[0].commented;
            if (allFormSubmittedStat === 2) {
                if (auditorEmailsArray.length !== 0 || ptjEmailsArray.length !== 0) {
                    await EmailService.notifyAssessmentDone(auditorEmailsArray, ptjEmailsArray, ptjGroup!.groupName, formResponseToSave.yearSession);
                    if (allCommented)
                        await EmailService.notifyOverallComment(auditorEmailsArray, ptjGroup!.groupName, formResponseToSave.yearSession)
                }
            }
        }
        else if (groupInfo?.role === "PTJ") {
            const getNotifyEmails = await UserService.getNotifyEmails(formResponseToSave.formResponse.respectiveGroupID, formResponseToSave.yearSession)
            const auditorEmailsArray = getNotifyEmails[0].auditorEmails ? getNotifyEmails[0].auditorEmails.split(',') : [];
            const ptjEmailsArray = getNotifyEmails[0].ptjEmails ? getNotifyEmails[0].ptjEmails.split(',') : [];
            const ptjGroup = await UserService.getUserGroup(formResponseToSave.formResponse.respectiveGroupID);
            const form = await FormService.getFormInfo(formResponseToSave.formResponse.formID);
            const yearSession = await PeriodService.getSession(formResponseToSave.yearSession);
            const assessmentPeriod = yearSession.auditStartDate + " ~ " + yearSession.auditEndDate
            if (auditorEmailsArray.length === 0)
                await EmailService.notifyPTJSubmitted(auditorEmailsArray, ptjGroup!.groupName, form.title, formResponseToSave.yearSession, assessmentPeriod);
            const allFormSubmitted = await checkAllFormSubmitted(formResponseToSave.formResponse.groupID, formResponseToSave.yearSession);
            const allFormSubmittedStat = allFormSubmitted.length === 0 ? -1 : allFormSubmitted[0].selfAuditStat;
            if (allFormSubmittedStat === 2) {
                if (auditorEmailsArray.length === 0 || ptjEmailsArray.length === 0)
                    await EmailService.notifyPTJSubmittedAll(ptjEmailsArray, auditorEmailsArray, ptjGroup!.groupName, formResponseToSave.yearSession);
            }
        }
        res.json(
            {
                message: 'Form submitted successfully',
                formResponseToSave
            }
        );
        logHelper(`POST ${req.originalUrl}`, 'submitFormResponseDetails', AccessLayer.Controllers);
    } catch (error) {
        console.log(error);
        res.status(500).send(serverError);
        logHelper(`POST ${req.originalUrl}`, 'submitFormResponseDetails', AccessLayer.Controllers, error);
    }
}

export async function submitResultResponseDetails(req: Request, res: Response) {
    const resultResponseToSave: SavedResultResponse = req.body;
    try {
        const currentYearSession = await PeriodService.getCurrentYearSession();
        const selectedSession = await PeriodService.getSession(resultResponseToSave.yearSession);
        const currentDate = new Date();
        const groupID = resultResponseToSave.formResponse.groupID;
        const groupInfo = await UserService.getUserGroup(groupID);

        if (resultResponseToSave.yearSession !== currentYearSession[0].yearSession) {
            return res.status(400).json(
                { message: "Invalid save" }
            )
        }

        if (resultResponseToSave.formResponse.groupID === resultResponseToSave.formResponse.respectiveGroupID) {
            if (currentDate < new Date(selectedSession.selfAuditStartDate) || currentDate > new Date(selectedSession.selfAuditEndDate)) {
                return res.status(400).json(
                    { message: "Invalid save" }
                )
            }
        }
        else {
            if (currentDate < new Date(selectedSession.auditStartDate) || currentDate > new Date(selectedSession.auditEndDate)) {
                return res.status(400).json(
                    { message: "Invalid save" }
                )
            }
        }
        // First form response, no such response before
        if (!resultResponseToSave.formResponse.formResponseID) {
            const newformResponse: NewFormResponse = [
                resultResponseToSave.formResponse.groupID,
                resultResponseToSave.formResponse.submitted,
                resultResponseToSave.formResponse.inSession,
                resultResponseToSave.formResponse.formID,
                resultResponseToSave.formResponse.respectiveGroupID,
                resultResponseToSave.formResponse.reflection_recommendation,
                resultResponseToSave.formResponse.action_comment
            ];
            const insertedFormResponseId = await FormResponseService.createNewFormResponse(newformResponse);

            const questionResponseArr: NewQuestionResponse[] = [];
            resultResponseToSave.responseDetails.details.result.map((rqr: ResultQuestionResponse) => {
                const newQuestionResponse: NewQuestionResponse = [
                    rqr.scale,
                    rqr.remark,
                    insertedFormResponseId,
                    rqr.resultQuestionID
                ]
                questionResponseArr.push(newQuestionResponse);
            })
            await FormResponseService.addNewResultQuestionResponse(questionResponseArr);
        }
        else {
            const removedFileIDs = resultResponseToSave.fileIDsToRemove;
            if (removedFileIDs && removedFileIDs.length > 0) {
                removedFileIDs.map(async (fileID: number) => {
                    await FileService.deleteResultEvidence(fileID);
                })
            };

            if (resultResponseToSave.ptjFormResponseID && resultResponseToSave.rejected)
                await FormResponseService.patchSubmitted(resultResponseToSave.ptjFormResponseID, false);

            // Form response already exist, update question response
            await FormResponseService.updateFormResponse(
                resultResponseToSave.formResponse.formResponseID,
                resultResponseToSave.formResponse.reflection_recommendation,
                resultResponseToSave.formResponse.action_comment);

            await FormResponseService.submitFormResponse(resultResponseToSave.formResponse.formResponseID, true);
            resultResponseToSave.responseDetails.details.result.map(async (rqr: ResultQuestionResponse) => {
                if (rqr.changesMade) {
                    await FormResponseService.updateResultQuestionResponse(
                        resultResponseToSave.formResponse.formResponseID,
                        rqr.resultQuestionID,
                        rqr.scale,
                        rqr.remark
                    );
                    const updatedResponseId = await FormResponseService.getResultQuestionResponseID(resultResponseToSave.formResponse.formResponseID, rqr.resultQuestionID);
                    let result = 0;
                    if (Array.isArray(rqr.evidences) && rqr.evidences.length > 0) {
                        result = await FileService.createResultEvidence(updatedResponseId, rqr.evidences);
                        console.log("result: " + result);
                    }
                }
            })
        }
        if (groupInfo?.role === "Auditor") {
            const getNotifyEmails = await UserService.getNotifyEmails(resultResponseToSave.formResponse.respectiveGroupID, resultResponseToSave.yearSession)
            const ptjEmailsArray = getNotifyEmails[0].ptjEmails ? getNotifyEmails[0].ptjEmails.split(',') : [];
            const auditorEmailsArray = getNotifyEmails[0].auditorEmails ? getNotifyEmails[0].auditorEmails.split(',') : [];
            const ptjGroup = await UserService.getUserGroup(resultResponseToSave.formResponse.respectiveGroupID);
            const form = await FormService.getFormInfo(resultResponseToSave.formResponse.formID);
            if (ptjEmailsArray.length !== 0)
                await EmailService.notifyFormAssessed(ptjEmailsArray, ptjGroup!.groupName, form.title, resultResponseToSave.yearSession);
            const allFormSubmitted = await checkAllFormSubmitted(resultResponseToSave.formResponse.respectiveGroupID, resultResponseToSave.yearSession);
            const allFormSubmittedStat = allFormSubmitted.length === 0 ? -1 : allFormSubmitted[0].auditStat;
            const allCommented = allFormSubmitted.length === 0 ? false : allFormSubmitted[0].commented;
            if (allFormSubmittedStat === 2) {
                if (auditorEmailsArray.length !== 0 || ptjEmailsArray.length !== 0) {
                    await EmailService.notifyAssessmentDone(auditorEmailsArray, ptjEmailsArray, ptjGroup!.groupName, resultResponseToSave.yearSession);
                    if (allCommented)
                        await EmailService.notifyOverallComment(auditorEmailsArray, ptjGroup!.groupName, resultResponseToSave.yearSession)
                }
            }
        }
        else if (groupInfo?.role === "PTJ") {
            const getNotifyEmails = await UserService.getNotifyEmails(resultResponseToSave.formResponse.respectiveGroupID, resultResponseToSave.yearSession)
            const auditorEmailsArray = getNotifyEmails[0].auditorEmails ? getNotifyEmails[0].auditorEmails.split(',') : [];
            const ptjEmailsArray = getNotifyEmails[0].ptjEmails ? getNotifyEmails[0].ptjEmails.split(',') : [];
            const ptjGroup = await UserService.getUserGroup(resultResponseToSave.formResponse.respectiveGroupID);
            const form = await FormService.getFormInfo(resultResponseToSave.formResponse.formID);
            const yearSession = await PeriodService.getSession(resultResponseToSave.yearSession);
            const assessmentPeriod = yearSession.auditStartDate + " ~ " + yearSession.auditEndDate
            if (auditorEmailsArray.length !== 0)
                await EmailService.notifyPTJSubmitted(auditorEmailsArray, ptjGroup!.groupName, form.title, resultResponseToSave.yearSession, assessmentPeriod);
            const allFormSubmitted = await checkAllFormSubmitted(resultResponseToSave.formResponse.groupID, resultResponseToSave.yearSession);
            const allFormSubmittedStat = allFormSubmitted.length === 0 ? -1 : allFormSubmitted[0].selfAuditStat;
            if (allFormSubmittedStat === 2) {
                if (auditorEmailsArray.length !== 0 || ptjEmailsArray.length !== 0)
                    await EmailService.notifyPTJSubmittedAll(ptjEmailsArray, auditorEmailsArray, ptjGroup!.groupName, resultResponseToSave.yearSession);
            }
        }
        res.json(
            {
                message: 'Form submitted successfully',
                resultResponseToSave
            }
        );
        logHelper(`POST ${req.originalUrl}`, 'submitResultResponseDetails', AccessLayer.Controllers);
    } catch (error) {
        console.log(error);
        res.status(500).send(serverError);
        logHelper(`POST ${req.originalUrl}`, 'submitResultResponseDetails', AccessLayer.Controllers, error);
    }
}

export const checkAllFormSubmitted = async (
    groupId: number,
    yearSession: string) => {
    const userId = "-1";
    const [result] = await ProgressOverviewService.progressQuery(groupId.toString(), userId, "PTJ", yearSession) as RowDataPacket[];
    const toReturn = [];
    try {
        for (let i = 0; i < result.length; i++) {
            const {
                groupID,
                groupName,
                responseCount,
                submittedCount,
                auditResponseCount,
                auditSubmittedCount,
                respectiveAuditors,
            } = result[i];
            const groupInfo = await UserService.getUserGroup(+groupID);
            const formCount = await ProgressOverviewService.getFormCount(groupInfo!.ptjAcademic ? "true" : "false");
            for (let j = 0; j < formCount.length; j++) {
                const {
                    yearSession,
                } = formCount[j];

                let selfAuditStatus;

                if (result[i].yearSession === formCount[j].yearSession) {
                    let commented: boolean;
                    if (respectiveAuditors)
                        commented = Object.values(respectiveAuditors).some(value => value === null) ? false : true;
                    else
                        commented = false;
                    if (responseCount > 0) {
                        if (responseCount == submittedCount && submittedCount == formCount[j].active_form_count) {
                            selfAuditStatus = 2;
                        } else {
                            selfAuditStatus = 1;
                        }
                    } else {
                        selfAuditStatus = 0;
                    }

                    let auditStatus;

                    if (auditResponseCount > 0) {
                        if (auditResponseCount == auditSubmittedCount && auditSubmittedCount == formCount[j].active_form_count && commented === true) {
                            auditStatus = 2;
                        } else {
                            auditStatus = 1;
                        }
                    } else {
                        auditStatus = 0;
                    }

                    toReturn.push({
                        groupID,
                        groupName,
                        yearSession,
                        selfAuditStat: selfAuditStatus,
                        auditStat: auditStatus,
                        commented: commented
                    });
                }
            }
        }
        logHelper(`GET allFormSubmittedInfo: ${toReturn}`, 'checkAllFormSubmitted', AccessLayer.Controllers);
    } catch (error) {
        console.log(error);
        logHelper(`GET allFormSubmittedInfo: ${toReturn}`, 'checkAllFormSubmitted', AccessLayer.Controllers);
    }
    return toReturn;
};