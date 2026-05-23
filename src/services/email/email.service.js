/**
 * @file email.service.js
 * @description handles all email sending operations — transporter setup, and email templates.
 */

import nodemailer from "nodemailer";
import { createInternalError } from "../../errors/error.factory.js";
import { MESSAGES } from "../../constants/messages.js";
import { env } from "../../config/env.js";

// --- Transporter -----------------------------------------------------

export let transporter = null;

// Creates and stores the nodemailer transporter using env config.
export const initializeEmailTransporter = () => {
  transporter = nodemailer.createTransport({
    host: env.EMAIL.HOST || "smtp.gmail.com",
    port: env.EMAIL.PORT,
    secure: env.EMAIL.SECURE === "true",
    tls: {
      rejectUnauthorized: env.EMAIL.TLS_REJECT_UNAUTHORIZED,
    },
    socketTimeout: 10000,
    socketOptions: { family: 4 },
    auth: {
      user: env.EMAIL.USER,
      pass: env.EMAIL.PASSWORD,
    },
  });
};

// Verifies the transporter connection - exits process if mail server is unreachable.
export const verifyEmailTransporter = async () => {
  if (!transporter) initializeEmailTransporter();

  try {
    await transporter.verify();
  } catch (err) {
    console.error("Mail server connection failed — check EMAIL config");
    // if (env.isDevelopment) {
    //   process.exit(1);
    // }
  }
};

// --- Base Sender -----------------------------------------------------
/**
 * Sends an email using the configured transporter.
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.html
 */
export const sendEmail = async ({ to, subject, html }) => {
  if (!transporter) initializeEmailTransporter();

  try {
    // 1. Send email via transporter
    await transporter.sendMail({
      from: env.EMAIL.FROM,
      to,
      subject,
      html,
    });
  } catch (error) {
    // 2. Throw internal error if sending fails
    console.log(error);
    throw createInternalError(MESSAGES.ERROR.FAILED_TO_SEND_EMAIL);
  }
};
