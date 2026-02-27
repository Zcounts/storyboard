import React, { useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

// ── Shared utilities ──────────────────────────────────────────────────────────

/**
 * Before capturing a page element, temporarily replace every <input> and
 * <textarea> inside it with a <span>/<pre> that displays the current value.
 * This ensures captured HTML shows typed text, not empty form fields.
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
    const prevDisplay = input.style.display
    input.style.display = 'none'

    replacements.push({ span, input, prevDisplay })
  })

  // Hide UI-only controls that shouldn't appear in exports
  const uiOnly = el.querySelectorAll(
    '.delete-btn, .drag-handle, .add-shot-btn, .add-scene-btn, .add-scene-row'
  )
  const hiddenUi = []
  uiOnly.forEach(uiEl => {
    hiddenUi.push({ el: uiEl, prev: uiEl.style.display })
    uiEl.style.display = 'none'
  })

  return function restore() {
    replacements.forEach(({ span, input, prevDisplay }) => {
      span.remove()
      input.style.display = prevDisplay
    })
    hiddenUi.forEach(({ el: uiEl, prev }) => {
      uiEl.style.display = prev
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

// ── Electron path: webContents.printToPDF() ───────────────────────────────────
//
// Build a single self-contained HTML document that contains ALL pages.  Each
// page is a .page-document div.  A @page CSS rule + break-after: page on each
// div instructs Chromium's print engine to paginate correctly.  Chromium handles
// fonts, images, and layout natively — no canvas capture, no memory limits.

function buildPrintHtml(pages) {
  const css = collectAllCSS()

  // Print-specific overrides: A4 landscape pages, no margins, page breaks
  // between each .page-document, hide UI-only chrome elements.
  const printCss = `
@page {
  size: A4 landscape;
  margin: 0;
}
html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
}
.page-document {
  box-shadow: none !important;
  margin: 0 !important;
  border-radius: 0 !important;
  page-break-after: always;
  break-after: page;
  max-width: none !important;
  width: 100% !important;
}
.page-document:last-child {
  page-break-after: avoid;
  break-after: avoid;
}
.add-shot-btn, .add-scene-btn, .add-scene-row, .delete-btn, .drag-handle {
  display: none !important;
}
`

  // Build outerHTML for each page with inputs replaced by text spans
  const pageHtmlParts = pages.map(el => {
    const restore = prepareForCapture(el)
    try {
      return el.outerHTML
    } finally {
      restore()
    }
  })

  // Inline a small script to replace failed images with a grey rectangle.
  // Images stored as base64 data URIs should never fail, but this guards
  // against any external src references.
  const imgFallbackScript = `
<script>
(function() {
  function patchImgs() {
    document.querySelectorAll('img').forEach(function(img) {
      if (img.complete && img.naturalWidth === 0) {
        img.style.background = '#c0c0c0';
        img.style.display = 'block';
      }
      img.addEventListener('error', function() {
        this.style.background = '#c0c0c0';
        this.style.display = 'block';
        this.onerror = null;
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchImgs);
  } else {
    patchImgs();
  }
})();
</script>`

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${css}
${printCss}
</style>
</head>
<body>
${pageHtmlParts.join('\n')}
${imgFallbackScript}
</body>
</html>`
}

async function exportToPDFPrint(pages, projectName) {
  console.log(`[PDF Export] Starting printToPDF path — ${pages.length} page(s)`)

  const htmlContent = buildPrintHtml(pages)
  console.log(`[PDF Export] Print HTML built — ${(htmlContent.length / 1024).toFixed(0)}KB`)

  let result
  try {
    result = await window.electronAPI.printToPDF(htmlContent)
  } catch (ipcErr) {
    throw new Error(`IPC error during printToPDF: ${ipcErr.message || ipcErr}`)
  }

  if (!result.success) {
    throw new Error(result.error || 'printToPDF returned failure')
  }

  console.log(`[PDF Export] PDF buffer received — ${(result.pdfData.length / 1024).toFixed(0)}KB`)

  const buffer = new Uint8Array(result.pdfData)
  const fileName = projectName
    ? `${projectName.replace(/[^a-z0-9]/gi, '_')}.pdf`
    : 'shotlist.pdf'

  await window.electronAPI.savePDF(fileName, buffer.buffer)
  console.log('[PDF Export] Saved successfully.')
}

// ── Browser fallback path: html2canvas ────────────────────────────────────────

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

// ── Public API ────────────────────────────────────────────────────────────────

export async function exportToPDF(pageRefs, projectName) {
  const pages = (pageRefs?.current || []).filter(Boolean)
  if (pages.length === 0) {
    console.warn('[PDF Export] No page elements found — aborting.')
    return
  }

  try {
    if (window.electronAPI?.printToPDF) {
      // Electron: use webContents.printToPDF() — reliable, no canvas limits
      await exportToPDFPrint(pages, projectName)
    } else {
      // Browser / dev environment: html2canvas fallback
      await exportToPDFBrowser(pages)
    }
  } catch (err) {
    console.error('[PDF Export] Export failed:', err)

    const raw = err?.message || String(err) || 'Unknown error'
    let msg = `PDF export failed: ${raw}`

    if (/memory|heap|call stack|out of/i.test(raw)) {
      msg += '\n\nTip: try removing or resizing large images attached to shots.'
    } else if (/timeout/i.test(raw)) {
      msg += '\n\nTip: the page took too long to render — try exporting fewer scenes at once.'
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
