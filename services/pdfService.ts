
// @ts-ignore
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export async function extractTextFromPDF(file: File): Promise<{ pageNumber: number; text: string }[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pages: { pageNumber: number; text: string }[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => item.str);
    pages.push({
      pageNumber: i,
      text: strings.join(' '),
    });
  }

  return pages;
}

export async function getThumbnails(file: File, maxPages: number = 10): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const thumbnails: string[] = [];
  const numPages = Math.min(pdf.numPages, maxPages);

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.5 }); // Low res for thumbnails
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) continue;
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    thumbnails.push(canvas.toDataURL('image/jpeg', 0.6));
  }

  return thumbnails;
}

export async function renderPageToImage(file: File, pageNumber: number, scale: number = 2.0): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);
  
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error("Could not create canvas context");
  
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise;

  return canvas.toDataURL('image/png').split(',')[1];
}

export async function cropRegionToImage(file: File, pageNumber: number, bbox: { ymin: number; xmin: number; ymax: number; xmax: number }, scale: number = 2.0): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);
  
  // Normalized coordinates are 0-1000
  const viewport = page.getViewport({ scale: 1.0 });
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;

  const x = (bbox.xmin / 1000) * pageWidth;
  const y = (bbox.ymin / 1000) * pageHeight;
  const width = ((bbox.xmax - bbox.xmin) / 1000) * pageWidth;
  const height = ((bbox.ymax - bbox.ymin) / 1000) * pageHeight;

  // Render at higher scale for the crop
  const highResViewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error("Could not create canvas context");

  canvas.width = width * scale;
  canvas.height = height * scale;

  // We need to translate the context to the crop region
  context.translate(-x * scale, -y * scale);

  await page.render({
    canvasContext: context,
    viewport: highResViewport
  }).promise;

  return canvas.toDataURL('image/png').split(',')[1];
}
