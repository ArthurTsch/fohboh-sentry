declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfParseResult = {
    numpages?: number;
    text?: string;
  };

  type PdfParseOptions = {
    max?: number;
    pagerender?: (pageData: unknown) => Promise<string>;
    version?: string;
  };

  const pdfParse: (buffer: Buffer, options?: PdfParseOptions) => Promise<PdfParseResult>;
  export default pdfParse;
}
