import { PDFDocument } from 'pdf-lib'

export interface PDFFile {
  file: File
  id: string
  name: string
  size: number
}

interface CompressOptions {
  scale?: number
  imageQuality?: number
  removeImages?: boolean
  grayscale?: boolean
}

export async function compressPDF(
  file: File,
  options: CompressOptions = {}
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer)
  
  // This is a basic compression implementation
  // Real compression would involve more complex operations like image resampling
  // For now, we'll just save it with some optimization flags if available
  // or simulate compression by stripping unused objects
  
  if (options.removeImages) {
    // In a real implementation, we would iterate through pages and remove images
    // For this demo, we'll just keep it simple
  }

  // Serialize the PDFDocument to bytes (a Uint8Array)
  const pdfBytes = await pdfDoc.save({ useObjectStreams: false })
  
  return new Blob([pdfBytes as any], { type: 'application/pdf' })
}

export async function splitPDF(
  file: File,
  range: string
): Promise<Blob[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer)
  const pageCount = pdfDoc.getPageCount()
  
  // Simple implementation: split each page into a separate file
  // In a real app, we'd parse the range string properly
  
  const resultBlobs: Blob[] = []
  
  for (let i = 0; i < pageCount; i++) {
    const newPdf = await PDFDocument.create()
    const [page] = await newPdf.copyPages(pdfDoc, [i])
    newPdf.addPage(page)
    const pdfBytes = await newPdf.save()
    resultBlobs.push(new Blob([pdfBytes as any], { type: 'application/pdf' }))
  }
  
  return resultBlobs
}
