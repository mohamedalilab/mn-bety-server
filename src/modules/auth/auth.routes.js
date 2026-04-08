import express from "express";
import * as AuthController from "./auth.controller.js";
import { verifyAccessMW } from "../../middlewares/verifyAccessMW.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "./auth.validation.js";
import { validateMW } from "../../middlewares/validateMW.js";

// ============================================================
//                        AUTH ROUTES
// ============================================================

const router = express.Router();

// ----------------- Public Routes -----------------
router.post("/register", validateMW(registerSchema), AuthController.register);

router.post("/verify-email", AuthController.verifyEmail);

router.post("/login", validateMW(loginSchema), AuthController.login);

router.post("/logout", AuthController.logout);

router.post("/refresh-token", AuthController.refreshToken);

router.post(
  "/forgot-password",
  validateMW(forgotPasswordSchema),
  AuthController.forgotPassword
);

router.post(
  "/reset-password",
  validateMW(resetPasswordSchema),
  AuthController.resetPassword
);

// ----------------- Private Routes -----------------
router.use(verifyAccessMW);

router.patch(
  "/change-password",
  validateMW(changePasswordSchema),
  AuthController.changePassword
);

router.post("/resend-verification", AuthController.resendVerification);

router.get("/me", AuthController.getMe);

router.patch("/me", AuthController.updateMe);

router.delete("/delete-account", AuthController.deleteAccount);

export default router;
