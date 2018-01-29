import * as xml2js from 'xml2js'
import { CongressGovTextParser } from './CongressGovTextParser'
import * as models from './CongressGovModels'
import Utility from '../utils/Utility'
import * as aws from 'aws-sdk'

export class CongressGovTextUpdater {
  public updateAllTextVersions (billPath: string, s3BucketPath: string): Promise<void> {
    console.log(`[CongressGovTextUpdater::updateAllTextVersions()] Start. billPath = ${billPath} s3BucketPath = ${s3BucketPath}`)
    let fetcher = new CongressGovTextParser()
    return fetcher.getAllTextVersions(billPath).then((versions: models.TextVersion[]) => {
      let promises: Promise<void>[] = []

      versions.forEach(v => {
        console.log(`[CongressGovTextUpdater::updateAllTextVersions()] updating version = ${v.display}`)
        promises.push(this.processPlainTextContent(v, s3BucketPath))
        promises.push(this.processXmlContent(v, s3BucketPath))
        promises.push(this.processPdfContent(v, s3BucketPath))
      })

      return Promise.all(promises)
        .then(() => Promise.resolve())
        .catch(error => Promise.reject(error))
    })
  }

  public updateTextVersion (text: models.TextVersion, s3BucketPath: string): Promise<void> {
    console.log(`[CongressGovTextUpdater::updateTextVersion()] Start.
                 text = ${JSON.stringify(text, null, 2)} s3BucketPath = ${s3BucketPath}`)
    if (text.fullTextXmlUrl) {
      return this.processXmlContent(text, s3BucketPath)
    } else if (text.fullTextPdfUrl) {
      return this.processPdfContent(text, s3BucketPath)
    } else {
      return Promise.reject('unsupported content type')
    }
  }

  private processXmlContent (text: models.TextVersion, s3BucketPath: string): Promise<void> {
    if (!text.fullTextXmlUrl) {
      console.log(`[CongressGovTextUpdater::processXmlContent()] no XML url`)
      return Promise.resolve()
    } else {
      console.log(`[CongressGovTextUpdater::processXmlContent()] fetching ${text.fullTextXmlUrl}`)
      return Utility.fetchUrlContent(text.fullTextXmlUrl).then((body: string) => {
        console.log(`[CongressGovTextUpdater::processXmlContent()] fetched. Replacing XSLT and DTD path...`)

        const staticFilePath = '/taiwanwatch-static/xslt'
        body = body.replace(`"billres.xsl"`, `"${staticFilePath}/billres.xsl"`)
        body = body.replace(`"bill.dtd"`,    `"${staticFilePath}/bill.dtd"`   )
        body = body.replace(`"amend.dtd"`,   `"${staticFilePath}/amend.dtd"`  )

        let s3Key = this.generateS3BucketKey(text, s3BucketPath, 'xml')
        console.log(`[CongressGovTextUpdater::processXmlContent()] s3Key = ${s3Key}`)

        return this.putObject(body, s3Key, 'text/xml')
      })
    }
  }

  private processPlainTextContent (text: models.TextVersion, s3BucketPath: string): Promise<void> {
    if (!text.fullText) {
      console.log(`[CongressGovTextUpdater::processPlainTextContent()] no TEXT content`)
      return Promise.resolve()
    } else {
      let s3Key = this.generateS3BucketKey(text, s3BucketPath, 'txt')
      console.log(`[CongressGovTextUpdater::processPlainTextContent()] s3Key = ${s3Key}`)

      return this.putObject(text.fullText, s3Key, 'text/plain')
    }
  }

  private processPdfContent (text: models.TextVersion, s3BucketPath: string): Promise<void> {
    if (!text.fullTextPdfUrl) {
      console.log(`[CongressGovTextUpdater::processPdfContent()] no PDF url`)
      return Promise.resolve()
    } else {
      console.log(`[CongressGovTextUpdater::processPdfContent()] fetching ${text.fullTextPdfUrl}`)
      return Utility.fetchUrlContent(text.fullTextPdfUrl, true).then((body: any) => {
        console.log(`[CongressGovTextUpdater::processPdfContent()] fetched. PDF file lenght = ${body.length || -1}`)

        let s3Key = this.generateS3BucketKey(text, s3BucketPath, 'pdf')
        console.log(`[CongressGovTextUpdater::processPdfContent()] s3Key = ${s3Key}`)

        return this.putObject(body, s3Key, 'application/pdf')
      })
    }
  }

  private putObject (content: aws.S3.Body, s3BucketKey: string, contentType: aws.S3.ContentType): Promise<void> {
    let s3 = new aws.S3()
    let params: aws.S3.Types.PutObjectRequest = {
      Body: content,
      Bucket: 'volunteer.bills',
      Key: s3BucketKey,
      ContentType: contentType,
      ACL: 'public-read'
     };
    return new Promise((resolve, reject) => {
      s3.putObject(params, (err, data) => {
        if (err) {
          console.error(`[CongressGovTextUpdater::putObject()] S3 putObject failed. Error = ${err}`)
          reject(`S3 putObject failed. Error = ${err}`)
        } else {
          console.log(`[CongressGovTextUpdater::putObject()] S3 putObject done.
                       Bucket = ${params.Bucket} Key = ${params.Key} Length = ${(<any>content).length || -1}`)
          resolve()
        }
      })
    })
  }

  private generateS3BucketKey (text: models.TextVersion, s3BucketPath: string, contentType: 'xml' | 'txt' | 'pdf'): string {
    let s3Key = s3BucketPath + (s3BucketPath.endsWith('/') ? '' : '/')

    // add versionCode
    if (text.versionCode === 'pl') {
      s3Key += 'publ'
    } else {
      s3Key += text.versionCode
    }

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
}
