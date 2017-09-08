import Joi from 'joi'
import GlobalSchema from '~/libs/utils/Global.schema'

let schema = {}

schema.logonParams = Joi.object().keys({
  fbAccessToken: Joi.string().required(),
  fbUserId: Joi.string().required(),
  name: Joi.string().required(),
  email: Joi.string()
    .email()
    .required()
})

schema.logonSuccessfulReturns = Joi.object().keys({
  status: Joi.string()
    .required()
    .valid('LOGON_SUCCESSFUL'),
  data: Joi.object().keys({
    credentail: Joi.object().keys({
      accessKeyId: Joi.string().required(),
      secretAccessKey: Joi.string().required(),
      sessionToken: Joi.string().required()
    }),
    user: Joi.object().keys({
      id: Joi.string()
        .guid()
        .required(),
      fbUserId: Joi.string().required(),
      email: Joi.string()
        .email()
        .required(),
      name: Joi.string().required(),
      score: Joi.number(),
      clearedTaskCount: Joi.number()
    })
  })
})

let validate = {}

validate.logonParams = GlobalSchema.validate.promisify(schema.logonParams)
validate.logonSuccessfulReturns = GlobalSchema.validate.promisify(schema.logonSuccessfulReturns)

export default {
  schema,
  validate
}
