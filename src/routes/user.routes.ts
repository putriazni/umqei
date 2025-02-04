import { Router } from "express";
import {
    changeGropuStatus,
    createGroup,
    createUser,
    editGroup,
    editUser,
    getAuditors,
    getUsersAndGroups,
    removeGroup,
    removeUser
} from "../controllers/user.controller";

const router = Router();

router.route(`/list&${"session="}:yearSession`).get(getUsersAndGroups);
router.route('/auditorlist').get(getAuditors);
router.route(`/grouplist/creation`).post(createGroup);
router.route(`/grouplist/${"session="}:yearSession&edition`).patch(editGroup);
router.route('/grouplist/deletion').post(removeGroup);
router.route(`/grouplist/activation`).patch(changeGropuStatus);

router.route('/list/creation').post(createUser);
router.route(`/list/${"session="}:yearSession&edition`).patch(editUser);
router.route('/list/deletion').post(removeUser);

export default router;