/** Serwerowe moduły wewnętrzne pdfmake (brak w @types/pdfmake). */
declare module "pdfmake/build/vfs_fonts.js" {
  const vfs: Record<string, string>;
  export default vfs;
}

declare module "pdfmake/js/Printer.js" {
  type PdfDocument = import("pdfkit").PDFDocument;

  export default class PdfPrinter {
    constructor(
      fontDescriptors: Record<string, unknown>,
      virtualfs: {
        existsSync(path: string): boolean;
        readFileSync(path: string): Buffer;
        writeFileSync(path: string, data: Buffer | string, encoding?: string): void;
      },
      urlResolver: {
        resolve(path: string, headers?: object): void;
        resolved(): Promise<unknown[]>;
      },
    );

    createPdfKitDocument(
      docDefinition: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): Promise<PdfDocument>;
  }
}

declare module "pdfmake/js/URLResolver.js" {
  export default class URLResolver {
    constructor(fs: {
      existsSync(path: string): boolean;
      readFileSync(path: string): Buffer;
      writeFileSync(path: string, data: Buffer | string, encoding?: string): void;
    });

    resolve(url: string, headers?: object): void;

    resolved(): Promise<unknown[]>;
  }
}
