import Joi from "joi";
import { REGEX } from "../utils/regex.util.js";

/**
 * extending it here to add a custom "objectId" type so we can validate
 * MongoDB ObjectIds cleanly in any schema: Joi.objectId()
 */
const BaseJoi = Joi.extend((joi) => ({
  type: "objectId",
  base: joi.string(),
  messages: {
    "objectId.invalid": "{{#label}} must be a valid MongoDB ObjectId",
  },
  validate(value, helpers) {
    if (REGEX.OBJECT_ID.test(value)) {
      return { value, errors: helpers.error("objectId.invalid") };
    }
  },
}));

export default BaseJoi;
