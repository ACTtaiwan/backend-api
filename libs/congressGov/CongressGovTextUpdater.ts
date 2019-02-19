import { CongressGovTextParser } from './CongressGovTextParser';
import * as models from './CongressGovModels';
import Utility from '../utils/Utility';
import * as s3Lib from '../s3Lib';
import { CongressGovHelper } from './CongressGovHelper';

var awsConfig = require('../../config/aws.json');

export class CongressGovTextUpdater {
  public readonly parser = new CongressGovTextParser();
  private s3Bucket = <s3Lib.BillTextBucket> s3Lib.S3Manager.instance().getBucket((<any> awsConfig).s3.VOLUNTEER_BILLS_FULLTEXT_BUCKET_NAME);

  public updateAllTextVersions (billPath: string): Promise<void> {
    const bill = CongressGovHelper.parseBillUrlOrPath(billPath);
    console.log(`[CongressGovTextUpdater::updateAllTextVersions()] Start. billPath = ${billPath}`);
    console.log(`[CongressGovTextUpdater::updateAllTextVersions()] Bill = ${bill.congress}-${bill.typeCode}-${bill.billNumber}`);
    return this.parser.getAllTextVersions(billPath).then((versions: models.TextVersion[]) => {
      let promises: Promise<void>[] = [];

      versions.forEach(v => {
        console.log(`[CongressGovTextUpdater::updateAllTextVersions()] updating version = ${v.display}`);
        promises.push(this.processPlainTextContent(v, bill));
        promises.push(this.processXmlContent(v, bill));
        promises.push(this.processPdfContent(v, bill));
      });

      return Promise.all(promises)
        .then(() => Promise.resolve())
        .catch(error => Promise.reject(error));
    });
  }

  public updateTextVersion (text: models.TextVersion, congress: number, typeCode: models.BillTypeCode, billNumber: number): Promise<void> {
    console.log(`[CongressGovTextUpdater::updateTextVersion()] Start.
                 text = ${JSON.stringify(text, null, 2)} Bill = ${congress}-${typeCode}-${billNumber}`);
    const bill: models.CongressGovBill = {congress, typeCode, billNumber};
    if (text.fullTextXmlUrl) {
      return this.processXmlContent(text, bill);
    } else if (text.fullTextPdfUrl) {
      return this.processPdfContent(text, bill);
    } else {
      return Promise.reject('unsupported content type');
    }
  }

  private processPlainTextContent (text: models.TextVersion, bill: models.CongressGovBill): Promise<void> {
    if (!text.fullText) {
      console.log(`[CongressGovTextUpdater::processPlainTextContent()] no TEXT content`);
      return Promise.resolve();
    } else {
      return this.s3Bucket.putDocument(text, text.fullText, 'txt', bill.congress, bill.typeCode, bill.billNumber).then(url =>
        console.log(`[CongressGovTextUpdater::processPlainTextContent()] Object put. S3 url = ${url}`));
    }
  }

  private processXmlContent (text: models.TextVersion, bill: models.CongressGovBill): Promise<void> {
    if (!text.fullTextXmlUrl) {
      console.log(`[CongressGovTextUpdater::processXmlContent()] no XML url`);
      return Promise.resolve();
    } else {
      console.log(`[CongressGovTextUpdater::processXmlContent()] fetching ${text.fullTextXmlUrl}`);
      return Utility.fetchUrlContent(text.fullTextXmlUrl).then((body: string) => {
        console.log(`[CongressGovTextUpdater::processXmlContent()] fetched. Replacing XSLT and DTD path...`);

        const staticFilePath = '/taiwanwatch-static/xslt';
        body = body.replace(`"billres.xsl"`, `"${staticFilePath}/billres.xsl"`);
        body = body.replace(`"bill.dtd"`, `"${staticFilePath}/bill.dtd"`);
        body = body.replace(`"amend.dtd"`, `"${staticFilePath}/amend.dtd"`);

        return this.s3Bucket.putDocument(text, body, 'xml', bill.congress, bill.typeCode, bill.billNumber).then(url =>
          console.log(`[CongressGovTextUpdater::processXmlContent()] Object put. S3 url = ${url}`));
      });
    }
  }

  private processPdfContent (text: models.TextVersion, bill: models.CongressGovBill): Promise<void> {
    if (!text.fullTextPdfUrl) {
      console.log(`[CongressGovTextUpdater::processPdfContent()] no PDF url`);
      return Promise.resolve();
    } else {
      console.log(`[CongressGovTextUpdater::processPdfContent()] fetching ${text.fullTextPdfUrl}`);
      return Utility.fetchUrlContent(text.fullTextPdfUrl, true).then((body: any) => {
        console.log(`[CongressGovTextUpdater::processPdfContent()] fetched. PDF file lenght = ${body.length || -1}`);

        return this.s3Bucket.putDocument(text, body, 'pdf', bill.congress, bill.typeCode, bill.billNumber).then(url =>
          console.log(`[CongressGovTextUpdater::processPdfContent()] Object put. S3 url = ${url}`));
      });
    }
  }
}
