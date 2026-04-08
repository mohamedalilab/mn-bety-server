import BaseJoi from "../../config/joi.js";
import { MESSAGES } from "../../constants/messages.js";

export const registerSchema = {
  body: BaseJoi.object({
    fullName: BaseJoi.string().min(2).max(50).trim().required().messages({
      "string.min": "Name must be at least 2 characters",
      "string.max": "Name cannot exceed 50 characters",
      "any.required": "Name is required",
    }),

    email: BaseJoi.string().email().lowercase().trim().required().messages({
      "string.email": MESSAGES.VALIDATION.INVALID_EMAIL,
      "any.required": "Email is required",
    }),

    password: BaseJoi.string().min(8).max(128).required().messages({
      "string.min": "Password must be at least 8 characters",
      "any.required": "Password is required",
    }),
  }),
};

export const loginSchema = {
  body: BaseJoi.object({
    email: BaseJoi.string().email().lowercase().trim().required(),
    password: BaseJoi.string().required(),
  }),
};

export const getUserSchema = {
  // Validates /users/:id
  params: BaseJoi.object({
    id: BaseJoi.objectId().required(),
  }),
};

export const updateUserSchema = {
  params: BaseJoi.object({
    id: BaseJoi.objectId().required(),
  }),

  body: BaseJoi.object({
    name: BaseJoi.string().min(2).max(50).trim().optional(),
    email: BaseJoi.string().email().lowercase().trim().optional(),
    phone: BaseJoi.number().optional(),
  }).min(1),
};

export const listUsersSchema = {
  query: BaseJoi.object({
    page: BaseJoi.number().integer().positive().default(1),
    limit: BaseJoi.number().integer().positive().max(100).default(20),
    search: BaseJoi.string().trim().max(100).optional(),
  }),
};

// POST /auth/forgot-password
// user just enters their email to receive the reset link
export const forgotPasswordSchema = {
  body: BaseJoi.object({
    email: BaseJoi.string().email().lowercase().trim().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
  }),
};

// POST /auth/reset-password
// user comes from the email link — submits token + new password
export const resetPasswordSchema = {
  body: BaseJoi.object({
    token: BaseJoi.string().trim().required().messages({
      "any.required": "Reset token is required",
    }),

    newPassword: BaseJoi.string().min(8).max(128).required().messages({
      "string.min": "Password must be at least 8 characters",
      "any.required": "New password is required",
    }),
  }),
};

// PATCH /auth/change-password
// user is logged in — must provide current password to authorize the change
// token comes from requireVerifiedEmailMW + verifyAccessMW, not the body
export const changePasswordSchema = {
  body: BaseJoi.object({
    currentPassword: BaseJoi.string().required().messages({
      "any.required": "Current password is required",
    }),

    newPassword: BaseJoi.string().min(8).max(128).required().messages({
      "string.min": "Password must be at least 8 characters",
      "any.required": "New password is required",
    }),
  }),
};
