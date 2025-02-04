import { Table } from "../constants/global";
import * as utils from "../utils/utils.db";
import * as funcs from "../utils/utils.function";
import { Criterion, Question, ResultQuestion, SubCriterion } from "../interface/Form";
import { NewData, NewResult } from "../constants/dataType";

export const FormContentService = {
    async getCriterions(linkedId: number, checkOnly?: boolean) {
        let result;

        if (checkOnly) {
            result = utils.retrieve(
                Table.Criterion,
                "*",
                {
                    column: "criterionID",
                    value: linkedId
                }
            );
        } else {
            result = utils.retrieve(
                Table.Criterion,
                "*",
                [
                    {
                        column: "formID",
                        value: linkedId
                    },
                    {
                        column: "criterionStatus",
                        value: 1
                    }
                ]
            );
        }

        if (Array.isArray(result) && linkedId) {
            return result[0] as Criterion;
        } else {
            return result as unknown as Criterion;
        }
    },

    async getSubCriterions(linkedId: number, checkOnly?: boolean) {
        let result;

        if (checkOnly) {
            result = utils.retrieve(
                Table.SubCriterion,
                "*",
                {
                    column: "subCriterionID",
                    value: linkedId
                }
            );
        } else {
            result = utils.retrieve(
                Table.SubCriterion,
                "*",
                [
                    {
                        column: "criterionID",
                        value: linkedId
                    },
                    {
                        column: "subCriterionStatus",
                        value: 1
                    }
                ]
            );
        }

        if (Array.isArray(result) && linkedId) {
            return result[0] as SubCriterion;
        } else {
            return result as unknown as SubCriterion;
        }
    },

    async getQuestion(linkedId: number, checkOnly?: boolean) {
        let result;

        if (checkOnly) {
            result = utils.retrieve(
                Table.Question,
                "*",
                {
                    column: "questionID",
                    value: linkedId
                }
            );
        } else {
            result = utils.retrieve(
                Table.Question,
                "*",
                [
                    {
                        column: "subCriterionID",
                        value: linkedId
                    },
                    {
                        column: "questionStatus",
                        value: 1
                    }
                ]
            );
        }
        return result as unknown as Question;
    },

    async countAllCriterion(linkedId: number) {
        let total: number = 0;

        const result = await utils.count(
            Table.Criterion,
            "amount",
            {
                column: "formID",
                value: linkedId
            }
        );

        if (Array.isArray(result) && result.length == 1) {
            total = result[0].amount;
        }

        return total;
    },

    async countAllSubCriterion(linkedId: number) {
        let total: number = 0;

        const result = await utils.count(
            Table.SubCriterion,
            "amount",
            {
                column: "criterionID",
                value: linkedId
            }
        );

        if (Array.isArray(result) && result.length == 1) {
            total = result[0].amount;
        }

        return total;
    },

    async getResultQuestion(linkedId: number, checkOnly?: boolean) {
        let result;

        if (checkOnly) {
            result = await utils.retrieve(
                Table.ResultQuestion,
                "*",
                {
                    column: "resultQuestionID",
                    value: linkedId
                }
            );
        } else {
            result = await utils.retrieve(
                Table.ResultQuestion,
                ["resultQuestionID", "title", "description", "refCode", "resultQuestionNumber", "resultQuestionStatus"],
                [
                    {
                        column: "formID",
                        value: linkedId
                    },
                    {
                        column: "resultQuestionStatus",
                        value: 1
                    }
                ]
            );
        }

        return result as unknown as ResultQuestion;
    },

    async countAllResultQuestion(linkedId: number) {
        let total: number = 0;
        
        const result = await utils.count(
            Table.ResultQuestion,
            "amount",
            {
                column: "formID",
                value: linkedId
            }
        );

        if (Array.isArray(result) && result.length == 1) {
            total = result[0].amount;
        }

        return total;
    },

    async deactivate(tableName: Table, id: number) {
        let udpatedName = funcs.underscoreToCamelCase(tableName.toString());

        const result = await utils.update(
            tableName,
            `${udpatedName}Status`,
            0,
            {
                column: `${udpatedName}ID`,
                value: id
            }
        );
        return result;
    },

    async createCriterion(data: NewData) {
        const result = await utils.insert(
            Table.Criterion,
            ["description", "criterionNumber", "criterionStatus", "formID"],
            [data]
        )
        return result;
    },

    async createSubCriterion(data: NewData) {
        const result = await utils.insert(
            Table.SubCriterion,
            ["description", "subCriterionNumber", "subCriterionStatus", "criterionID"],
            [data]
        )
        return result;
    },

    async createQuestion(data: NewData[]) {
        const values = data.map(val => [
            val[0], val[1], val[2], val[3], val[4]
        ]);

        const result = await utils.insert(
            Table.Question,
            [
                "description", "questionNumber", "questionStatus",
                "subCriterionID", "exampleEvidence"
            ],
            values
        )
        return result;
    },

    async updateCriterion(id: number, description: string) {
        const criterionExist = await FormContentService.getCriterions(id, true);

        if (!criterionExist) {
            throw new Error("Invalid Criterion");
        }

        const result = await utils.update(
            Table.Criterion, "description", description,
            {
                column: "criterionID",
                value: id
            }
        )
        return result;
    },

    async updateSubCriterion(id: number, description: string) {
        const subCriterionExist = await FormContentService.getSubCriterions(id, true);

        if (!subCriterionExist) {
            throw new Error("Invalid SubCriterion");
        }

        const result = await utils.update(
            Table.SubCriterion, "description", description,
            {
                column: "subCriterionID",
                value: id
            }
        )
        return result;
    },

    async updateQuestion(id: number, description: string, exampleEvidence: string) {
        const questionExist = await FormContentService.getQuestion(id, true);

        if (!questionExist) {
            throw new Error("Invalid Question");
        }

        const result = await utils.update(
            Table.Question,
            ["description", "exampleEvidence"],
            [description, exampleEvidence],
            {
                column: "questionID",
                value: id
            }
        )
        return result;
    },

    async createResult(results: NewResult[]) {
        const values = results.map(result => [
            result[0], result[1], result[2], result[3], result[4], result[5]
        ]);

        const result = await utils.insert(
            Table.ResultQuestion,
            [
                "title", "description", "refCode",
                "resultQuestionNumber", "resultQuestionStatus", "formID"
            ],
            values
        )
        return result;
    },

    async updateResultQuestion(id: number, title: string, description: string, refCode: string) {
        const resultQuestionExist = await FormContentService.getResultQuestion(id, true);

        if (!resultQuestionExist) {
            throw new Error("Invalid result question");
        }

        const result = await utils.update(
            Table.ResultQuestion,
            ["title", "description", "refCode"],
            [title, description, refCode],
            {
                column: "resultQuestionID",
                value: id
            }
        )
        return result;
    }
}