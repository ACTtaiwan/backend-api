import * as xml2js from 'xml2js'
import CongressGovParser from './CongressGovParser'
import { TextVersion } from './CongressGovModels'
import Utility from '../utils/Utility'
import * as aws from 'aws-sdk'

export default class CongressGovUpdater {
  public updateAllTextVersions (billPath: string, s3BucketPath: string): Promise<void> {
    console.log(`[CongressGovUpdater::updateAllTextVersions()] Start. billPath = ${billPath} s3BucketPath = ${s3BucketPath}`)
    let fetcher = new CongressGovParser()
    return fetcher.getAllTextVersions(billPath).then((versions: TextVersion[]) => {
      let promises: Promise<void>[] = []

      versions.forEach(v => {
        console.log(`[CongressGovUpdater::updateAllTextVersions()] updating version = ${v.display}`)
        promises.push(this.processPlainTextContent(v, s3BucketPath))
        promises.push(this.processXmlContent(v, s3BucketPath))
        promises.push(this.processPdfContent(v, s3BucketPath))
      })

      return Promise.all(promises)
        .then(() => Promise.resolve())
        .catch(error => Promise.reject(error))
    })
  }

  private processXmlContent (text: TextVersion, s3BucketPath: string): Promise<void> {
    if (!text.fullTextXmlUrl) {
      console.log(`[CongressGovUpdater::processXmlContent()] no XML url`)
      return Promise.resolve()
    } else {
      console.log(`[CongressGovUpdater::processXmlContent()] fetching ${text.fullTextXmlUrl}`)
      return Utility.fetchUrlContent(text.fullTextXmlUrl).then((body: string) => {
        console.log(`[CongressGovUpdater::processXmlContent()] fetched. Replacing XSLT and DTD path...`)

        const staticFilePath = '/taiwanwatch-static/xslt'
        body = body.replace(`"billres.xsl"`, `"${staticFilePath}/billres.xsl"`)
        body = body.replace(`"bill.dtd"`,    `"${staticFilePath}/bill.dtd"`   )
        body = body.replace(`"amend.dtd"`,   `"${staticFilePath}/amend.dtd"`  )

        let s3Key = this.generateS3BucketKey(text, s3BucketPath, 'xml')
        console.log(`[CongressGovUpdater::processXmlContent()] s3Key = ${s3Key}`)

        return this.putObject(body, s3Key, 'text/xml')
      })
    }
  }

  private processPlainTextContent (text: TextVersion, s3BucketPath: string): Promise<void> {
    if (!text.fullText) {
      console.log(`[CongressGovUpdater::processPlainTextContent()] no TEXT content`)
      return Promise.resolve()
    } else {
      let s3Key = this.generateS3BucketKey(text, s3BucketPath, 'txt')
      console.log(`[CongressGovUpdater::processPlainTextContent()] s3Key = ${s3Key}`)

      return this.putObject(text.fullText, s3Key, 'text/plain')
    }
  }

  private processPdfContent (text: TextVersion, s3BucketPath: string): Promise<void> {
    if (!text.fullTextPdfUrl) {
      console.log(`[CongressGovUpdater::processPdfContent()] no PDF url`)
      return Promise.resolve()
    } else {
      console.log(`[CongressGovUpdater::processPdfContent()] fetching ${text.fullTextPdfUrl}`)
      return Utility.fetchUrlContent(text.fullTextPdfUrl, true).then((body: any) => {
        console.log(`[CongressGovUpdater::processPdfContent()] fetched. PDF file lenght = ${body.length || -1}`)

        let s3Key = this.generateS3BucketKey(text, s3BucketPath, 'pdf')
        console.log(`[CongressGovUpdater::processPdfContent()] s3Key = ${s3Key}`)

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
          console.error(`[CongressGovUpdater::putObject()] S3 putObject failed. Error = ${err}`)
          reject(`S3 putObject failed. Error = ${err}`)
        } else {
          console.log(`[CongressGovUpdater::putObject()] S3 putObject done.
                       Bucket = ${params.Bucket} Key = ${params.Key} Length = ${(<any>content).length || -1}`)
          resolve()
        }
      })
    })
  }

  private generateS3BucketKey (text: TextVersion, s3BucketPath: string, contentType: 'xml' | 'txt' | 'pdf'): string {
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
      s3Key += '-unknownDate'
    }

    // add content type
    switch (contentType) {
      case 'xml':
        s3Key += '-xml'
        break

      case 'txt':
        s3Key += '-txt'
        break

      case 'pdf':
        s3Key += '-pdf'
        break
    }
    return s3Key
  }
}
