import { Table } from "../constants/global";
import { analyticsProps } from "../interface/Dashboard";
import * as utils from "../utils/utils.db";
import * as mysql from "../db";
import { RowDataPacket } from "mysql2";

export const DashboardService = {
  async getEditDashboard() {
    const result = await utils.retrieve(Table.Analytics, ["*"]);
    if (result) {
      return result as analyticsProps[];
    } else {
      return result as unknown as analyticsProps[];
    }
  },
  async getUserRole(id: number){
    const result = await utils.retrieve(Table.UserGroup, ["role"], {column: "groupID", value: id});
    if (result) {
      return result[0].role as string;
    } else {
      return result as unknown as string;
    }
  },
  async getPTjName(id: number){
    const result = await utils.retrieve(Table.UserGroup, ["groupName"], {column: "groupID", value: id});
    if (result) {
      // if(result[0]?.groupName==="QMEC" || result[0]?.groupName==="Auditor")
      //   return "";
      return result[0]?.groupName??"" as string;
    } else {
      return result as unknown as string;
    }
  },
  async getSelfAuditorList(id: number){
    const selfAuditorNameListQuery = `SELECT u.username, u.userEmail, ugs.head FROM users u INNER JOIN users_usergroup_set ugs ON ugs.userID = u.userID WHERE ugs.groupID = ? ORDER BY ugs.head DESC`;
    const [result] = (await mysql.query(selfAuditorNameListQuery, [id])) as RowDataPacket[];
    if (result) {
      return result.map((item:{username:string, userEmail:string, head:boolean})=>({["Username"]:item.username,["User Email"]:item.userEmail,["User Status"]:item.head?"Head of PTj":"PTj Member"})) as string[];
    } else {
      return result as unknown as string;
    }
  },
  async getAuditorList(groupID: number, yearSession: string){
    const auditorNameListQuery = `SELECT u.username FROM users u WHERE u.userID IN(SELECT auditorUserID FROM auditor_ptj_comments WHERE ptjGroupID = ? AND yearSession = ?)`;
    const [result] = (await mysql.query(auditorNameListQuery, [groupID, yearSession])) as RowDataPacket[];
    if (result) {
      return result.length>0?result.map((item: { username: string; })=>item.username):["(Not Assigned)"]  as string[];
    } else {
      return result as unknown as string;
    }
  },
  async updateEditDashboard(data: analyticsProps[]) {
    const errorList:string[] = [];
    await Promise.all(data.map(async (item) => {
      const result = await utils.update(
        Table.Analytics,
        ["adminAnalyticsSequence", "ptjAuditorAnalyticsSequence"],
        [item.adminAnalyticsSequence, item.ptjAuditorAnalyticsSequence],
        {
          column: "gridSequence",
          value: item.gridSequence,
        }
      );
      if (!result) {
        errorList.push("update failed : " + item.gridSequence);
      }
    }));
    if(errorList.length>0)
        return errorList;
    else
        return true;
  },
  async getAuditorInChargeGroup(userID: number) {
    const result = await utils.retrieve(Table.UserGroup, ["groupID","groupName"], {column: "auditorUserID", value: userID});
    if (result) {
      return result;
    } else {
      return result as unknown as string;
    }
  },
  async getRecommendationCommentList(groupID: number, yearSession: string){
    const auditorGroupIDList = await utils.retrieve(Table.UserGroup, ["groupID"], [{column: "role", value: "Auditor"},{column : "groupStatus", value:1}]);
    const groupIDList = auditorGroupIDList?.map((item: { groupID: number; })=>item.groupID);
    const query = `SELECT f.title AS 'Enabler/Result', fr.reflection_recommendation AS recommendation, fr.action_comment AS comment
    FROM form_response fr INNER JOIN form f ON f.formID = fr.formID 
    WHERE fr.groupID IN (?) AND fr.respectiveGroupID = ? AND fr.formID IN(SELECT fps.formID from form_period_set fps WHERE fps.yearSession = ?)`
    const [result] = (await mysql.query(query, [groupIDList??[0], groupID, yearSession])) as RowDataPacket[];
    if (result) {
      return result;
    } else {
      return result as unknown as string;
    }
  },
  async getReflectionActionList(groupID: number, yearSession: string){
    const query = `SELECT f.title AS 'Enabler/Result', fr.reflection_recommendation as reflection, fr.action_comment as action
    FROM form_response fr INNER JOIN form f ON f.formID = fr.formID 
    WHERE fr.groupID = ? AND fr.respectiveGroupID = ? AND fr.formID IN(SELECT fps.formID from form_period_set fps WHERE fps.yearSession = ?)`
    const [result] = (await mysql.query(query, [groupID, groupID, yearSession])) as RowDataPacket[];
    if (result) {
      return result;
    } else {
      return result as unknown as string;
    } 
  },
  async getAuditorCommentList(groupID: number, yearSession: string){
    const query = `SELECT u.username AS assessor, u.userEmail AS 'email address', (CASE
      WHEN apc.comment IS NULL THEN '-'
      ELSE apc.comment END) as comment FROM auditor_ptj_comments apc 
      INNER JOIN users u ON u.userID = apc.auditorUserID WHERE apc.ptjGroupID = ? AND apc.yearSession = ?`
    const [result] = (await mysql.query(query, [groupID, yearSession])) as RowDataPacket[];
    if (result) {
      return result;
    } else {
      return result as unknown as string;
    } 
  }
};
