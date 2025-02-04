import { AccessLayer, Table } from "../constants/global";
import { AuditorPtjComments, Group, User, UserGroupSet } from "../interface/User";
import { logHelper } from "../middleware/logger";
import * as utils from "../utils/utils.db";
import * as mysql from "../db";
import { RowDataPacket } from "mysql2";
import { UserAndUserGroupSetType } from "../constants/dataType";

export const UserService = {
  async getUsers() {
    try {
      const result = await utils.retrieve(Table.User, "*");
      logHelper("Retrieve users", "getUsers", AccessLayer.Services);
      return result as User;
    } catch (error) {
      logHelper("retrieve users", "getUsers", AccessLayer.Services, error);
      throw error;
    }
  },

  async getUser(userId: number) {
    try {
      const result = await utils.retrieve(Table.User, "*", {
        column: "userID",
        value: userId,
      });
      logHelper("Retrieve user", "getUser", AccessLayer.Services);
      if (result && result.length > 0) {
        return result[0] as User;
      }
    } catch (error) {
      logHelper("retrieve user", "getUser", AccessLayer.Services, error);
      throw error;
    }
  },

  async getUserGroup(groupId: number) {
    try {
      const result = await utils.retrieve(Table.UserGroup, "*", {
        column: "groupID",
        value: groupId,
      });
      logHelper("Retrieve user group", "getUserGroup", AccessLayer.Services);
      if (result && result.length > 0) {
        return result[0] as Group;
      }
    } catch (error) {
      logHelper(
        "retrieve user group",
        "getUserGroup",
        AccessLayer.Services,
        error
      );
      throw error;
    }
  },

  async getUserAndUsergroupSet(userId: number) {
    try {
      const result = await utils.retrieve(Table.UserGroupSet, "*", {
        column: "userID",
        value: userId
      })
      logHelper("Retrieve user and user group set", "getUserAndUsergroupSet", AccessLayer.Services);
      if (result && result.length > 0) {
        return result as UserGroupSet;
      }
    } catch (error) {
      logHelper(
        "Retrieve user and user group set",
        "getUserAndUsergroupSet",
        AccessLayer.Services,
        error
      );
      throw error;
    }
  },

  async updateUserAndUsergroupSet(userId: number, groupId: number, head: boolean) {
    try {
      const result = await utils.update(
        Table.UserGroupSet, "head", head,
        [
          {
            column: "userID",
            value: userId
          },
          {
            column: "groupID",
            value: groupId
          }
        ]
      )
      logHelper("Update user and user group set", "updateUserAndUsergroupSet", AccessLayer.Services);
      return result;
    } catch (error) {
      logHelper("Update user and user group set", "updateUserAndUsergroupSet", AccessLayer.Services, error);
      throw error;
    }
  },

  async getUsersGroupBasedOnUserID(userId: number) {
    try {
      const result = await utils.retrieve(Table.UserGroupSet, "*", {
        column: "userID",
        value: userId,
      })
      logHelper("Retrieve user group based on user id", "getUserGroupBasedOnUserId", AccessLayer.Services);
      if (Array.isArray(result) && result.length > 0) {
        return result as unknown as UserGroupSet;
      }
    } catch (error) {
      logHelper(
        "retrieve user group based on user id",
        "getUserGroupBasedOnUserID",
        AccessLayer.Services,
        error
      );
      throw error;
    }
  },

  async getUserGroups() {
    try {
      const result = await utils.retrieve(Table.UserGroup, "*");
      logHelper("Retrieve user groups", "getUserGroups", AccessLayer.Services);
      return result as Group;
    } catch (error) {
      logHelper(
        "retrieve user groups",
        "getUserGroups",
        AccessLayer.Services,
        error
      );
      throw error;
    }
  },

  async getAuditorGroup() {
    try {
      const result = await utils.retrieve(Table.UserGroup, "*", {
        column: "role",
        value: "Auditor",
      });
      logHelper(
        "Retrieve auditor group",
        "getAuditorGroup",
        AccessLayer.Services
      );
      return result as Group;
    } catch (error) {
      logHelper(
        "retrieve auditor group",
        "getAuditorGroup",
        AccessLayer.Services,
        error
      );
      throw error;
    }
  },

  async getAuditorUser(groupId: number) {
    try {
      const result = await utils.retrieve(
        Table.UserGroupSet,
        ["userID", "groupID", "head"],
        {
          column: "groupID",
          value: groupId,
        }
      );
      logHelper("Retrieve auditor user", "getAuditorUser", AccessLayer.Services);
      return result as UserGroupSet;
    } catch (error) {
      logHelper("retrieve auditor user", "getAuditorUser", AccessLayer.Services, error);
      throw error;
    }
  },

  async createGroup(data: any[]) {
    try {
      const result = await utils.insert(
        Table.UserGroup,
        ["groupName", "role", "groupStatus", "ptjAcademic"],
        data
      );
      logHelper("Create new group", "createGroup", AccessLayer.Services);
      return result;
    } catch (error) {
      logHelper("Create new group", "createGroup", AccessLayer.Services, error);
      throw error;
    }
  },

  async updateGroup(groupId: number, data: string) {
    try {
      const result = await utils.update(Table.UserGroup, "groupName", data, {
        column: "groupID",
        value: groupId,
      });
      logHelper("Update group", "updateGroup", AccessLayer.Services);
      return result;
    } catch (error) {
      logHelper("update group", "updateGroup", AccessLayer.Services);
      throw error;
    }
  },

  async changeGroupStatus(groupId: number, value: number) {
    try {
      const result = await utils.update(Table.UserGroup, "groupStatus", value, {
        column: "groupID",
        value: groupId,
      });
      logHelper("Deactivate group", "deactivateGroup", AccessLayer.Services);
      return result;
    } catch (error) {
      logHelper(
        "deactivate group",
        "deactivateGroup",
        AccessLayer.Services,
        error
      );
      throw error;
    }
  },
  async updateLastLoginDate(userId: number) {
    try {
      const result = await utils.update(
        Table.User,
        "lastLoginDate",
        new Date(),
        {
          column: "userID",
          value: userId,
        }
      );
      logHelper(
        "Update last login date",
        "updateLastLoginDate",
        AccessLayer.Services
      );
      return result;
    } catch (error) {
      logHelper(
        "update last login date",
        "updateLastLoginDate",
        AccessLayer.Services,
        error
      );
      throw error;
    }
  },

  async removeGroup(groupId: number) {
    try {
      const result = await utils.remove(Table.UserGroup, {
        column: "groupID",
        value: groupId,
      });
      logHelper("Remove user group", "removeGroup", AccessLayer.Services);
      return result;
    } catch (error) {
      logHelper(
        "remove user group",
        "removeGroup",
        AccessLayer.Services,
        error
      );
      throw error;
    }
  },

  async createUser(data: any[]) {
    try {
      const result = await utils.insert(
        Table.User,
        ["userEmail", "userStatus"],
        data
      );
      logHelper("Create user", "createUser", AccessLayer.Services);
      return result;
    } catch (error) {
      logHelper("create user", "createUser", AccessLayer.Services, error);
      throw error;
    }
  },

  async createUserAndUsergroupSet(results: UserAndUserGroupSetType[]) {
    const values = results.map(result => [
      result[0], result[1], result[2]
    ]);

    try {
      const result = await utils.insert(
        Table.UserGroupSet,
        ["userID", "groupID", "head"],
        values
      )
      logHelper("Create user and usergroup set", "createUserAndUsergroupSet", AccessLayer.Services);
      return result;
    } catch (error) {
      logHelper("create user and usergroup set", "createUserAndUsergroupSet", AccessLayer.Services, error);
      throw error;
    }
  },

  async updateUserGroup(userId: number, data: any[]) {
    try {
      const result = await utils.update(Table.User, "groupID", data, {
        column: "userID",
        value: userId,
      });
      logHelper("Update user", "updateUser", AccessLayer.Services);
      return result;
    } catch (error) {
      logHelper("update user", "updateUser", AccessLayer.Services, error);
      throw error;
    }
  },

  async updateUsername(userEmail: string, data: string) {
    try {
      const result = await utils.update(Table.User, "username", data, {
        column: "userEmail",
        value: userEmail,
      });
      logHelper("Update userEmail", "updateUseremail", AccessLayer.Services);
      return result;
    } catch (error) {
      logHelper(
        "update userEmail",
        "updateUseremail",
        AccessLayer.Services,
        error
      );
      throw error;
    }
  },

  async removeUser(userId: number) {
    try {
      const result = await utils.remove(Table.User, {
        column: "userID",
        value: userId,
      });
      logHelper("Remove user", "removeUser", AccessLayer.Services);
      return result;
    } catch (error) {
      logHelper("remove user", "removeUser", AccessLayer.Services, error);
      throw error;
    }
  },

  async removeAllUserAndUsergroupSet(userId: number) {
    try {
      const result = await utils.remove(
        Table.UserGroupSet,
        {
          column: "userID",
          value: userId
        }
      )
      logHelper("Remove all user and user group set", "removeAllUserAndUsergroupSet", AccessLayer.Services);
      return result;
    } catch (error) {
      logHelper("Remove all user and user group set", "removeAllUserAndUsergroupSet", AccessLayer.Services, error);
      throw error;
    }
  },

  async removeUserAndUsergroupSet(userId: number, groupId: number) {
    try {
      const result = await utils.remove(
        Table.UserGroupSet,
        [
          {
            column: "userID",
            value: userId
          },
          {
            column: "groupID",
            value: groupId
          }
        ]
      )
      logHelper("Remove all user and user group set", "removeAllUserAndUsergroupSet", AccessLayer.Services);
      return result;
    } catch (error) {
      logHelper("Remove all user and user group set", "removeAllUserAndUsergroupSet", AccessLayer.Services, error);
      throw error;
    }
  },

  async getPtjGroupID(auditorUserID: number, session: string) {
    try {
      const result = await utils.retrieve(Table.AuditorPTJComments, "*", [
        {
          column: "auditorUserID",
          value: auditorUserID,
        },
        {
          column: "yearSession",
          value: session,
        },
      ]);
      logHelper("Get assign to", "getPtjGroupID", AccessLayer.Services);
      return result as AuditorPtjComments;
    } catch (error) {
      logHelper("get assign to", "getPtjGroupID", AccessLayer.Services);
      throw error;
    }
  },

  async getAuditorUserID(groupID: number, session: string) {
    try {
      const result = await utils.retrieve(Table.AuditorPTJComments, "*", [
        {
          column: "ptjGroupID",
          value: groupID,
        },
        {
          column: "yearSession",
          value: session,
        },
      ]);
      logHelper(
        "Get assigned auditor",
        "geAuditorUserID",
        AccessLayer.Services
      );
      return result as AuditorPtjComments;
    } catch (error) {
      logHelper(
        "get assigned auditor",
        "geAuditorUserID",
        AccessLayer.Services,
        error
      );
      throw error;
    }
  },

  async getAssignmentRecord(groupId: number) {
    try {
      const result = await utils.retrieve(Table.AuditorPTJComments, "*", {
        column: "ptjGroupID",
        value: groupId,
      });
      logHelper(
        "Get assignment record",
        "getAssignmentRecord",
        AccessLayer.Services
      );
      return result as AuditorPtjComments;
    } catch (error) {
      logHelper(
        "Get assignment record",
        "getAssignmentRecord",
        AccessLayer.Services,
        error
      );
      throw error;
    }
  },

  async createAssignment(data: any[][]) {
    try {
      const result = await utils.insert(
        Table.AuditorPTJComments,
        ["auditorUserID", "ptjGroupID", "yearSession"],
        data
      );
      logHelper(
        "Create new assignment",
        "createAssignment",
        AccessLayer.Services
      );
      return result;
    } catch (error) {
      logHelper(
        "create new assignment",
        "createAssignment",
        AccessLayer.Services,
        error
      );
      throw error;
    }
  },

  async deleteAssignment(
    auditorUserID: number,
    ptjGroupID: number,
    session: string
  ) {
    try {
      const result = await utils.remove(Table.AuditorPTJComments, [
        {
          column: "auditorUserID",
          value: auditorUserID,
        },
        {
          column: "ptjGroupID",
          value: ptjGroupID,
        },
        {
          column: "yearSession",
          value: session,
        },
      ]);
      logHelper("Delete assignment", "deleteAssignment", AccessLayer.Services);
      return result;
    } catch (error) {
      logHelper(
        "Delete assignment",
        "deleteAssignment",
        AccessLayer.Services,
        error
      );
      throw error;
    }
  },

  async getComments(key: number, ptjGroupID: number, session: string) {
    try {
      let result;

      if (key > 0) {
        result = await utils.retrieve(Table.AuditorPTJComments, "*", [
          {
            column: "auditorUserID",
            value: key,
          },
          {
            column: "ptjGroupID",
            value: ptjGroupID,
          },
          {
            column: "yearSession",
            value: session,
          },
        ]);
      } else {
        result = await utils.retrieve(Table.AuditorPTJComments, "*", [
          {
            column: "ptjGroupID",
            value: ptjGroupID,
          },
          {
            column: "yearSession",
            value: session,
          },
        ]);
      }
      logHelper("Get comments", "getComments", AccessLayer.Services);
      return result as AuditorPtjComments;
    } catch (error) {
      logHelper("Get comments", "getComments", AccessLayer.Services, error);
      throw error;
    }
  },

  async updateComment(
    auditorUserID: number,
    ptjGroupID: number,
    session: string,
    comment: any[]
  ) {
    try {
      const result = await utils.update(
        Table.AuditorPTJComments,
        "comment",
        comment,
        [
          {
            column: "auditorUserID",
            value: auditorUserID,
          },
          {
            column: "ptjGroupID",
            value: ptjGroupID,
          },
          {
            column: "yearSession",
            value: session,
          },
        ]
      );
      logHelper("Update comment", "updateComment", AccessLayer.Services);
      return result;
    } catch (error) {
      logHelper("Update comment", "updateComment", AccessLayer.Services, error);
      throw error;
    }
  },

  async getComment(auditorUserID: number, ptjGroupID: number, session: string) {
    try {
      const result = await utils.retrieve(Table.AuditorPTJComments, "*", [
        {
          column: "auditorUserID",
          value: auditorUserID,
        },
        {
          column: "ptjGroupID",
          value: ptjGroupID,
        },
        {
          column: "yearSession",
          value: session,
        },
      ]);
      if (result) {
        logHelper("Get comment", "getComment", AccessLayer.Services);
        return result[0] as AuditorPtjComments;
      }
    } catch (error) {
      logHelper("get comment", "getComment", AccessLayer.Services, error);
      throw error;
    }
  },

  async profileInfoQuery(userEmail: string) {
    try {
      const query = `
            SELECT ugs.head, ug.*, u.*
                FROM users_usergroup_set ugs
                INNER JOIN usergroup ug
                    ON ugs.groupID = ug.groupID
                INNER JOIN users u
                    ON ugs.userID = u.userID
                WHERE u.userStatus = 1 
                    AND ug.groupStatus = 1
                    AND u.userEmail = ?
                ORDER BY ug.groupID ASC`;

      const [rows] = (await mysql.query(query, [userEmail])) as RowDataPacket[];
      logHelper(
        "get profile info",
        "profileInfoQuery",
        AccessLayer.Controllers
      );
      return rows;
    } catch (error) {
      logHelper(
        "get profile info",
        "profileInfoQuery",
        AccessLayer.Controllers,
        error,
        true
      );
      throw error;
    }
  },
  async getLastAnnouncementDate() {
    const query =
      "SELECT createdDate FROM announcement ORDER BY createdDate DESC LIMIT 1";
    try {
      const [result] = (await mysql.query(query)) as RowDataPacket[];
      if (result) {
        logHelper(
          "get last announcement date",
          "getLastAnnouncementDate",
          AccessLayer.Controllers
        );
        return result[0]?.createdDate ?? null;
      }
    } catch (error) {
      logHelper(
        "get last announcement date",
        "getLastAnnouncementDate",
        AccessLayer.Controllers,
        error,
        true
      );
      throw error;
    }
  },

  async getLastLoginAnnouncementDate(userId: number) {
    try {
      const dates = {
        lastLoginDate: "",
        lastAnnouncementDate: "",
      };
      dates.lastAnnouncementDate = await this.getLastAnnouncementDate();
      const result = await utils.retrieve(Table.User, "lastLoginDate", {
        column: "userID",
        value: userId,
      });

      if (result && result.length > 0) {
        dates.lastLoginDate = result[0].lastLoginDate;
      }
      logHelper(
        "get last login date",
        "getLastLoginDate",
        AccessLayer.Controllers
      );
      return dates;
    } catch (error) {
      logHelper(
        "get last login date",
        "getLastLoginDate",
        AccessLayer.Controllers,
        error
      );
      throw error;
    }
  },

  async getNotifyEmails(respectiveGroupId: number, session: string) {
    try {
      const query = `
        WITH 
        ptj_emails AS (
          SELECT DISTINCT u.userEmail AS email
          FROM users u
          INNER JOIN users_usergroup_set ugs ON u.userID = ugs.userID
          WHERE ugs.groupID = ?
        ),
        auditor_emails AS (
          SELECT DISTINCT u.userEmail AS email
          FROM users u
          INNER JOIN auditor_ptj_comments apc ON u.userID = apc.auditorUserID
          WHERE apc.ptjGroupID = ?
          AND apc.yearSession = ?
        )
        SELECT
          GROUP_CONCAT(DISTINCT ptj_emails.email ORDER BY ptj_emails.email SEPARATOR ',') AS ptjEmails,
          GROUP_CONCAT(DISTINCT auditor_emails.email ORDER BY auditor_emails.email SEPARATOR ',') AS auditorEmails
        FROM
          ptj_emails,
          auditor_emails
        `;
      const [result] = await mysql.query(query, [respectiveGroupId, respectiveGroupId, session]) as RowDataPacket[];
      logHelper('Retrieve PTJ(s) and Assessor(s) to be notified', 'getNotifyEmails', AccessLayer.Services);
      return result;
    } catch (error) {
      logHelper('Retrieve PTJ(s) and Assessor(s) to be notified', 'getNotifyEmails', AccessLayer.Services, error, true);
      throw error;
    }
  },
};
