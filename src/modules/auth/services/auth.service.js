import mongoose from "mongoose";
import User from "../../../DB/models/user.model.js";
import Customer from "../../../DB/models/customer.model.js";
import { env } from "../../../config/env.js";
import { MESSAGES } from "../../../constants/messages.js";
import { ROLES } from "../../../constants/roles.js";
import {
  decodeToken,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../../services/token.service.js";
import {
  createBadRequestError,
  createConflictError,
  createUnauthorizedError,
} from "../../../errors/error.factory.js";
import {
  generateHashedToken,
  hashValue,
  verifyPassword,
} from "../../../utils/hash.util.js";
import { getExpiryDate } from "../../../utils/date.util.js";
import { safeUserData } from "../../../helpers/user.helper.js";
import { sendEmail } from "../../../services/email/email.service.js";
import {
  passwordResetEmailHtml,
  verificationEmailHtml,
  welcomeEmailHtml,
} from "../../../services/email/email.templates.js";

// ============================================================
//                      AUTH SERVICE
// ============================================================

/**
 * @desc    Register a new user, generate and store tokens
 * @param   {Object} userData - Raw user data from request body
 * @returns {Object} user, accessToken, refreshToken
 */
export const registerUser = async (userData) => {
  // 1. check if email already used
  const emailExist = await User.findOne({ email: userData.email }).exec();
  if (emailExist) {
    // if verified: block registering
    if (emailExist.emailVerified) {
      throw createConflictError(MESSAGES.USER.EMAIL_ALREADY_EXISTS);
    }

    // if unverified + token expired: delete old account, allow re-register
    if (emailExist.emailVerificationToken?.expireAt < new Date()) {
      await emailExist.deleteOne();
    } else {
      // unverified but token still valid → tell them to check inbox
      throw createConflictError(MESSAGES.EMAIL.EMAIL_PENDING_VERIFICATION);
    }
  }

  // 2. create object_id for user
  const userId = new mongoose.Types.ObjectId();

  // 3. define user roles: default: ["customer"]
  const roles = [ROLES.CUSTOMER];

  // 4. generate access and refresh token
  const accessToken = generateAccessToken({
    userId: userId,
    roles,
  });
  const refreshToken = generateRefreshToken({ userId });

  // 5. hash new refresh token with expireAt in array
  const hashedToken = hashValue(refreshToken);
  const refreshTokens = [
    { token: hashedToken, expireAt: getExpiryDate(env.JWT.REFRESH_EXPIRE) },
  ];

  // 6. generate email verification token
  // const { token: verificationToken, hashed: hashedVerificationToken } =
  //   generateHashedToken();

  // 7. create & save user in DB
  const user = await User.create({
    _id: userId,
    ...userData,
    roles,
    emailVerified: true,
    refreshTokens,
    // emailVerificationToken: {
    //   token: hashedVerificationToken,
    //   expireAt: getExpiryDate(env.AUTH.EMAIL_VERIFICATION_EXPIRE),
    // },
  });

  // 8. create customer profile
  await Customer.create({ userId: user._id });

  // 9. send verification email
  // const VERIFY_URL = `${env.CLIENT_URL}/verify-email?token=${verificationToken}`;
  // await sendEmail({
  //   to: user.email,
  //   subject: MESSAGES.EMAIL.SUBJECTS.VERIFICATION,
  //   html: verificationEmailHtml(VERIFY_URL),
  // });

  // 10. return safe user data + tokens
  return {
    user: safeUserData(user),
    accessToken,
    refreshToken,
  };
};

// ------------------------------------------------------------

/**
 * @desc    Verify email using token from link
 * @param   {string} token - Raw token from body
 * @returns {void}
 */
export const verifyEmail = async (token) => {
  // 1. hash the incoming token to compare with DB
  const hashedToken = hashValue(token);

  // 2. find user with token and make sure it hasn't expired
  const user = await User.findOne({
    "emailVerificationToken.token": hashedToken,
    "emailVerificationToken.expireAt": { $gt: new Date() },
  }).exec();
  if (!user)
    throw createBadRequestError(MESSAGES.EMAIL.INVALID_VERIFICATION_TOKEN);

  // 3. check if already verified
  if (user.emailVerified)
    throw createBadRequestError(MESSAGES.EMAIL.ALREADY_VERIFIED);

  // 4. mark as verified + clear token fields
  user.emailVerified = true;
  user.emailVerificationToken.token = null;
  user.emailVerificationToken.expireAt = null;

  // 5. save changes in DB
  await user.save();

  // 6. send verification email
  await sendEmail({
    to: user.email,
    subject: MESSAGES.EMAIL.SUBJECTS.WELCOME,
    html: welcomeEmailHtml(user.fullName),
  });
};

// ------------------------------------------------------------

/**
 * @desc    Resend verification email with cooldown check
 * @param   {string} userId
 * @returns {void}
 */
export const resendVerificationEmail = async (userId) => {
  // 1. find user by id
  const user = await User.findById(userId).exec();
  if (!user) throw createBadRequestError(MESSAGES.USER.NOT_FOUND);

  // 2. check if already verified
  if (user.emailVerified)
    throw createBadRequestError(MESSAGES.EMAIL.EMAIL_ALREADY_VERIFIED);

  // 3. cooldown — block resend if token was issued less than 1 min ago
  const ONE_MINUTE = 60 * 1000;
  const tokenExpiry = user.emailVerificationToken?.expireAt;
  const verificationExpireMs =
    getExpiryDate(env.AUTH.EMAIL_VERIFICATION_EXPIRE).getTime() - Date.now();
  if (
    tokenExpiry &&
    tokenExpiry.getTime() - Date.now() > verificationExpireMs - ONE_MINUTE
  ) {
    throw createBadRequestError(
      MESSAGES.EMAIL.VERIFICATION_EMAIL_RECENTLY_SENT
    );
  }

  // 4. generate new token with hashing
  const { token, hashed } = generateHashedToken();

  // 5. replace old token + expiry
  user.emailVerificationToken = {
    token: hashed,
    expireAt: getExpiryDate(env.AUTH.EMAIL_VERIFICATION_EXPIRE),
  };

  // 6. save changes in DB
  await user.save();

  // 7. send new verification email
  const VERIFY_URL = `${env.CLIENT_URL}/verify-email?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: MESSAGES.EMAIL.SUBJECTS.VERIFICATION,
    html: verificationEmailHtml(VERIFY_URL),
  });
};

// ------------------------------------------------------------

/**
 * @desc    Validate credentials and generate tokens
 * @param   {string} email    - User email address
 * @param   {string} password - User plain text password
 * @returns {Object} user, accessToken, refreshToken
 */
export const loginUser = async (email, password, currentRefreshToken) => {
  // 1. check if user exists
  const user = await User.findOne({ email }).exec();
  if (!user) throw createUnauthorizedError(MESSAGES.AUTH.LOGIN_FAILED);

  // 2. validate password
  const validPwd = await verifyPassword(password, user.password);
  if (!validPwd) throw createUnauthorizedError(MESSAGES.AUTH.LOGIN_FAILED);

  // 3. clean up expire tokens first !!!!!
  user.refreshTokens = user.refreshTokens.filter(
    (rt) => rt.expireAt > new Date()
  );

  // 4. handle existing refresh token cookie
  if (currentRefreshToken) {
    // hash token to find it
    const currentHashedToken = hashValue(currentRefreshToken);
    const tokenInDB = user.refreshTokens.find(
      (rt) => rt.token === currentHashedToken
    );
    // if cookie exists but not in DB => token was already rotated
    // else so its old token => remove it + clean up any expired tokens
    if (!tokenInDB) {
      const decoded = decodeToken(currentRefreshToken);
      // check if token was generated before password change
      // if generated after change:
      // it may user token has been rotated - wipe all including
      if (
        !decoded?.iat ||
        !user.passwordChangedAt ||
        !user.changedPasswordAfter(decoded.iat)
      ) {
        user.refreshTokens = [];
      }
    } else {
      user.refreshTokens = user.refreshTokens.filter(
        (rt) => rt.token !== currentHashedToken
      );
    }
  }

  // 5. generate access and refresh token
  const accessToken = generateAccessToken({
    userId: user._id,
    roles: user.roles,
  });
  const refreshToken = generateRefreshToken({ userId: user._id });

  // 6. hash new refresh token and store it
  const hashedToken = hashValue(refreshToken);
  user.refreshTokens.push({
    token: hashedToken,
    expireAt: getExpiryDate(env.JWT.REFRESH_EXPIRE),
  });

  // 7. update last login & save changes in DB
  user.lastLogin = new Date();
  await user.save();

  // 8. return safe user data + tokens
  return {
    user: safeUserData(user),
    accessToken,
    refreshToken,
  };
};

// ------------------------------------------------------------

/**
 * @desc    Invalidate refresh token on logout
 * @param   {string} refreshToken - Token stored in httpOnly cookie
 * @returns {void}
 */
export const logoutUser = async (refreshToken) => {
  // 1. decode refreshToken
  const decoded = decodeToken(refreshToken);
  if (!decoded || !decoded.userId) return;
  // 2. check if user exist
  const user = await User.findById(decoded.userId).exec();
  if (!user) return;
  // 3. hash token & detect token reused
  const hashedToken = hashValue(refreshToken);
  const tokenInDB = user.refreshTokens.find((rt) => rt.token === hashedToken);
  if (!tokenInDB) {
    // check if token was generated before password change
    // if generated after change:
    // it may user token has been rotated - wipe all including
    if (
      !decoded?.iat ||
      !user.passwordChangedAt ||
      !user.changedPasswordAfter(decoded.iat)
    ) {
      user.refreshTokens = [];
    }
  } else {
    // just remove token from user
    user.refreshTokens = user.refreshTokens.filter(
      (rt) => rt.token !== hashedToken
    );
  }
  // 4. save changes inDB
  await user.save();
};

// ------------------------------------------------------------

/**
 * @desc    Verify refresh token and issue new access token
 * @param   {string} refreshToken - Token stored in httpOnly cookie
 * @returns {Object} accessToken
 */
export const refreshTokens = async (currentRefreshToken) => {
  // 1. hash current refreshToken
  const hashedToken = hashValue(currentRefreshToken);

  // 2. find user who owns this token
  const user = await User.findOne({
    "refreshTokens.token": hashedToken,
  }).exec();

  // if no user => detect token reused
  if (!user) {
    // extract userId with decodeing without verifying
    const decoded = decodeToken(currentRefreshToken);
    if (decoded?.userId) {
      const userTarget = await User.findById(decoded.userId).exec();
      if (userTarget) {
        // check if token was generated before password change
        // if generated after change:
        // its real reuse attack - wipe all including current device
        if (
          !userTarget.passwordChangedAt ||
          !userTarget.changedPasswordAfter(decoded.iat)
        ) {
          userTarget.refreshTokens = [];
          await userTarget.save();
        }
      }
    }
    // then force re-login
    throw createUnauthorizedError(MESSAGES.AUTH.INVALID_TOKEN);
  }

  // 3. verify token - it already handled error
  verifyRefreshToken(currentRefreshToken);

  // 4. generate new access & refresh tokens
  const accessToken = generateAccessToken({
    userId: user._id,
    roles: user.roles,
  });
  const refreshToken = generateRefreshToken({ userId: user._id });

  // 5. remove used token + clean up expired tokens
  user.refreshTokens = user.refreshTokens.filter(
    (rt) => rt.token !== hashedToken && rt.expireAt > new Date()
  );

  // 6. hash new token and add it with expire date & save
  const hashedNewToken = hashValue(refreshToken);
  user.refreshTokens.push({
    token: hashedNewToken,
    expireAt: getExpiryDate(env.JWT.REFRESH_EXPIRE),
  });
  await user.save();

  // 7. return tokens to controllers
  return { accessToken, refreshToken };
};

// ------------------------------------------------------------

/**
 * Changes the password for an already authenticated user.
 * @param {string} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 * @param {string} refreshToken
 */
export const changePassword = async (
  userId,
  currentPassword,
  newPassword,
  refreshToken
) => {
  // 1. find user by id
  const user = await User.findById(userId).exec();
  if (!user) throw createNotFoundError(MESSAGES.USER.NOT_FOUND);

  // 2. verify current password
  const valid = await verifyPassword(currentPassword, user.password);
  if (!valid)
    throw createUnauthorizedError(MESSAGES.AUTH.INVALID_CURRENT_PASSWORD);

  // 3. make sure new password is not same as old one
  const isSame = await verifyPassword(newPassword, user.password);
  if (isSame) throw createBadRequestError(MESSAGES.AUTH.SAME_PASSWORD);

  // 4. add newPassword in user and remember it will hash in model !!!
  user.password = newPassword;

  // 5. invalidate all refresh tokens for security except the current device !!!
  let currentHashToken;
  if (refreshToken) {
    currentHashToken = hashValue(refreshToken);
  }

  user.refreshTokens = currentHashToken
    ? user.refreshTokens.filter((rtoken) => rtoken.token === currentHashToken)
    : [];

  // 6. save changes in DB
  await user.save();
};

// ------------------------------------------------------------

/**
 * @desc Generates a password reset token and sends it via email.
 * @param {string} email
 * @reminder Always returns success to avoid user enumeration.
 */
export const forgotPassword = async (email) => {
  // 1. find user by email — silently return if not found to prevent user enumeration
  const user = await User.findOne({ email }).exec();
  if (!user) return;

  // 2. generate token with hashing
  const { token, hashed } = generateHashedToken();

  // 3. create reset token objet & save in DB
  const passwordResetToken = {
    token: hashed,
    expireAt: getExpiryDate(env.AUTH.RESET_PASSWORD_EXPIRE),
  };
  user.passwordResetToken = passwordResetToken;
  await user.save();

  // 4. send reset email with token
  const url = `${env.CLIENT_URL}/auth/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: MESSAGES.EMAIL.SUBJECTS.PASSWORD_RESET,
    html: passwordResetEmailHtml(url),
  });
};

// ------------------------------------------------------------

/**
 * Resets the user's password using the token from the reset link.
 * @param {string} token - reset token
 * @param {string} newPassword - new plain-text password
 */
export const resetPassword = async (token, newPassword) => {
  // 1. hash the incoming token to compare with DB
  const hashedToken = hashValue(token);

  // 2. find user with token and make sure it hasn't expire
  const user = await User.findOne({
    "passwordResetToken.token": hashedToken,
    "passwordResetToken.expireAt": { $gt: new Date() },
  }).exec();
  if (!user) throw createBadRequestError(MESSAGES.AUTH.INVALID_RESET_TOKEN);

  // 3. add newPassword in user and remember it will hash in model !!!!
  user.password = newPassword;

  // 4. clear reset token fields
  user.passwordResetToken.token = null;
  user.passwordResetToken.expireAt = null;

  // 5. invalidate all refresh tokens for security
  user.refreshTokens = [];

  // save changes in DB
  await user.save();
};
