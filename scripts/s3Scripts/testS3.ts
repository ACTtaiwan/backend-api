import * as s3Lib from '../../libs/s3Lib'
import * as awsConfig from '../../config/aws.json'
import { CongressGovTextUpdater } from '../../libs/congressGov/CongressGovTextUpdater';

let f = async () => {
  const bcktName = (<any> awsConfig).s3.VOLUNTEER_BILLS_STATICINFO_BUCKET_NAME
  const bckt = <s3Lib.BillStaticInfoBucket> s3Lib.S3Manager.instance().getBucket(bcktName)
  await bckt.createBucket()
  // await bckt.deleteBucket()
  const url = await bckt.putEntity({
    summaryLatest: <any> {},
    summaryAll: <any[]>[]
  }, 115, 'hr', 535)

  // console.log(url)
  await bckt.deleteInfo(115, 'hr', 535)
}

// f()

let g = async () => {
  const bcktName = (<any> awsConfig).s3.VOLUNTEER_BILLS_FULLTEXT_BUCKET_NAME
  const bckt = <s3Lib.BillTextBucket> s3Lib.S3Manager.instance().getBucket(bcktName)
  // await bckt.createBucket()
  const updater = new CongressGovTextUpdater()
  const billPath = '/bill/114th-congress/senate-bill/1635'
  // await updater.updateAllTextVersions(billPath)
}

g()
