import Joi from 'joi'
import GlobalSchema from '~/libs/utils/Global.schema'

let schema = {}

schema.getBillParams = Joi.object().keys({
  id: Joi.string().required()
})

schema.getBillsParams = Joi.object().keys({
  id: Joi.string()
})

schema.createBillParams = Joi.object().keys({
  bill: Joi.object().required()
})

schema.getBillDocUploadUrlParams = Joi.object().keys({
  billId: Joi.string()
    .guid()
    .required(),
  congress: Joi.number()
    .integer()
    .min(1)
    .required(),
  billType: Joi.string().required(),
  billNumber: Joi.number()
    .integer()
    .min(1)
    .required(),
  billVersion: Joi.object().required(),
  versionDate: Joi.string().required(),
  contentType: Joi.string().required()
})

schema.addBillVersionParams = Joi.object().keys({
  bucketKey: Joi.string().required(),
  contentType: Joi.string().required(),
  congress: Joi.number()
    .integer()
    .min(1)
    .required(),
  billId: Joi.string()
    .guid()
    .required(),
  billTypeCode: Joi.string().required(),
  billNumber: Joi.number()
    .integer()
    .min(1)
    .required(),
  versionCode: Joi.string().required(),
  versionDate: Joi.string().required()
})

let validate = {}

validate.getBillParams = GlobalSchema.validate.promisify(schema.getBillParams)
validate.getBillsParams = GlobalSchema.validate.promisify(schema.getBillsParams)
validate.createBillParams = GlobalSchema.validate.promisify(schema.createBillParams)
validate.getBillDocUploadUrlParams = GlobalSchema.validate.promisify(schema.getBillDocUploadUrlParams)
validate.addBillVersionParams = GlobalSchema.validate.promisify(schema.addBillVersionParams)

export default {
  schema,
  validate
}
