import Joi from 'joi'

let schema = {}

schema.passwordPolicy = Joi.string()
  .regex(/[0-9]+/)
  .regex(/[A-Z]+/)
  .regex(/[a-z]+/)
  .regex(/[\^$*.[\]{}()?\-"!@#%&/,><':;|_~`]+/)
  .min(8)
  .max(99)

let validate = {}

validate.promisify = schema => {
  return params => {
    return new Promise((resolve, reject) => {
      Joi.validate(params, schema, (error, params) => {
        if (error) {
          reject(error)
        } else {
          resolve(params)
        }
      })
    })
  }
}

export default {
  schema,
  validate
}
