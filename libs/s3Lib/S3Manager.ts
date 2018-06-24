import * as aws from 'aws-sdk'
import * as models from '../congressGov/CongressGovModels'
import * as _ from 'lodash'
import Utility from '../utils/Utility'

var awsConfig = require('../../config/aws.json');

export class S3Manager {
  private static _instance: S3Manager
  private s3: aws.S3
  private buckets: {[name: string]: S3Bucket} = {}

  public static instance (): S3Manager {
    if (!S3Manager._instance) {
      S3Manager._instance = new S3Manager()
    }
    return S3Manager._instance
  }

  private constructor () {
    aws.config.update({region: (<any> awsConfig).metadata.REGION })
    this.s3 = new aws.S3()
    const buckets = [
      new BillStaticInfoBucket(this.s3),
      new BillTextBucket(this.s3),
      new PersonBucket(this.s3)
    ]
    this.buckets = <{[name: string]: S3Bucket}> _.keyBy(buckets, x => x.bucketName)
  }

  public getBucket (bucketName: string): S3Bucket {
    return this.buckets[bucketName]
  }
}

export abstract class S3Bucket {
  public abstract get bucketName (): string

  protected s3: aws.S3

  constructor (s3: aws.S3) {
    this.s3 = s3
  }

  public createBucket (): Promise<aws.S3.CreateBucketOutput> {
    const params: aws.S3.CreateBucketRequest = {
      Bucket: this.bucketName,
      ACL: 'public-read'
    }
    return new Promise((resolve, reject) => {
      this.s3.createBucket(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  public deleteBucket (): Promise<any> {
    const params: aws.S3.DeleteBucketRequest = {
      Bucket: this.bucketName
    }
    return new Promise((resolve, reject) => {
      this.s3.deleteBucket(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  protected getObject (s3BucketKey: string): Promise<aws.S3.GetObjectOutput> {
    let params: aws.S3.GetObjectRequest = {
      Bucket: this.bucketName,
      Key: s3BucketKey
    }
    return new Promise((resolve, reject) => {
      this.s3.getObject(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  protected putObject (content: aws.S3.Body, s3BucketKey: string, contentType: aws.S3.ContentType): Promise<aws.S3.PutObjectOutput> {
    let params: aws.S3.PutObjectRequest = {
      Body: content,
      Bucket: this.bucketName,
      Key: s3BucketKey,
      ContentType: contentType,
      ACL: 'public-read'
    }
    return new Promise((resolve, reject) => {
      this.s3.putObject(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  protected deleteObject (s3BucketKey: string): Promise<aws.S3.DeleteObjectOutput> {
    let params: aws.S3.DeleteObjectRequest = {
      Bucket: this.bucketName,
      Key: s3BucketKey
    }
    return new Promise((resolve, reject) => {
      this.s3.deleteObject(params, (err, data) => err ? reject(err) : resolve(data))
    })
  }

  protected listObjects (s3BucketKeyPrefix: string): Promise<string[]> {
    let params: aws.S3.ListObjectsV2Request = {
      Bucket: this.bucketName,
      Prefix: s3BucketKeyPrefix
    }
    return new Promise((resolve, reject) => {
      this.s3.listObjectsV2(params, (err, data) => err ?
        reject(err) : resolve((data.Contents && _.map(data.Contents, x => x.Key)) || null))
    })
  }
}

export class S3BucketHelper {
  public static readonly HOST = 'https://s3.amazonaws.com'

  public static generateFullUrl (bucketName: string, bucketKey: string): string {
    bucketKey = bucketKey.startsWith('/') ? bucketKey.substring(1) : bucketKey
    const fullUrl = `${S3BucketHelper.HOST}/${bucketName}/${bucketKey}`
    return fullUrl
  }
}

// BillStaticInfoBucket

export interface BillStaticInfo {
  summaryLatest?: models.CongressGovSummary
  summaryAll?: models.CongressGovSummary[]
}

export class BillStaticInfoBucket extends S3Bucket {
  public readonly bucketName = (<any> awsConfig).s3.VOLUNTEER_BILLS_STATICINFO_BUCKET_NAME

  public putEntity (jsonObj: BillStaticInfo, congress: number, billType: models.BillTypeCode, billNumber: number)
  : Promise<string> {
    const s3BucketKey = this.s3BucketKey(congress, billType, billNumber)
    return super.putObject(JSON.stringify(jsonObj), s3BucketKey, 'application/json').then(() =>
      S3BucketHelper.generateFullUrl(this.bucketName, s3BucketKey))
  }

  public getEntity (congress: number, billType: models.BillTypeCode, billNumber: number)
  : Promise<BillStaticInfo> {
    const s3BucketKey = this.s3BucketKey(congress, billType, billNumber)
    return super.getObject(s3BucketKey).then(out => (out && out.Body) ? JSON.parse(out.Body.toString()) : null)
  }

  public deleteEntity (congress: number, billType: models.BillTypeCode, billNumber: number)
  : Promise<aws.S3.DeleteObjectOutput> {
    const s3BucketKey = this.s3BucketKey(congress, billType, billNumber)
    return super.deleteObject(s3BucketKey)
  }

  public s3BucketKey (congress: number, billType: models.BillTypeCode, billNumber: number): string {
    return `${congress}-${billType}-${billNumber}.json`
  }

  public s3FullUrl (congress: number, billType: models.BillTypeCode, billNumber: number): string {
    return S3BucketHelper.generateFullUrl(this.bucketName, this.s3BucketKey(congress, billType, billNumber))
  }
}

// BillTextBucket

export type BillTextContentType = 'xml' | 'txt' | 'pdf'

export interface BillTextBucketListResult {
  s3BucketKey: string
  s3BucketPath: string
  code: string
  date: number // UTC time
  contentType: BillTextContentType
}

export class BillTextBucket extends S3Bucket {
  public readonly bucketName = (<any> awsConfig).s3.VOLUNTEER_BILLS_FULLTEXT_BUCKET_NAME

  public putDocument (
    text: models.TextVersion, content: aws.S3.Body, contentType: BillTextContentType,
    congress: number, billType: models.BillTypeCode, billNumber: number )
  : Promise<string> {
    const s3BucketKey = this.s3BucketKey(text, contentType, congress, billType, billNumber)
    const mimeType = this.getMimeType(contentType)
    return super.putObject(content, s3BucketKey, mimeType).then(() =>
      S3BucketHelper.generateFullUrl(this.bucketName, s3BucketKey))
  }

  public listDocumentsOfBill (congress: number, billType: models.BillTypeCode, billNumber: number): Promise<BillTextBucketListResult[]> {
    const s3Path = this.s3BucketPath(congress, billType, billNumber)
    return super.listObjects(s3Path).then(keys => {
      const rtn: BillTextBucketListResult[] = []
      _.each(keys, key => {
        const comps = key.split('/')
        const subcomps = comps[1].split(/-|\./)
        const date = Utility.parseDateTimeStringOfFormat(`${subcomps[1]} 0:00am -0500`, 'YYYYMMDD h:mma Z') || null
        const obj = <BillTextBucketListResult> {}
        obj.s3BucketKey = key
        obj.s3BucketPath = comps[0]
        obj.code = subcomps[0]
        obj.contentType = <BillTextContentType> subcomps[2]
        if (date) {
          obj.date = date.getTime()
        }
        rtn.push(obj)
      })
      return rtn
    })
  }

  public s3BucketKey (
    text: models.TextVersion, contentType: BillTextContentType,
    congress: number, billType: models.BillTypeCode, billNumber: number
  ): string {
    let s3Key = this.s3BucketPath(congress, billType, billNumber)

    // add versionCode
    s3Key += text.versionCode

    // add date
    if (text.date) {
      s3Key += '-' + Utility.datetimeStringInDCTimezone(text.date, 'YYYYMMDD')
    } else {
      s3Key += '-unknown'
    }

    // add content type
    s3Key += '.' + contentType

    return s3Key
  }

  public s3BucketPath (congress: number, billType: models.BillTypeCode, billNumber: number): string {
    return `${congress}-${billType}-${billNumber}/`
  }

  public getMimeType (contentType: BillTextContentType): string {
    switch (contentType) {
      case 'xml':
        return 'text/xml'

      case 'txt':
        return 'text/plain'

      case 'pdf':
        return 'application/pdf'
    }
    return ''
  }
}

// PersonBucket

export type ProfilePictureResolution = '50px' | '100px' | '200px' | 'origin'

export class PersonBucket extends S3Bucket {
  public readonly bucketName = (<any> awsConfig).s3.TAIWANWATCH_PERSONS_BUCKET_NAME

  private readonly mimeType = 'image/jpeg'
  private readonly fileSuffix = '.jpg'

  public putProfilePicture (prefix: string, content: aws.S3.Body, res: ProfilePictureResolution)
  : Promise<string> {
    const s3BucketKey = this.s3BucketKey(prefix, res)
    return super.putObject(content, s3BucketKey, this.mimeType).then(() =>
      S3BucketHelper.generateFullUrl(this.bucketName, s3BucketKey))
  }

  public s3BucketKey (prefix: string, res: ProfilePictureResolution): string {
    return `photos/${prefix}@${res}${this.fileSuffix}`
  }
}
