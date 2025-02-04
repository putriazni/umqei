import { Router } from "express";
import { getComments, updateComment } from "../controllers/comment.controller";

const router = Router();

router.route(`/:session/${"key="}:id&${"groupID="}:groupID`).get(getComments);
router.route('/comment').patch(updateComment);

export default router;