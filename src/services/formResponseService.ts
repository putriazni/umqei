import { NewFormResponse, NewQuestionResponse } from "../constants/dataType";
import { AccessLayer, Table } from "../constants/global";
import * as utils from "../utils/utils.db";
import { PeriodService } from "./periodService";
import * as mysql from "../db";
import { RowDataPacket } from "mysql2";
import { logHelper } from "../middleware/logger";

export const FormResponseService = {
    async getInSession(id: number) {
        try {
            const result = await utils.retrieve(
                Table.FormResponse, ["formResponseID", "inSession"],
                {
                    column: "formResponseID",
                    value: id
                },
            )
            logHelper('Retrieve insession', 'getInSession', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('Retrieve form type', 'getFormType', AccessLayer.Services, error);
            throw error;
        }
    },

    async getQuestionResponseID(responseId: number, questionId: number) {
        try {
            const result = await utils.retrieve(
                Table.QuestionResponse, ["questionResponseID"],
                [
                    {
                        column: "formResponseID",
                        value: responseId
                    },
                    {
                        column: "questionID",
                        value: questionId
                    }
                ]
            );
            logHelper('Retrieve question response id', 'getQuestionResponseID', AccessLayer.Services);
            if (result)
                return result[0].questionResponseID;
            else
                return null;
        } catch (error) {
            logHelper('Retrieve question response id', 'getQuestionResponseID', AccessLayer.Services, error);
            throw error;
        }
    },

    async getResultQuestionResponseID(responseId: number, questionId: number) {
        try {
            const result = await utils.retrieve(
                Table.ResultQuestionResponse, ["resultQuestionResponseID"],
                [
                    {
                        column: "formResponseID",
                        value: responseId
                    },
                    {
                        column: "resultQuestionID",
                        value: questionId
                    }
                ]
            );
            logHelper('Retrieve result question response id', 'getResultQuestionResponseID', AccessLayer.Services);
            if (result)
                return result[0].resultQuestionResponseID;
            else
                return null;
        } catch (error) {
            logHelper('Retrieve result question response id', 'getResultQuestionResponseID', AccessLayer.Services, error);
            throw error;
        }
    },

    async patchSubmitted(id: number, submitted: boolean) {
        try {
            const result = await utils.update(
                Table.FormResponse, ["submitted"],
                submitted,
                {
                    column: "formResponseID",
                    value: id
                }

            );
            logHelper('Update to submitted', 'patchSubmitted', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('Update to submitted', 'patchSubmitted', AccessLayer.Services, error);
            throw error;
        }
    },

    async createNewFormResponse(data: NewFormResponse) {
        try {
            const result = await utils.insert(
                Table.FormResponse,
                ["groupID", "submitted", "inSession", "formID", "respectiveGroupID", "reflection_recommendation", "action_comment"],
                [data]
            );
            logHelper('Insert form response', 'createNewFormResponse', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('Insert form response', 'createNewFormResponse', AccessLayer.Services, error);
            throw error;
        }
    },

    async updateFormResponse(id: number, reflection_recommendation: string | null, action_comment: string | null) {
        try {
            const result = await utils.update(
                Table.FormResponse,
                ["reflection_recommendation", "action_comment"],
                [reflection_recommendation, action_comment],
                {
                    column: "formResponseID",
                    value: id
                }
            );
            logHelper('Update form response', 'updateFormResponse', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('Update form response', 'updateFormResponse', AccessLayer.Services, error);
            throw error;
        }
    },

    async addNewQuestionResponse(data: NewQuestionResponse[]) {
        try {
            const values = data.map(entry => [
                entry[0], // scale
                entry[1], // remark
                entry[2], // formResponseID
                entry[3], // questionID
            ]);

            const result = await utils.insert(
                Table.QuestionResponse,
                ["scale", "remark", "formResponseID", "questionID"],
                values
            );
            logHelper('Insert question response', 'addNewQuestionResponse', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('Insert question response', 'addNewQuestionResponse', AccessLayer.Services, error);
            throw error;
        }
    },

    async addNewResultQuestionResponse(data: NewQuestionResponse[]) {
        try {
            const values = data.map(entry => [
                entry[0], // scale
                entry[1], // remark
                entry[2], // formResponseID
                entry[3], // resultQuestionID
            ]);

            const result = await utils.insert(
                Table.ResultQuestionResponse,
                ["scale", "remark", "formResponseID", "resultQuestionID"],
                values
            );
            logHelper('Insert result question response', 'addNewResultQuestionResponse', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('Insert result question response', 'addNewResultQuestionResponse', AccessLayer.Services, error);
            throw error;
        }
    },

    async updateQuestionResponse(formResponseId: number, questionId: number, scale: number, remark: string) {
        try {
            const result = await utils.update(
                Table.QuestionResponse,
                ["scale", "remark"],
                [scale, remark],
                [
                    {
                        column: "formResponseID",
                        value: formResponseId
                    },
                    {
                        column: "questionID",
                        value: questionId
                    }
                ]
            );
            logHelper('Update question response', 'updateQuestionResponse', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('Update question response', 'updateQuestionResponse', AccessLayer.Services, error);
            throw error;
        }
    },

    async updateResultQuestionResponse(formResponseId: number, questionId: number, scale: number, remark: string) {
        try {
            const result = await utils.update(
                Table.ResultQuestionResponse,
                ["scale", "remark"],
                [scale, remark],
                [
                    {
                        column: "formResponseID",
                        value: formResponseId
                    },
                    {
                        column: "resultQuestionID",
                        value: questionId
                    }
                ]
            );
            logHelper('Update result question response', 'updateResultQuestionResponse', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('Update result question response', 'updateResultQuestionResponse', AccessLayer.Services, error);
            throw error;
        }
    },

    async submitFormResponse(id: number, submitted: boolean) {
        try {
            const result = await utils.update(
                Table.FormResponse,
                ["submitted"],
                [submitted],
                {
                    column: "formResponseID",
                    value: id
                }
            );
            logHelper('Submit form response', 'submitFormResponse', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('Submit form response', 'submitFormResponse', AccessLayer.Services, error);
            throw error;
        }
    },

    async updateInSession(id: number, inSession: boolean) {
        try {
            const result = await utils.update(
                Table.FormResponse,
                ["inSession"],
                [inSession],
                {
                    column: "formResponseID",
                    value: id
                }
            );
            logHelper('Update insession', 'updateInSession', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('Update insession', 'updateInSession', AccessLayer.Services, error);
            throw error;
        }
    },

    async getFormResponses(id: number, yearSession: string) {
        try {
            const query = 'SELECT * FROM form_response WHERE formID = ? AND ? <= createdDate AND createdDate <= ?';
            const timeline = await PeriodService.getSession(yearSession);
            const [result] = await mysql.query(query, [id, timeline.selfAuditStartDate, timeline.auditEndDate]) as RowDataPacket[];
            logHelper('Retrieve form responses', 'getFormResponses', AccessLayer.Controllers);
            return result;
        } catch (error) {
            logHelper('Retrieve form responses', 'getFormResponses', AccessLayer.Controllers, error, true);
            throw error;
        }
    },

    async getQuestionResponse(id: number) {
        try {
            const result = await utils.retrieve(
                Table.QuestionResponse,
                "*",
                {
                    column: "formResponseID",
                    value: id
                }
            );
            logHelper('Retrieve question response', 'getQuestionResponse', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('Retrieve question response', 'getQuestionResponse', AccessLayer.Services, error);
            throw error;
        }
    },

    async getResultQuestionResponse(id: number) {
        try {
            const result = await utils.retrieve(
                Table.ResultQuestionResponse,
                "*",
                {
                    column: "formResponseID",
                    value: id
                }
            );
            logHelper('Retrieve result question response', 'getResultQuestionResponse', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('Retrieve question response', 'getQuestionResponse', AccessLayer.Services, error);
            throw error;
        }
    },

    async getEnablerResponseDetails(id: number) {
        try {
            const query = `
            SELECT
                sc.criterionID,
                json_objectagg(q2.subCriterionID, q2.questions) as questionResponseDetails
            FROM	(SELECT 
                        q.subCriterionID,
                        json_arrayagg(q1.questionID) as questions
                    FROM    (SELECT 
                                questionID 
                            FROM question_response 
                            WHERE formResponseID = ?) q1
                    INNER JOIN question q
                    ON q1.questionID = q.questionID
                    GROUP BY q.subCriterionID) q2
            INNER JOIN sub_criterion sc
            ON q2.subCriterionID = sc.subCriterionID
            GROUP BY sc.criterionID;
        `;
            const [result] = await mysql.query(query, [id]) as RowDataPacket[];
            logHelper('Retrieve form response details', 'getEnablerResponseDetails', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('Retrieve form response details', 'getEnablerResponseDetails', AccessLayer.Services, error, true);
            throw error;
        }
    },

    async checkResponseRejected(respectiveGroupId: number, formId: number) {
        try {
            const query = `
            WITH CheckExists AS (
            SELECT fr2.groupID
            FROM form_response fr
            INNER JOIN form_response fr2
            ON fr2.respectiveGroupID = fr.groupID
            AND fr2.respectiveGroupID = ?
            AND fr2.submitted = 0
            AND fr.submitted = 0
            AND fr2.formID = fr.formID
            AND fr2.groupID IN (SELECT groupID FROM usergroup WHERE role = 'Auditor')
            AND TIMESTAMPDIFF(SECOND, fr2.lastUpdatedDate, fr.lastUpdatedDate) BETWEEN 0 AND 1
            AND fr.formID = ?)
            SELECT 
                EXISTS (SELECT 1 FROM CheckExists) AS isRejected,
                (SELECT groupID FROM CheckExists LIMIT 1) AS groupID
            `;
            const [result] = await mysql.query(query, [respectiveGroupId, formId]) as RowDataPacket[];
            logHelper('Retrieve form response rejected status', 'checkResponseRejected', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('Retrieve form response rejected status', 'checkResponseRejected', AccessLayer.Services, error, true);
            throw error;
        }
    },

    async checkAuditCompleted(respectiveGroupId: number, formId: number) {
        try {
            const query = `
            WITH CheckExists AS (
	        SELECT 
		    fr.formID,
            fr2.groupID
		    FROM form_response fr
            INNER JOIN form_response fr2
            ON fr2.respectiveGroupID = fr.groupID
            AND fr2.respectiveGroupID = ?
			AND fr2.submitted = 1
            AND fr.submitted = 1
			AND fr2.formID = fr.formID
            AND fr2.groupID IN (SELECT groupID FROM usergroup WHERE role = 'Auditor')
            AND fr.formID = ?)
			SELECT 
				EXISTS (SELECT 1 FROM CheckExists) AS isCompleted,
                (SELECT groupID FROM CheckExists LIMIT 1) AS groupID  
            `;
            const [result] = await mysql.query(query, [respectiveGroupId, formId]) as RowDataPacket[];
            logHelper('Retrieve form response audit status', 'checkAuditCompleted', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('Retrieve form response audit status', 'checkAuditCompleted', AccessLayer.Services, error, true);
            throw error;
        }
    },

    async updateToCurrentDateTime(id: number, currentDateTime: Date) {
        try {
            const result = await utils.update(
                Table.FormResponse,
                ["lastUpdatedDate"],
                [currentDateTime],
                {
                    column: "formResponseID",
                    value: id
                }
            );
            logHelper('Update insession', 'updateInSession', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('Update insession', 'updateInSession', AccessLayer.Services, error);
            throw error;
        }
    },
}