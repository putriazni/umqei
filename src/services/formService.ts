import { AccessLayer, Table } from "../constants/global";
import { Form } from "../interface/Form";
import { logHelper } from "../middleware/logger";
import * as utils from "../utils/utils.db";
import * as mysql from "../db";

export const FormService = {
    async getActiveForms() {
        try {
            const result = await utils.retrieve(
                Table.Form, "*",
                {
                    column: "formStatus",
                    value: 1
                },
            );

            logHelper('Retrieve active forms', 'getActiveForms', AccessLayer.Services);
            return result as Form;

        } catch (error) {
            logHelper('retrieve active forms', 'getActiveForms', AccessLayer.Services, error);
            throw error;
        }
    },

    async createNewForm(data: any[]) {
        try {
            const result = await utils.insert(
                Table.Form,
                [
                    'title', 'formDefinition', 'formType',
                    'formNumber', 'formStatus', 'minScale',
                    'maxScale', 'weightage', 'flag', 'nonAcademicWeightage'
                ],
                data
            )
            logHelper('Create new form', 'createNewForm', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('create new form', 'createNewForm', AccessLayer.Services, error);
            throw error;
        }
    },

    async getFormInfo(id: number) {
        const result = await utils.retrieve(
            Table.Form, "*",
            {
                column: "formID",
                value: id
            },
        )
        if (result) {
            logHelper('Get form information', 'getFormInfo', AccessLayer.Services);
            return result[0] as Form;
        } else {
            logHelper('Get form information', 'getFormInfo', AccessLayer.Services);
            return result as unknown as Form;
        }
    },

    async deactivateForm(targetId: number) {
        try {
            const result = await utils.update(
                Table.Form,
                "formStatus",
                0,
                {
                    column: "formID",
                    value: targetId
                }
            )
            logHelper('Deactivate form', 'deactivateForm', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('deactivate form', 'deactivateForm', AccessLayer.Services, error);
            throw error;
        }
    },

    async updateForm(targetId: number, data: any[]) {
        try {
            const result = await utils.update(
                Table.Form,
                ["title", "formDefinition", "minScale", "maxScale", "weightage", "flag", "nonAcademicWeightage"],
                data,
                {
                    column: "formID",
                    value: targetId
                }
            )
            logHelper('Update form', 'updateForm', AccessLayer.Services);
            return result;
        } catch (error) {
            logHelper('update form', 'updateForm', AccessLayer.Services, error);
            throw error;
        }
    },

    async formQuery(groupId: number, respectiveGroupId: number | undefined, selfAuditStartDate: string, selfAuditEndDate: string, ptjAcademic: string, yearSession: string) {
        try {

            let query2 = `
                SELECT 
                    f.*, fr.formResponseID, fr.groupID, fr.respectiveGroupID, fr.submitted, fr.inSession
                    FROM form f
                    LEFT JOIN form_response fr
                    ON f.formID = fr.formID
                        AND fr.groupID = ?
                        AND fr.respectiveGroupID = ?
                        AND ? <= fr.createdDate
                        AND fr.createdDate <= ?
                    WHERE f.formID IN 
                        (SELECT formID 
                            FROM form_period_set 
                            WHERE yearSession = ?)`;

            if (ptjAcademic !== 'true') {
                query2 += `
                    AND (
                        f.formType <> 1
                        OR f.flag <> 1
                    )`;
            }
            logHelper('Retrieve forms', 'formQuery', AccessLayer.Controllers);
            return await mysql.query(query2, [groupId, respectiveGroupId, selfAuditStartDate, selfAuditEndDate, yearSession]);
        } catch (error) {
            logHelper('Retrive forms', 'formQuery', AccessLayer.Controllers, error, true);
            throw error;
        }
    },

    async getYearSessionForm(yearSession: string) {
        try {
            const result = await utils.retrieve(
                Table.FormPeriodSet, "formID",
                {
                    column: "yearSession",
                    value: yearSession
                },
            )
            const extractedFormIDs = result?.map((item: { formID: number }) => item.formID);
            logHelper('Retrieve formID using yearSession', 'getYearSessionForm', AccessLayer.Services);
            return extractedFormIDs as number[];
        } catch (error) {
            logHelper('Retrieve formID using yearSession', 'getYearSessionForm', AccessLayer.Services, error, true);
            throw error;
        }
    }
}
