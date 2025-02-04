import { Request, Response } from 'express';
import { UserService } from "../services/userService";
import { AccessLayer, serverError } from '../constants/global';
import { AuditorPtjComments } from '../interface/User';
import { logHelper } from '../middleware/logger';
import { checkAllFormSubmitted } from './response.controllers';
import { EmailService } from '../services/emailService';

export async function getComments(req: Request, res: Response) {
    const groupId = Number(req.params.groupID);
    const key = Number(req.params.id);
    const session = req.params.session;

    try {
        if (key < -1) {
            return res.status(409).json(
                { message: 'Invalid parameter' }
            )
        }

        if (key === -1 || key > 0) {
            const existingGroup = await UserService.getUserGroup(groupId);
            if (!existingGroup) {
                logHelper(`PATCH ${req.originalUrl}`, 'getComments', AccessLayer.Controllers);
                return res.status(404).json(
                    { message: 'Invalid group' }
                );
            }
            const comments = await UserService.getComments(key, groupId, session);

            if (comments) {
                res.status(200).json(comments)
                logHelper(`GET ${req.originalUrl}`, 'getComments', AccessLayer.Controllers);
            }
        }
    } catch (error) {
        console.error(error);
        res.status(500).json(serverError);
        logHelper(`GET ${req.originalUrl}`, 'getComments', AccessLayer.Controllers, error);
    }
}

export async function updateComment(req: Request, res: Response) {
    const data: AuditorPtjComments = req.body;

    try {
        const existingComment = await UserService.getComment(data.auditorUserID, data.ptjGroupID, data.yearSession);

        if (!existingComment) {
            return res.status(404).json(
                { message: "Invalid data" }
            )
        }

        const commentTobeUpdated: AuditorPtjComments = {
            ...existingComment,
            comment: data.comment
        }

        let newComment = [];
        if (commentTobeUpdated.comment === "") {
            newComment = [null];
        } else {
            newComment = [commentTobeUpdated.comment];
        }


        const result = await UserService.updateComment(data.auditorUserID, data.ptjGroupID, data.yearSession, newComment);

        // Form responses status check
        const allFormSubmitted = await checkAllFormSubmitted(data.ptjGroupID, data.yearSession);
        const allFormSubmittedStat = allFormSubmitted.length === 0 ? -1 : allFormSubmitted[0].auditStat;
        const allCommented = allFormSubmitted.length === 0 ? false : allFormSubmitted[0].commented;

        // Check whether all form responses are completed or '=== 2'
        if (allFormSubmittedStat === 2) {
            const getNotifyEmails = await UserService.getNotifyEmails(data.ptjGroupID, data.yearSession)
            const ptjEmailsArray = getNotifyEmails[0].ptjEmails ? getNotifyEmails[0].ptjEmails.split(',') : [];
            const auditorEmailsArray = getNotifyEmails[0].auditorEmails ? getNotifyEmails[0].auditorEmails.split(',') : [];
            const ptjGroup = await UserService.getUserGroup(data.ptjGroupID);

            // Send email notification
            if (auditorEmailsArray.length !== 0 || ptjEmailsArray.length !== 0) {
                await EmailService.notifyAssessmentDone(auditorEmailsArray, ptjEmailsArray, ptjGroup!.groupName, data.yearSession);
                if (allCommented) {
                    await EmailService.notifyOverallComment(auditorEmailsArray, ptjGroup!.groupName, data.yearSession)
                }
            }
        }

        if (result) {
            const commentInfo = await UserService.getComment(data.auditorUserID, data.ptjGroupID, data.yearSession);
            res.status(200).json({ ...commentInfo });
            logHelper(`PATCH ${req.originalUrl}`, 'updateComment', AccessLayer.Controllers);
        }
    } catch (error) {
        console.error(error);
        res.status(500).send(serverError);
        logHelper(`PATCH ${req.originalUrl}`, 'updateComment', AccessLayer.Controllers, error);
    }
}