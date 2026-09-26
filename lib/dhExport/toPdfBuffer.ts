import puppeteer from 'puppeteer-core'
import fs from 'fs'
import { DhFlag } from '@/lib/dhFlags'
import { renderFlagsReportHtml, PdfReportOptions } from './flagsReportTemplate'

/**
 * Automatically locates a Chromium / Edge / Chrome binary across Windows, macOS, Linux,
 * and serverless deployment environments.
 */
async function resolveChromiumExecutable(): Promise<string> {
  // 1. Explicit environment variables take precedence
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH

  // 2. Serverless Linux environment check (@sparticuz/chromium)
  if (process.platform === 'linux') {
    try {
      // Dynamic require to prevent bundling errors in non-serverless environments
      const chromium = require('@sparticuz/chromium')
      const path = await chromium.executablePath()
      if (path && fs.existsSync(path)) return path
    } catch {
      // Not in serverless or sparticuz not available, continue to system paths
    }
  }

  // 3. Platform-specific known paths
  const candidates: string[] = []

  if (process.platform === 'win32') {
    candidates.push(
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.LOCALAPPDATA || ''}\\Microsoft\\Edge\\Application\\msedge.exe`
    )
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    )
  } else {
    // Linux desktop / docker
    candidates.push(
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    )
  }

  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p
  }

  throw new Error(
    `No Chromium or Chrome-compatible browser executable found on this system (${process.platform}). Set PUPPETEER_EXECUTABLE_PATH or CHROME_PATH environment variable.`
  )
}

/**
 * Converts a set of DH flags into a styled "Cyber Dossier" PDF Buffer.
 */
export async function toPdfBuffer(
  flags: DhFlag[],
  options: PdfReportOptions = {}
): Promise<Buffer> {
  const executablePath = await resolveChromiumExecutable()
  const htmlContent = renderFlagsReportHtml(flags, options)

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=medium',
    ],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 })
    await page.setContent(htmlContent, { waitUntil: 'load', timeout: 30000 })

    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        bottom: '12mm',
        left: '10mm',
        right: '10mm',
      },
    })

    return Buffer.from(pdfUint8)
  } finally {
    await browser.close()
  }
}
