import { MESSAGES } from "../constants/messages.js";
import { createBadRequestError } from "../errors/error.factory.js";

// The sources of data we can validate on an Express request.
const SOURCES = ["body", "params", "query"];

// Global Joi validation options applied to every schema validation.
const JOI_OPTIONS = {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
};

// Turns Joi's raw error details into clean { field, message } objects
const formatErrors = (details) =>
  details.map(({ path, message }) => ({
    field: path.join("."),
    message: message.replace(/['"]/g, ""),
  }));

/**
 * Validation middleware factory — validates req sources against Joi schemas
 * @param {{ body?: import('joi').Schema, params?: import('joi').Schema, query?: import('joi').Schema }} schemas - Joi schemas per source
 * @returns {import('express').RequestHandler}
 */
export const validateMW = (schemas = {}) => {
  // 1. Determine which sources actually have a schema defined
  const activeSources = SOURCES.filter((source) => schemas[source]);

  return (req, res, next) => {
    const allErrors = [];
    const validated = {};

    for (const source of activeSources) {
      // validate returns { value, error }
      const { value, error } = schemas[source].validate(
        req[source] ?? {},
        JOI_OPTIONS
      );
      if (error) {
        // Collect errors from this source — don't stop at first failing source
        allErrors.push(...formatErrors(error.details));
      } else {
        // Only store cleaned value if this source fully passed
        validated[source] = value;
      }
    }

    // If any source had errors, reject the entire request
    if (allErrors.length > 0) {
      return next(
        createBadRequestError(MESSAGES.VALIDATION_FAILED, { errors: allErrors })
      );
    }

    for (const source of activeSources) {
      req[source] = validated[source];
    }

    req.validated = validated;

    next();
  };
};
