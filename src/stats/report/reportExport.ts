import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import { download } from "../../bundle/download";
import { REPORT_SHEET } from "../../ui/styles";
import { FONTS, standaloneAssets } from "../dashboard/export";
import { chartsByCanvas } from "./ChartDisplay";
import { drawChart } from "./drawChart";

/**
 * A copy of the report on an off-screen sheet in the light theme, as the app's handouts are, with every chart
 * drawn again there in light colours and kept as an image (a copied canvas is blank). Remove the sheet after.
 */
function lightCopy(report: HTMLElement): { copy: HTMLElement; sheet: HTMLElement } {
  const sheet = document.createElement("div");
  const copy = report.cloneNode(true) as HTMLElement;
  const originals = report.querySelectorAll("canvas");

  sheet.dataset.theme = "light";
  sheet.className = REPORT_SHEET;
  sheet.append(copy);
  document.body.append(sheet);
  copy.querySelectorAll("[data-report-download]").forEach((el) => el.remove());

  try {
    copy.querySelectorAll("canvas").forEach((canvas, i) => {
      const chart = chartsByCanvas.get(originals[i]);
      const img = document.createElement("img");

      if (chart) {
        const cleanup = drawChart(canvas, chart);

        img.src = canvas.toDataURL("image/png");
        cleanup();
      } else {
        img.src = originals[i].toDataURL("image/png");
      }

      img.alt = "";
      img.className = canvas.className;
      canvas.replaceWith(img);
    });
  } catch (e) {
    sheet.remove();
    throw e;
  }

  return { copy, sheet };
}

// The PDF's layout: lengths in millimetres, type in points.
const PDF_MARGIN = 10;
const PDF_GAP = 5;
const PDF_SCALE = 2;
const PDF_JPEG_QUALITY = 0.92;
const PDF_PAPER = "#ffffff";
const PDF_LINK = "#1d4ed8";
const PDF_INK = "#111111";
const MM_PER_POINT = 0.3528;
const LINE_HEIGHT = 1.35;
/** The type size and indent of each element of a text section. */
const PDF_TEXT: Record<string, { size: number; indent: number; bold: boolean }> = {
  H3: { size: 14, indent: 0, bold: true },
  H4: { size: 12, indent: 0, bold: true },
  H5: { size: 10, indent: 0, bold: true },
  P: { size: 9, indent: 3, bold: true },
  LI: { size: 8, indent: 6, bold: false },
};

/**
 * Write a text section (the video links) as PDF text from `y` down and return where it ends: lines break
 * between pages, never through one, and each link can be clicked and copied.
 */
function writeText(pdf: jsPDF, section: HTMLElement, y: number): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const bottom = pdf.internal.pageSize.getHeight() - PDF_MARGIN;

  for (const el of section.querySelectorAll<HTMLElement>("h3, h4, h5, p, li")) {
    const { size, indent, bold } = PDF_TEXT[el.tagName];
    const url = el.querySelector("a")?.href;
    const x = PDF_MARGIN + indent;
    const step = size * MM_PER_POINT * LINE_HEIGHT;

    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(url ? PDF_LINK : PDF_INK);

    for (const line of pdf.splitTextToSize(el.textContent ?? "", pageWidth - PDF_MARGIN - x) as string[]) {
      if (y + step > bottom) {
        pdf.addPage();
        y = PDF_MARGIN;
      }

      y += step;
      if (url) pdf.textWithLink(line, x, y, { url });
      else pdf.text(line, x, y);
    }
  }

  return y + PDF_GAP;
}

const escapeHtml = (s: string): string => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** The report as one HTML file in the app's stylesheet and fonts, on light paper as printed. */
export async function downloadReportHtml(report: HTMLElement, title: string, fileName: string): Promise<void> {
  const { css } = await standaloneAssets();
  const { copy, sheet } = lightCopy(report);

  try {
    download(
      `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link href="${FONTS}" rel="stylesheet">
<style>${css.replace(/<\/style/gi, "<\\/style")}</style>
</head>
<body class="bg-white">
<main class="mx-auto max-w-report-chart px-4 py-6">${copy.outerHTML}</main>
</body>
</html>
`,
      `${fileName}.html`,
      "text/html"
    );
  } finally {
    sheet.remove();
  }
}

/**
 * The report as an A4 PDF on light paper: its sections one after another, a new page only where the next one
 * does not fit. A chart section is placed as a picture; a text section (`data-report-text`) is written as text.
 */
export async function downloadReportPdf(report: HTMLElement, fileName: string): Promise<void> {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = PDF_MARGIN;
  const gap = PDF_GAP;
  const contentWidth = pageWidth - 2 * margin;
  const usable = pageHeight - 2 * margin;
  const { copy, sheet } = lightCopy(report);

  try {
    const sections = Array.from(copy.querySelectorAll<HTMLElement>("[data-report-section]"));
    let y = margin;

    for (const section of sections) {
      if ("reportText" in section.dataset) {
        y = writeText(pdf, section, y);
        continue;
      }

      sheet.replaceChildren(section);
      await Promise.all(Array.from(section.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)));

      const canvas = await html2canvas(sheet, {
        scale: PDF_SCALE,
        useCORS: true,
        logging: false,
        backgroundColor: PDF_PAPER,
      });
      const height = (canvas.height * contentWidth) / canvas.width;

      if (y > margin && y + height > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }

      for (let top = 0; top < height; ) {
        const slice = Math.min(pageHeight - margin - y, height - top);
        const part = document.createElement("canvas");

        part.width = canvas.width;
        part.height = Math.max(1, (slice * canvas.height) / height);
        part
          .getContext("2d")
          ?.drawImage(
            canvas,
            0,
            (top * canvas.height) / height,
            canvas.width,
            part.height,
            0,
            0,
            canvas.width,
            part.height
          );
        pdf.addImage(part.toDataURL("image/jpeg", PDF_JPEG_QUALITY), "JPEG", margin, y, contentWidth, slice);
        top += slice;
        y += slice + gap;

        if (top < height) {
          pdf.addPage();
          y = margin;
        }
      }

      if (y > margin + usable) {
        pdf.addPage();
        y = margin;
      }
    }

    pdf.save(`${fileName}.pdf`);
  } finally {
    sheet.remove();
  }
}
