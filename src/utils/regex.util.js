export const REGEX = {
  OBJECT_ID: /^[a-f\d]{24}$/i,
  EMAIL: /^(?!.*\.\.)[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s])\S{8,}$/,
  PHONE: /^\+?[1-9]\d{9,14}$/,
};
