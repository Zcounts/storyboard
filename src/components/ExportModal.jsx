import React, { useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

/**
 * Before calling html2canvas, temporarily replace every <input> and <textarea>
 * inside the element with a <span>/<pre> displaying its current value.
 * This fixes html2canvas not rendering input text correctly.
 * Returns a restore function to undo the changes.
 */
function prepareForCapture(el) {
  const replacements = []

  el.querySelectorAll('input, textarea').forEach(input => {
    const isTextarea = input.tagName === 'TEXTAREA'
    const value = input.value ?? ''
    const cs = window.getComputedStyle(input)

    const span = document.createElement(isTextarea ? 'pre' : 'span')
    span.textContent = value
    span.style.fontFamily = cs.fontFamily
    span.style.fontSize = cs.fontSize
    span.style.fontWeight = cs.fontWeight
    span.style.color = cs.color
    span.style.textAlign = cs.textAlign
    span.style.lineHeight = cs.lineHeight
    span.style.letterSpacing = cs.letterSpacing
    span.style.whiteSpace = isTextarea ? 'pre-wrap' : 'pre'
    span.style.display = isTextarea ? 'block' : 'inline-block'
    span.style.verticalAlign = 'middle'
    span.style.margin = '0'
    span.style.padding = '0'
    span.style.border = 'none'
    span.style.background = 'transparent'
    span.style.minWidth = cs.minWidth
    span.style.width = cs.width

    input.parentNode.insertBefore(span, input)
    // Hide original but keep in DOM so layout doesn't shift
    const prevDisplay = input.style.display
    input.style.display = 'none'

    replacements.push({ span, input, prevDisplay })
  })

  // Also hide UI-only controls (delete btn, drag handle, add-shot btn)
  const uiOnly = el.querySelectorAll(
    '.delete-btn, .drag-handle, .add-shot-btn, .add-scene-btn, .add-scene-row'
  )
  const hiddenUi = []
  uiOnly.forEach(el => {
    hiddenUi.push({ el, prev: el.style.display })
    el.style.display = 'none'
  })

  return function restore() {
    replacements.forEach(({ span, input, prevDisplay }) => {
      span.remove()
      input.style.display = prevDisplay
    })
    hiddenUi.forEach(({ el, prev }) => {
      el.style.display = prev
    })
  }
}

/**
 * Collect all CSS text from all accessible stylesheets in the document.
 * Cross-origin stylesheets are silently skipped.
 */
function collectAllCSS() {
  let css = ''
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        css += rule.cssText + '\n'
      }
    } catch {
      // cross-origin or inaccessible sheet — skip
    }
  }
  return css
}

/**
 * Build a self-contained HTML document string for a page element.
 * All styles from the current document are inlined, and the element's
 * outerHTML is used as the body content.
 */
function buildPageHtml(el, css) {
  const width = el.offsetWidth
  const height = el.offsetHeight
  return {
    fullHtml: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
*{box-sizing:border-box}
html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden;background:#fff}
${css}
</style>
</head>
<body>${el.outerHTML}</body>
</html>`,
    width,
    height,
  }
}

/**
 * Wrap html2canvas with a hard timeout so a single broken page can't
 * stall the entire export indefinitely.
 */
async function captureElementWithTimeout(el, scale = 1.5, timeoutMs = 60000) {
  const restore = prepareForCapture(el)
  try {
    return await Promise.race([
      html2canvas(el, {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 15000,
        onclone: (_clonedDoc, clonedEl) => {
          // Ensure the cloned element is visible and full-size
          clonedEl.style.overflow = 'visible'
        },
      }),
      new Promise((_res, rej) =>
        setTimeout(() => rej(new Error(`html2canvas timeout after ${timeoutMs / 1000}s`)), timeoutMs)
      ),
    ])
  } finally {
    restore()
  }
}

// ── Electron path: each page is rendered in a hidden BrowserWindow ─────────

async function exportToPDFElectron(pages, projectName) {
  console.log(`[PDF Export] Starting Electron path — ${pages.length} page(s)`)

  // Collect all CSS once (shared across pages)
  const css = collectAllCSS()

  // Build per-page HTML payloads
  const pageData = []
  for (let i = 0; i < pages.length; i++) {
    const el = pages[i]
    const restore = prepareForCapture(el)
    try {
      const { fullHtml, width, height } = buildPageHtml(el, css)
      pageData.push({ fullHtml, width, height })
      console.log(`[PDF Export] Page ${i + 1}: ${width}×${height}px, HTML size: ${(fullHtml.length / 1024).toFixed(0)}KB`)
    } finally {
      restore()
    }
  }

  // Send all pages to main process for rendering
  console.log('[PDF Export] Sending pages to main process for rendering…')
  let results
  try {
    results = await window.electronAPI.exportPDFPages(pageData)
  } catch (ipcErr) {
    console.error('[PDF Export] IPC call failed:', ipcErr)
    throw new Error(`IPC error: ${ipcErr.message || ipcErr}`)
  }

  console.log(`[PDF Export] Received ${results.length} result(s) from main process`)

  // Assemble PDF from PNG buffers
  let pdf = null
  let rendered = 0

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (!result) {
      console.warn(`[PDF Export] Page ${i + 1} was skipped (render failed in main process)`)
      continue
    }

    const { pngData, width, height, error } = result
    if (error) {
      console.warn(`[PDF Export] Page ${i + 1} reported error: ${error}`)
    }
    if (!pngData) {
      console.warn(`[PDF Export] Page ${i + 1} returned no image data — skipping`)
      continue
    }

    try {
      // pngData is an array of bytes (Uint8Array serialised over IPC)
      const uint8 = new Uint8Array(pngData)
      const blob = new Blob([uint8], { type: 'image/png' })
      const url = URL.createObjectURL(blob)

      const imgData = await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.92))
          URL.revokeObjectURL(url)
        }
        img.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error(`Failed to decode PNG for page ${i + 1}`))
        }
        img.src = url
      })

      if (!pdf) {
        pdf = new jsPDF({
          orientation: width > height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [width, height],
          hotfixes: ['px_scaling'],
        })
      } else {
        pdf.addPage([width, height], width > height ? 'landscape' : 'portrait')
      }

      pdf.addImage(imgData, 'JPEG', 0, 0, width, height)
      rendered++
      console.log(`[PDF Export] Page ${i + 1} added to PDF`)
    } catch (pageErr) {
      console.error(`[PDF Export] Failed to add page ${i + 1} to PDF:`, pageErr)
    }
  }

  if (!pdf || rendered === 0) {
    throw new Error('No pages could be rendered. Check the console for per-page errors.')
  }

  console.log(`[PDF Export] ${rendered}/${pages.length} page(s) rendered — saving…`)
  const arrayBuffer = pdf.output('arraybuffer')
  const fileName = projectName ? `${projectName.replace(/[^a-z0-9]/gi, '_')}.pdf` : 'shotlist.pdf'
  await window.electronAPI.savePDF(fileName, arrayBuffer)
  console.log('[PDF Export] Saved successfully.')
}

// ── Browser fallback path: html2canvas ────────────────────────────────────

async function exportToPDFBrowser(pages) {
  console.log(`[PDF Export] Starting browser/html2canvas path — ${pages.length} page(s)`)

  let pdf = null
  let scale = 1.5

  for (let i = 0; i < pages.length; i++) {
    let canvas
    try {
      console.log(`[PDF Export] Rendering page ${i + 1}/${pages.length} at scale ${scale}…`)
      canvas = await captureElementWithTimeout(pages[i], scale, 60000)
    } catch (scaleErr) {
      console.warn(`[PDF Export] Page ${i + 1} failed at scale ${scale}:`, scaleErr.message)
      if (scale > 1.0) {
        scale = 1.0
        console.log(`[PDF Export] Retrying page ${i + 1} at scale 1.0…`)
        try {
          canvas = await captureElementWithTimeout(pages[i], scale, 60000)
        } catch (retryErr) {
          console.error(`[PDF Export] Page ${i + 1} failed on retry:`, retryErr.message)
          console.warn(`[PDF Export] Skipping page ${i + 1} and continuing…`)
          continue
        }
      } else {
        console.error(`[PDF Export] Page ${i + 1} failed, skipping…`)
        continue
      }
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.88)
    const pxW = canvas.width / scale
    const pxH = canvas.height / scale

    if (!pdf) {
      pdf = new jsPDF({
        orientation: pxW > pxH ? 'landscape' : 'portrait',
        unit: 'px',
        format: [pxW, pxH],
        hotfixes: ['px_scaling'],
      })
    } else {
      pdf.addPage([pxW, pxH], pxW > pxH ? 'landscape' : 'portrait')
    }

    pdf.addImage(imgData, 'JPEG', 0, 0, pxW, pxH)
    console.log(`[PDF Export] Page ${i + 1} added to PDF`)
  }

  if (!pdf) {
    throw new Error('No pages could be rendered. Check the console for details.')
  }

  pdf.save('shotlist.pdf')
  console.log('[PDF Export] Saved via browser download.')
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function exportToPDF(pageRefs, projectName) {
  const pages = (pageRefs?.current || []).filter(Boolean)
  if (pages.length === 0) {
    console.warn('[PDF Export] No page elements found — aborting.')
    return
  }

  try {
    if (window.electronAPI?.exportPDFPages) {
      await exportToPDFElectron(pages, projectName)
    } else {
      await exportToPDFBrowser(pages)
    }
  } catch (err) {
    console.error('[PDF Export] Export failed:', err)

    // Build a helpful user-facing message that exposes the real cause
    const raw = err?.message || String(err) || 'Unknown error'
    let msg = `PDF export failed: ${raw}`

    if (/memory|heap|call stack|out of/i.test(raw)) {
      msg += '\n\nTip: try removing or resizing large images attached to shots.'
    } else if (/timeout/i.test(raw)) {
      msg += '\n\nTip: the page took too long to render — try exporting fewer scenes at once.'
    } else if (/canvas/i.test(raw)) {
      msg += '\n\nTip: the page is too large to capture. Try reducing image sizes.'
    } else if (/ipc|main process/i.test(raw)) {
      msg += '\n\nThe Electron main process could not render the page. Check the developer console for details.'
    }

    alert(msg)
  }
}

export async function exportToPNG(pageRefs) {
  const pages = (pageRefs?.current || []).filter(Boolean)
  if (pages.length === 0) return

  try {
    for (let i = 0; i < pages.length; i++) {
      console.log(`[PNG Export] Rendering page ${i + 1}/${pages.length}…`)
      const canvas = await captureElementWithTimeout(pages[i], 2, 60000)
      const filename = pages.length === 1 ? 'shotlist.png' : `shotlist_page${i + 1}.png`

      if (window.electronAPI) {
        const dataURL = canvas.toDataURL('image/png')
        const base64 = dataURL.replace(/^data:image\/png;base64,/, '')
        await window.electronAPI.savePNG(filename, base64)
      } else {
        const link = document.createElement('a')
        link.download = filename
        link.href = canvas.toDataURL('image/png')
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
      console.log(`[PNG Export] Page ${i + 1} saved.`)
    }
  } catch (err) {
    console.error('[PNG Export] Failed:', err)
    const raw = err?.message || ''
    let msg = `PNG export failed: ${raw || 'Unknown error'}`
    if (/memory|heap|call stack|out of/i.test(raw)) {
      msg += '\n\nTip: try removing or resizing large images.'
    }
    alert(msg)
  }
}

export default function ExportModal({ isOpen, onClose, pageRefs }) {
  const [exporting, setExporting] = useState(false)
  const [exportType, setExportType] = useState(null)

  if (!isOpen) return null

  const handleExport = async (type) => {
    setExporting(true)
    setExportType(type)
    try {
      if (type === 'pdf') {
        await exportToPDF(pageRefs)
      } else {
        await exportToPNG(pageRefs)
      }
    } finally {
      setExporting(false)
      setExportType(null)
      onClose()
    }
  }

  const pageCount = (pageRefs?.current || []).filter(Boolean).length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Export</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="5" x2="15" y2="15" />
              <line x1="15" y1="5" x2="5" y2="15" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-2">
          Export your shotlist as a high-resolution document.
        </p>
        <p className="text-xs text-gray-400 mb-6">
          {pageCount} page{pageCount !== 1 ? 's' : ''} will be exported.
          PDF: one PDF page per document page.
          PNG: one PNG file per document page.
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {exporting && exportType === 'pdf' ? 'Exporting…' : 'Export PDF'}
            <div className="text-xs font-normal opacity-75">Separate page per scene</div>
          </button>
          <button
            onClick={() => handleExport('png')}
            disabled={exporting}
            className="flex-1 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {exporting && exportType === 'png' ? 'Exporting…' : 'Export PNG'}
            <div className="text-xs font-normal opacity-75">One PNG per page</div>
          </button>
        </div>
      </div>
    </div>
  )
}
