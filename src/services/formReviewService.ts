import { AccessLayer, Table } from "../constants/global";
import { Form } from "../interface/Form";
import { Evidence, FormResponse, QuestionResponse, ResultEvidence, ResultQuestionResponse } from "../interface/FormReview";
import { logHelper } from "../middleware/logger";
import * as utils from "../utils/utils.db";

export const FormReviewService = {
    async getFormType(targetId: number) {
        try {
            const result = await utils.retrieve(
                Table.Form,
                "formType",
                {
                    column: "formID",
                    value: targetId
                }
            );
            logHelper('Retrieve form type', 'getFormType', AccessLayer.Services);
            if (result && result.length > 0) {
                return result[0] as Form;
            }
        } catch (error) {
            logHelper('Retrieve form type', 'getFormType', AccessLayer.Services, error);
            throw error;
        }
    },

    async getSubmittedFormResponse(formID: number, respectiveGroupID: number) {
        try {
            const result = await utils.retrieve(
                Table.FormResponse,
                "*",
                [
                    {
                        column: "formID",
                        value: formID
                    },
                    {
                        column: "respectiveGroupID",
                        value: respectiveGroupID
                    },
                    {
                        column: "submitted",
                        value: 1
                    }
                ]
            );
            logHelper('Retrieve submitted form response', 'getSubmittedFormResponse', AccessLayer.Services);
            return result as FormResponse;
        } catch (error) {
            logHelper('Retrieve submitted form response', 'getSubmittedFormResponse', AccessLayer.Services, error);
            throw error;
        }
    },

    async getQuestionResponse(formResponseID: number[]) {
        try {
            const result = await utils.retrieve(
                Table.QuestionResponse,
                "*",
                {
                    column: "formResponseID",
                    value: formResponseID
                }
            );
            logHelper('Retrieve question response', 'getQuestionResponse', AccessLayer.Services);
            return result as QuestionResponse;
        } catch (error) {
            logHelper('Retrieve question response', 'getQuestionResponse', AccessLayer.Services, error);
            throw error;
        }

    },

    async getQuestionEvidenceData(questionResponseID: number[]) {
        try {
            const result = await utils.retrieve(
                Table.Evidence,
                "*",
                {
                    column: "questionResponseID",
                    value: questionResponseID
                }
            )
            logHelper('Retrieve evidence', 'getQuestionEvidenceData', AccessLayer.Services);
            return result as Evidence;
        } catch (error) {
            logHelper('Retrieve evidence', 'getQuestionEvidenceData', AccessLayer.Services, error);
            throw error;
        }
    },

    async getResultQuestionResponse(formResponseID: number[]) {
        try {
            const result = await utils.retrieve(
                Table.ResultQuestionResponse,
                "*",
                {
                    column: "formResponseID",
                    value: formResponseID
                }
            );
            logHelper('Retrieve result question response', 'getResultQuestionResponse', AccessLayer.Services);
            return result as ResultQuestionResponse;
        } catch (error) {
            logHelper('Retrieve result question response', 'getResultQuestionResponse', AccessLayer.Services, error);
            throw error;
        }

    },

    async getResultEvidenceData(resutlQuestionResponseID: number[]) {
        try {
            const result = await utils.retrieve(
                Table.ResultEvidence,
                "*",
                {
                    column: "resultQuestionResponseID",
                    value: resutlQuestionResponseID
                }
            );
            logHelper('Retrieve result evidence', 'getResultEvidenceData', AccessLayer.Services);
            return result as ResultEvidence;
        } catch (error) {
            logHelper('Retrieve result evidence', 'getResultEvidenceData', AccessLayer.Services, error);
            throw error;
        }
    },
}