import { Request, Response } from 'express';
import { Group, User, UserGroupSet } from "../interface/User";
import { UserService } from "../services/userService";
import { AccessLayer, serverError } from '../constants/global';
import { logHelper } from '../middleware/logger';
import { ErrorDetails } from '../utils/utils.error';
import { isRoleValid, isStatusValid, isStringValid } from '../utils/utils.function';
import { PeriodService } from '../services/periodService';
import { SessionService } from '../services/sessionService';
import { UserAndUserGroupSetType } from '../constants/dataType';
import { EmailService } from '../services/emailService';

const validateRolesCombination = (group: Group, roles: string[]): { status: number, message: string } | null => {
    const isAssessorPresent = roles.includes("Auditor");
    const isPTJPresent = roles.includes("PTJ");

    if (isAssessorPresent && group.role !== "Auditor" && group.role !== "Admin") {
        return { status: 409, message: 'Invalid action' };
    } else if (isPTJPresent && group.role !== "PTJ") {
        return { status: 409, message: 'Invalid action' };
    }
    return null;
};

async function getLatestGroupsList(userId: number): Promise<string> {
    const membershipInfo = await UserService.getUserAndUsergroupSet(userId);
    let latestGroupsList = "";

    if (Array.isArray(membershipInfo)) {
        const groupNames = await Promise.all(
            membershipInfo.map(async (group, index) => {
                const res = await UserService.getUserGroup(group.groupID);
                return `${index + 1}. ${res?.groupName}`;
            })
        );
        latestGroupsList = groupNames.join("\n");
    }

    return latestGroupsList;
}

export async function getUsersAndGroups(req: Request, res: Response) {
    const activeSession = req.params.yearSession;
    try {
        let groups: Group[] = [];
        let users: User[] = [];

        const userRows = await UserService.getUsers();
        if (Array.isArray(userRows) && userRows.length > 0) {
            const list = userRows.map(async (user: User) => {
                const userGroupList = await UserService.getUsersGroupBasedOnUserID(user.userID);
                if (Array.isArray(userGroupList) && userGroupList.length > 0) {
                    const userGroups = await Promise.all(userGroupList.map(async (group) => {
                        const userGroup = await UserService.getUserGroup(group.groupID);
                        return {
                            ...userGroup,
                            groupID: group.groupID || 0,
                            groupName: userGroup?.groupName || '',
                            groupStatus: userGroup?.groupStatus ? true : false,
                            ptjAcademic: userGroup?.ptjAcademic ? true : false,
                            role: userGroup?.role || '',
                            head: group.head ? true : false
                        };
                    }));

                    userGroups.forEach(async (userGroup) => {
                        if (userGroup && userGroup.groupName) {
                            if (userGroup?.role == 'Auditor') {
                                const assignedPTJ = await UserService.getPtjGroupID(user.userID, activeSession);

                                if (assignedPTJ) {
                                    if (Array.isArray(assignedPTJ)) {
                                        user.assignTo = assignedPTJ.map((ptjItem) => {
                                            return {
                                                ptjGroupID: ptjItem.ptjGroupID,
                                                yearSession: ptjItem.yearSession
                                            };
                                        });
                                    }
                                }
                            } else {
                                user.assignTo = null;
                            }
                        }
                    });
                    user.grouping = userGroups;
                } else {
                    user.grouping = [];
                }
                return user;
            })
            users = (await Promise.all(list)).filter((user): user is User => user !== undefined);
        }

        const groupRows = await UserService.getUserGroups();

        if (Array.isArray(groupRows)) {
            groups = await Promise.all(groupRows.map(async (group: Group) => {
                const assignedAuditor = await UserService.getAuditorUserID(group.groupID, activeSession);
                const auditors = Array.isArray(assignedAuditor)
                    ? assignedAuditor.map(item => ({ auditorUserID: item.auditorUserID }))
                    : [];
                return {
                    ...group,
                    groupStatus: group.groupStatus === 1,
                    ptjAcademic: group.ptjAcademic === 1,
                    assignedAuditor: auditors
                };
            }));
        }

        res.json(
            {
                users: users,
                groups: groups
            }
        );
        logHelper(`GET ${req.originalUrl}`, 'getUsersAndGroups', AccessLayer.Controllers);
    } catch (error) {
        console.error(error);
        res.status(500).json(serverError);
        logHelper(`GET ${req.originalUrl}`, 'getUsersAndGroups', AccessLayer.Controllers, error);
    }
}

export async function getAuditors(req: Request, res: Response) {
    try {
        const auditorGroups = await UserService.getAuditorGroup();

        if (!Array.isArray(auditorGroups) || auditorGroups.length === 0) {
            res.status(200).json([]);
            logHelper(`GET ${req.originalUrl}`, 'getAuditors', AccessLayer.Controllers);
            return;
        }

        const groupIds = auditorGroups.map((group: Group) => group.groupID);

        const auditorUserLists = await Promise.all(
            groupIds.map(groupId => UserService.getAuditorUser(groupId))
        );

        const auditorUserList = auditorUserLists.flat();

        if (auditorUserList.length === 0) {
            res.status(200).json([]);
            logHelper(`GET ${req.originalUrl}`, 'getAuditors', AccessLayer.Controllers);
            return;
        }

        const auditorList = await Promise.all(
            auditorUserList.map(auditor => UserService.getUser(auditor.userID))
        );

        const validAuditors = auditorList.filter(user => user !== null);
        const uniqueAuditors = Array.from(new Map(validAuditors.map(user => [user!.userID, user])).values());

        res.status(200).json(uniqueAuditors);
        logHelper(`GET ${req.originalUrl}`, 'getAuditors', AccessLayer.Controllers);
    } catch (error) {
        console.error(error);
        res.status(500).json(serverError);
        logHelper(`GET ${req.originalUrl}`, 'getAuditors', AccessLayer.Controllers, error);
    }
}

export async function createGroup(req: Request, res: Response) {
    const requestPayload: Group = req.body;
    try {
        const validGroups = await UserService.getUserGroups();

        if (
            !isStringValid(requestPayload.groupName) || !isRoleValid(requestPayload.role) ||
            !isStatusValid(Number(requestPayload.groupStatus)) || !isStatusValid(Number(requestPayload.ptjAcademic))
        ) {
            logHelper(`POST ${req.originalUrl}`, 'createGroup', AccessLayer.Controllers, "Invalid request");
            return res.status(400).json(
                { message: "Invalid request" }
            );
        }

        const invalidCharacters = /[?\/]/;
        if (invalidCharacters.test(requestPayload.groupName)) {
            logHelper(`POST ${req.originalUrl}`, 'createGroup', AccessLayer.Controllers, "Invalid request");
            return res.status(400).json(
                { message: "Invalid request" }
            );
        }

        if (Array.isArray(validGroups)) {
            const isDuplicated = validGroups.some(group => group.groupName.toLowerCase() === requestPayload.groupName.toLowerCase());
            if (isDuplicated) {
                logHelper(`POST ${req.originalUrl}`, 'createGroup', AccessLayer.Controllers, 'Invalid action');
                return res.status(409).json(
                    { message: 'Invalid action' }
                );

            } else if (requestPayload.role === 'Admin') {
                logHelper(`POST ${req.originalUrl}`, 'createGroup', AccessLayer.Controllers, 'Invalid action');
                return res.status(409).json(
                    { message: 'Invalid action' }
                );

            }
        }

        const values = [
            [requestPayload.groupName, requestPayload.role, requestPayload.groupStatus, requestPayload.ptjAcademic]
        ]

        const insertId = await UserService.createGroup(values);

        if (insertId) {
            const groupInfo = await UserService.getUserGroup(insertId);
            if (groupInfo) {
                res.status(200).json(
                    {
                        ...groupInfo,
                        groupStatus: groupInfo.groupStatus === 1,
                        ptjAcademic: groupInfo.ptjAcademic === 1
                    }
                );
                logHelper(`POST ${req.originalUrl}`, 'createGroup', AccessLayer.Controllers);
            }
        }
    } catch (error) {
        console.error(error);
        res.status(500).json(serverError);
        logHelper(`POST ${req.originalUrl}`, 'createGroup', AccessLayer.Controllers, error);
    }
}

export async function editGroup(req: Request, res: Response) {
    const requestPayload: Group = req.body;
    const groupID = Number(req.query.groupID);
    const activeSession = req.params.yearSession;

    try {
        const validSession = await PeriodService.getActiveSessions();
        if (Array.isArray(validSession)) {
            if (activeSession !== "unavai!ab!e" && !validSession.some(session => session.yearSession === activeSession)) {
                logHelper(`PATCH ${req.originalUrl}`, 'editGroup', AccessLayer.Controllers, 'Invalid session');
                return res.status(400).json(
                    { message: 'Invalid session' }
                );
            }
        }

        if (!isStringValid(requestPayload.groupName)) {
            logHelper(`PATCH ${req.originalUrl}`, 'editGroup', AccessLayer.Controllers, "Invalid request");
            return res.status(400).json(
                { message: "Invalid request" }
            );
        }

        const invalidCharacters = /[?\/]/;
        if (invalidCharacters.test(requestPayload.groupName)) {
            logHelper(`PATCH ${req.originalUrl}`, 'editGroup', AccessLayer.Controllers, "Invalid request");
            return res.status(400).json(
                { message: "Invalid request" }
            );
        }

        if (requestPayload.auditorUserIDs && requestPayload.role === 'PTJ') {
            const areUserIDsValid = await Promise.all(
                requestPayload.auditorUserIDs.map(async (id) => {
                    const user = await UserService.getUser(id);
                    return !!user;
                })
            );

            if (!areUserIDsValid.every(Boolean)) {
                logHelper(`PATCH ${req.originalUrl}`, 'editGroup', AccessLayer.Controllers, 'Invalid auditorUserIDs');
                return res.status(400).json(
                    { message: 'Invalid request' }
                );
            }
        }

        const existingGroup = await UserService.getUserGroup(groupID);
        if (!existingGroup) {
            logHelper(`PATCH ${req.originalUrl}`, 'editGroup', AccessLayer.Controllers, 'Invalid group');
            return res.status(404).json(
                { message: 'Invalid group' }
            );
        }

        if (
            (requestPayload.role === 'Auditor' || requestPayload.role === 'Admin') &&
            requestPayload.auditorUserIDs && requestPayload.auditorUserIDs.length > 0
        ) {
            logHelper(`PATCH ${req.originalUrl}`, 'editGroup', AccessLayer.Controllers, 'Invalid action');
            return res.status(409).json(
                { message: 'Invalid action' }
            );
        }

        const updatedGroup: Group = {
            ...existingGroup,
            groupName: requestPayload.groupName,
            auditorUserIDs: requestPayload.auditorUserIDs,
        };

        let assignmentValues = [];
        let result;
        let newAssessorEmail: string[] = [];
        
        const notifyGroup = await UserService.getUserGroup(groupID);

        if (activeSession !== "unavai!ab!e" && Array.isArray(validSession) && validSession.length !== 0) {
            const assignedAuditor = await UserService.getAuditorUserID(groupID, activeSession);
            if (Array.isArray(requestPayload.auditorUserIDs)) {
                if (Array.isArray(assignedAuditor)) {
                    const toAddAssignment = requestPayload.auditorUserIDs.filter(
                        (id) => !assignedAuditor.some((item) => item.auditorUserID === id)
                    );

                    if (toAddAssignment.length > 0) {
                        for (const id of toAddAssignment) {
                            const newAssignment = [id, groupID, activeSession];
                            const newAssignedAssessor = await UserService.getUser(id);
                            
                            // Collect new assigned assessors' email
                            newAssessorEmail.push(newAssignedAssessor?.userEmail!);
                            assignmentValues.push(newAssignment);
                        }
                        await UserService.createAssignment(assignmentValues);

                        // Send email notification
                        if (notifyGroup) {
                            await EmailService.notifyTaskAssigned(newAssessorEmail, notifyGroup?.groupName, activeSession);
                        }
                        
                    }

                    const toRemoveAssignment = assignedAuditor
                        .filter((item) => !requestPayload.auditorUserIDs?.includes(item.auditorUserID))
                        .map((item) => item.auditorUserID);

                    if (toRemoveAssignment.length > 0) {
                        for (const id of toRemoveAssignment) {
                            await UserService.deleteAssignment(id, groupID, activeSession);
                        }
                    }
                }
                result = await UserService.updateGroup(groupID, updatedGroup.groupName);
            }
            if (result) {
                const groupInfo = await UserService.getUserGroup(groupID);
                const auditorUserIDs = await UserService.getAuditorUserID(groupID, activeSession);

                if (groupInfo) {
                    res.status(200).json(
                        {
                            ...groupInfo,
                            groupStatus: groupInfo.groupStatus === 1,
                            ptjAcademic: groupInfo.ptjAcademic === 1,
                            assignAuditor: Array.isArray(auditorUserIDs) ? auditorUserIDs.map(item => item.auditorUserID) : []
                        }
                    );
                }
            }
        } else {
            result = await UserService.updateGroup(groupID, updatedGroup.groupName);
            if (result) {
                const groupInfo = await UserService.getUserGroup(groupID);

                if (groupInfo) {
                    res.status(200).json(
                        {
                            ...groupInfo,
                            groupStatus: groupInfo.groupStatus === 1,
                            ptjAcademic: groupInfo.ptjAcademic === 1,
                            assignAuditor: []
                        }
                    );
                }
            }
        }
        logHelper(`PATCH ${req.originalUrl}`, 'editGroup', AccessLayer.Controllers);
    } catch (error) {
        console.error(error);
        res.status(500).json(serverError);
        logHelper(`PATCH ${req.originalUrl}`, 'editGroup', AccessLayer.Controllers, error);
    }
}

export async function changeGropuStatus(req: Request, res: Response) {
    const groupId = Number(req.query.groupID);

    try {
        const blockedGroupIDs = [1, 2];

        if (blockedGroupIDs.includes(groupId)) {
            logHelper(`PATCH ${req.originalUrl}`, 'changeGropuStatus', AccessLayer.Controllers, 'Invalid action');
            return res.status(409).json(
                { message: 'Invalid action' }
            );
        }

        const existingGroup = await UserService.getUserGroup(groupId);

        if (!existingGroup) {
            logHelper(`PATCH ${req.originalUrl}`, 'changeGropuStatus', AccessLayer.Controllers, 'Invalid group');
            return res.status(404).json(
                { message: 'Invalid group' }
            );
        }

        const newGroupStatus = existingGroup.groupStatus === 0 ? 1 : 0;
        const result = await UserService.changeGroupStatus(groupId, newGroupStatus);

        if (result) {
            const groupInfo = await UserService.getUserGroup(groupId);

            if (groupInfo) {
                res.status(200).json(
                    {
                        groupID: groupId,
                        groupName: groupInfo.groupName,
                        role: groupInfo.role,
                        groupStatus: groupInfo.groupStatus === 1,
                        ptjAcademic: groupInfo.ptjAcademic === 1,
                    }
                );
            }
            logHelper(`PATCH ${req.originalUrl}`, 'changeGropuStatus', AccessLayer.Controllers);
        }
    } catch (error) {
        console.error('Error change group status:', error);
        res.status(500).json(serverError);
        logHelper(`PATCH ${req.originalUrl}`, 'changeGropuStatus', AccessLayer.Controllers, error);
    }
}

export async function removeGroup(req: Request, res: Response) {
    const groupId = Number(req.query.groupID);

    try {
        const blockedGroupIDs = [1, 2];

        if (blockedGroupIDs.includes(groupId)) {
            logHelper(`PATCH ${req.originalUrl}`, 'removeGroup', AccessLayer.Controllers, 'Invalid action');
            return res.status(409).json(
                { message: 'Invalid action' }
            );
        }

        const existingGroup = await UserService.getUserGroup(groupId);

        if (!existingGroup) {
            logHelper(`PATCH ${req.originalUrl}`, 'removeGroup', AccessLayer.Controllers, 'Invalid group');
            return res.status(404).json(
                { message: 'Invalid group' }
            );
        }

        const result = await UserService.removeGroup(groupId);

        if (result) {
            res.json(
                {
                    groupID: groupId,
                    groupName: existingGroup.groupName,
                    role: existingGroup.role,
                    groupStatus: existingGroup.groupStatus === 1,
                    ptjAcademic: existingGroup.ptjAcademic === 1,
                }
            );
            logHelper(`PATCH ${req.originalUrl}`, 'removeGroup', AccessLayer.Controllers);
        }
    } catch (error) {
        const errorDetails: ErrorDetails = JSON.parse((error as Error).message);

        if (errorDetails.details.sqlState === "23000") {
            res.status(400).json(
                { message: 'Foreign key constraint violation: Associated records exist' }
            );
        } else {
            console.error(error);
            res.status(500).json(serverError);
        }
        logHelper(`PATCH ${req.originalUrl}`, 'removeGroup', AccessLayer.Controllers, error);
    }
}

export async function createUser(req: Request, res: Response) {
    const requestPayload: User = req.body;
    try {
        if (!isStatusValid(Number(requestPayload.userStatus))) {
            logHelper(`POST ${req.originalUrl}`, 'createUser', AccessLayer.Controllers, "Invalid request");
            return res.status(400).json(
                { message: "Invalid request" }
            );
        }

        const validUsers = await UserService.getUsers();

        if (Array.isArray(validUsers)) {
            const isDuplicated = validUsers.some(user => user.userEmail === requestPayload.userEmail);
            if (isDuplicated) {
                logHelper(`POST ${req.originalUrl}`, 'createUser', AccessLayer.Controllers, 'Invalid action');
                return res.status(409).json(
                    { message: 'Invalid action' }
                );
            }
        }

        if (Array.isArray(requestPayload.grouping) && requestPayload.grouping.length !== 0) {
            const roles = requestPayload.grouping.map(group => group.role);

            for (const group of requestPayload.grouping) {
                const existingGroup = await UserService.getUserGroup(group.groupID);
                if (!existingGroup) {
                    logHelper(`POST ${req.originalUrl}`, 'createUser', AccessLayer.Controllers, 'Invalid group');
                    return res.status(404).json(
                        { message: 'Invalid group' }
                    );
                }

                if (existingGroup.groupStatus === 0) {
                    logHelper(`POST ${req.originalUrl}`, 'createUser', AccessLayer.Controllers, 'Invalid action');
                    return res.status(409).json(
                        { message: 'Invalid action' }
                    );
                }

                const validationResult = validateRolesCombination(group, roles);
                if (validationResult) {
                    logHelper(`POST ${req.originalUrl}`, 'createUser', AccessLayer.Controllers, validationResult.message);
                    return res.status(validationResult.status).json({ message: validationResult.message });
                }
            }
        }

        const newUserValues = [
            [requestPayload.userEmail, requestPayload.userStatus]
        ]

        const insertId = await UserService.createUser(newUserValues);

        if (insertId) {
            const userInfo = await UserService.getUser(insertId);

            if (Array.isArray(requestPayload.grouping) && requestPayload.grouping.length !== 0) {
                const newMembership: UserAndUserGroupSetType[] = [];
                for (const group of requestPayload.grouping) {
                    const membership: UserAndUserGroupSetType = [insertId, group.groupID, group.head!];
                    newMembership.push(membership);
                }

                if (newMembership.length > 0) {
                    await UserService.createUserAndUsergroupSet(newMembership);
                    if (userInfo) {
                        // Send email notification
                        const latestGroupsList = await getLatestGroupsList(userInfo.userID);
                        await EmailService.notifyNewUserinvited(userInfo?.userEmail, latestGroupsList);
                        res.status(200).json(
                            {
                                ...userInfo,
                                userStatus: userInfo.userStatus ? true : false,
                                groupMemberships: newMembership.length
                            }
                        );
                        logHelper(`POST ${req.originalUrl}`, 'createUser', AccessLayer.Controllers);
                    }
                }
            }
        }
    } catch (error) {
        const errorDetails: ErrorDetails = JSON.parse((error as Error).message);

        if (errorDetails.details.sqlState === "45000") {
            res.status(404).json(
                { message: errorDetails.details.sqlMessage }
            );
        } else {
            console.error(error);
            res.status(500).json(serverError);
        }
        logHelper(`POST ${req.originalUrl}`, 'createUser', AccessLayer.Controllers, error);
    }
}

export async function editUser(req: Request, res: Response) {
    const requestPayload: User = req.body;
    const userId = Number(req.query.userID);
    const activeSession = req.params.yearSession;

    try {
        const existingUser = await UserService.getUser(userId);

        const validSession = await PeriodService.getActiveSessions();
        if (Array.isArray(validSession)) {
            if (activeSession !== "unavai!ab!e" && !validSession.some(session => session.yearSession === activeSession)) {
                logHelper(`PATCH ${req.originalUrl}`, 'editUser', AccessLayer.Controllers, 'Invalid session');
                return res.status(404).json(
                    { message: 'Invalid session' }
                );
            }
        }

        if (!existingUser) {
            logHelper(`PATCH ${req.originalUrl}`, 'editUser', AccessLayer.Controllers, 'Invalid user');
            return res.status(404).json(
                { message: 'Invalid user' }
            );
        }

        if (Array.isArray(requestPayload.grouping) && requestPayload.grouping.length !== 0) {
            const roles = requestPayload.grouping.map(group => group.role);

            for (const group of requestPayload.grouping) {
                const existingGroup = await UserService.getUserGroup(group.groupID);
                if (!existingGroup) {
                    logHelper(`PATCH ${req.originalUrl}`, 'editUser', AccessLayer.Controllers, 'Invalid group');
                    return res.status(404).json(
                        { message: 'Invalid group' }
                    );
                }

                if (existingGroup.groupStatus === 0) {
                    logHelper(`PATCH ${req.originalUrl}`, 'editUser', AccessLayer.Controllers, 'Invalid action');
                    return res.status(409).json(
                        { message: 'Invalid action' }
                    );
                }

                const validationResult = validateRolesCombination(group, roles);
                if (validationResult) {
                    logHelper(`POST ${req.originalUrl}`, 'createUser', AccessLayer.Controllers, validationResult.message);
                    return res.status(validationResult.status).json({ message: validationResult.message });
                }
            }
        }

        const existingMembership = await UserService.getUserAndUsergroupSet(userId);
        if (Array.isArray(existingMembership)) {
            const missingMembership = existingMembership.filter((prevMembership: Group) =>
                !requestPayload.grouping?.some((membership) => membership.groupID === prevMembership.groupID)
            );

            const leftExistingMembership = existingMembership.filter((prevMembership: Group) =>
                requestPayload.grouping?.some((membership) => membership.groupID === prevMembership.groupID)
            );

            if (missingMembership.length > 0) {
                if (activeSession !== "unavai!ab!e" && Array.isArray(validSession) && validSession.length !== 0) {
                    const assignedPTJ = await UserService.getPtjGroupID(userId, activeSession);
                    if (Array.isArray(assignedPTJ) && assignedPTJ.length > 0) {
                        const newGroups = requestPayload.grouping?.filter((membership: Group) =>
                            !existingMembership.some((newMembership: Group) => newMembership.groupID === membership.groupID)
                        ) || [];

                        const [missingMembershipAuditors, leftMembershipAuditors, newMembershipAuditors] = await Promise.all([
                            Promise.all(missingMembership.map(async membership => {
                                const target = await UserService.getUserGroup(membership.groupID);
                                return target?.role === "Auditor";
                            })),
                            Promise.all(leftExistingMembership.map(async membership => {
                                const target = await UserService.getUserGroup(membership.groupID);
                                return target?.role === "Auditor";
                            })),
                            Promise.all(newGroups.map(async membership => {
                                const target = await UserService.getUserGroup(membership.groupID);
                                return target?.role === "Auditor";
                            }))
                        ]);

                        const missingMembershipHasAuditor = missingMembershipAuditors.some(isAuditor => isAuditor);
                        const leftMembershipHasAuditor = leftMembershipAuditors.some(isAuditor => isAuditor);
                        const newMembershipHasAuditor = newMembershipAuditors.some(isAuditor => isAuditor);

                        if (!leftMembershipHasAuditor && missingMembershipHasAuditor && !newMembershipHasAuditor) {
                            logHelper(`PATCH ${req.originalUrl}`, 'editUser', AccessLayer.Controllers, 'Unable to change user role');
                            return res.status(400).json(
                                { message: 'Unable to change user role.' }
                            )
                        }
                    }
                }

                await Promise.all(
                    missingMembership.map((membership: UserGroupSet) =>
                        UserService.removeUserAndUsergroupSet(membership.userID, membership.groupID)
                    )
                );
            }

            const updatedMembership = existingMembership.filter((prevMembership: Group) =>
                requestPayload.grouping?.some((membership) => membership.groupID === prevMembership.groupID)
            );

            if (updatedMembership.length > 0 && Array.isArray(requestPayload.grouping)) {
                for (const membership of requestPayload.grouping) {
                    await UserService.updateUserAndUsergroupSet(userId, membership.groupID, membership.head!)
                }
            }

            if (Array.isArray(requestPayload.grouping) && requestPayload.grouping.length !== 0) {
                const newGroups = requestPayload.grouping.filter((membership: Group) =>
                    !existingMembership.some((newMembership: Group) => newMembership.groupID === membership.groupID)
                );

                const newMembership: UserAndUserGroupSetType[] = [];
                for (const group of newGroups) {
                    const membership: UserAndUserGroupSetType = [userId, group.groupID, group.head!];
                    newMembership.push(membership);
                }

                if (newMembership.length > 0) {
                    await UserService.createUserAndUsergroupSet(newMembership);
                }
            }
        }

        const userInfo = await UserService.getUser(userId);
        // Get latest group list
        const latestGroupsList = await getLatestGroupsList(userId);

        if (userInfo) {
            // Send email notification
            await EmailService.notifyRoleChanged(userInfo?.userEmail, latestGroupsList);

            // Remove the user session in database
            await SessionService.removeUserSession(userId);
            res.status(200).json(
                {
                    ...userInfo,
                    userStatus: userInfo.userStatus ? true : false,
                    groupMemberships: requestPayload.grouping?.length
                }
            );
            logHelper(`PATCH ${req.originalUrl}`, 'editUser', AccessLayer.Controllers);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json(serverError);
        logHelper(`PATCH ${req.originalUrl}`, 'editUser', AccessLayer.Controllers, error, true);
    }
}

export async function removeUser(req: Request, res: Response) {
    const userId = Number(req.query.userID);
    try {
        const existingUser = await UserService.getUser(userId);

        if (userId === 1) {
            logHelper(`POST ${req.originalUrl}`, 'removeUser', AccessLayer.Controllers, 'Invalid action');
            return res.status(409).json(
                { message: 'Invalid action' }
            );
        }

        if (!existingUser) {
            logHelper(`POST ${req.originalUrl}`, 'removeUser', AccessLayer.Controllers, 'Invalid user');
            return res.status(404).json(
                { message: 'Invalid user' }
            );
        }

        await UserService.removeAllUserAndUsergroupSet(userId);
        const result = await UserService.removeUser(userId);
        await SessionService.removeUserSession(userId);

        if (result) {
            // Send email notification
            await EmailService.notifyUserRemoved(existingUser.userEmail);
            res.status(200).json(
                {
                    ...existingUser,
                    userStatus: false
                }
            );
            logHelper(`POST ${req.originalUrl}`, 'removeUser', AccessLayer.Controllers);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json(serverError);
        logHelper(`POST ${req.originalUrl}`, 'removeUser', AccessLayer.Controllers, error, true);
    }
}