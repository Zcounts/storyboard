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
 * Compress a base64 image data URL to a smaller JPEG.
 * Caps the longest dimension at maxDim pixels.
 */
async function compressBase64Image(dataUrl, quality = 0.7, maxDim = 1400) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h)
        w = Math.round(w * ratio)
        h = Math.round(h * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => resolve(dataUrl) // fall back to original
    img.src = dataUrl
  })
}

/**
 * Temporarily replace large embedded images with compressed versions
 * to reduce canvas memory usage during capture. Returns a restore fn.
 */
async function compressLargeImages(el, sizeThresholdBytes = 800 * 1024) {
  const imgs = el.querySelectorAll('img[src^="data:image"]')
  const restores = []
  for (const img of imgs) {
    const src = img.src
    // base64 length ≈ 4/3 × actual bytes
    if (src.length > sizeThresholdBytes * 1.33) {
      const compressed = await compressBase64Image(src, 0.65)
      img.src = compressed
      restores.push({ img, src })
    }
  }
  return function restore() {
    restores.forEach(({ img, src }) => { img.src = src })
  }
}

async function captureElement(el, scale = 1.5) {
  const restore = prepareForCapture(el)
  const restoreImages = await compressLargeImages(el)
  try {
    return await html2canvas(el, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    })
  } finally {
    restoreImages()
    restore()
  }
}

/** Wait for two animation frames so layout settles after DOM changes */
function waitFrames(n = 2) {
  return new Promise(resolve => {
    let count = 0
    const raf = () => {
      if (++count >= n) resolve()
      else requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)
  })
}

/** Wrap a promise with a timeout (ms). Rejects with a timeout error if exceeded. */
function withTimeout(promise, ms, label = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ])
}

export async function exportToPDF(pageRefs, storyboardRef) {
  // Temporarily reveal the storyboard container if it is hidden (display:none)
  // so that html2canvas can render the attached DOM elements.
  const container = storyboardRef?.current
  const wasHidden = container && getComputedStyle(container).display === 'none'
  if (wasHidden) {
    console.log('[Export] Storyboard container is hidden — temporarily revealing for capture')
    container.style.display = ''
    await waitFrames(2)
  }

  const pages = (pageRefs?.current || []).filter(el => el && el.isConnected)
  console.log(`[Export] Found ${pages.length} connected page(s) to export`)

  if (pages.length === 0) {
    if (wasHidden && container) container.style.display = 'none'
    return
  }

  try {
    let pdf = null
    let scale = 1.5

    for (let i = 0; i < pages.length; i++) {
      const el = pages[i]
      console.log(`[Export] Capturing page ${i + 1}/${pages.length} — size: ${el.offsetWidth}×${el.offsetHeight}px, scale: ${scale}`)

      let canvas
      try {
        canvas = await withTimeout(captureElement(el, scale), 60000, `Page ${i + 1} capture`)
      } catch (scaleErr) {
        console.warn(`[Export] Page ${i + 1} at scale ${scale} failed:`, scaleErr.message, '— retrying at 1.0')
        scale = 1.0
        canvas = await withTimeout(captureElement(el, scale), 60000, `Page ${i + 1} capture (retry)`)
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.88)
      const pxW = canvas.width / scale
      const pxH = canvas.height / scale
      console.log(`[Export] Page ${i + 1} captured — canvas: ${canvas.width}×${canvas.height}, JPEG size: ~${Math.round(imgData.length * 0.75 / 1024)}KB`)

      if (i === 0) {
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
    }

    if (!pdf) return

    if (window.electronAPI) {
      const arrayBuffer = pdf.output('arraybuffer')
      await window.electronAPI.savePDF('shotlist.pdf', arrayBuffer)
    } else {
      pdf.save('shotlist.pdf')
    }
    console.log('[Export] PDF export complete')
  } catch (err) {
    console.error('[Export] PDF export failed:', err)
    let msg = 'PDF export failed.'
    const errMsg = err?.message || ''
    if (/memory|call stack|out of|heap/i.test(errMsg)) {
      msg += ' Not enough memory — try removing or resizing large shot images.'
    } else if (/timed out/i.test(errMsg)) {
      msg += ' Export timed out — try exporting fewer scenes at once.'
    } else if (/canvas/i.test(errMsg)) {
      msg += ' The page is too large to render. Try reducing image sizes.'
    } else if (errMsg) {
      msg += ` Details: ${errMsg}`
    } else {
      msg += ' Try removing or resizing large images attached to shots.'
    }
    alert(msg)
  } finally {
    if (wasHidden && container) {
      container.style.display = 'none'
      console.log('[Export] Storyboard container re-hidden')
    }
  }
}

export async function exportToPNG(pageRefs, storyboardRef) {
  // Temporarily reveal the storyboard container if hidden
  const container = storyboardRef?.current
  const wasHidden = container && getComputedStyle(container).display === 'none'
  if (wasHidden) {
    console.log('[Export] Storyboard container is hidden — temporarily revealing for PNG capture')
    container.style.display = ''
    await waitFrames(2)
  }

  const pages = (pageRefs?.current || []).filter(el => el && el.isConnected)
  console.log(`[Export] Found ${pages.length} connected page(s) to export as PNG`)

  if (pages.length === 0) {
    if (wasHidden && container) container.style.display = 'none'
    return
  }

  try {
    for (let i = 0; i < pages.length; i++) {
      const el = pages[i]
      console.log(`[Export] Capturing PNG page ${i + 1}/${pages.length} — size: ${el.offsetWidth}×${el.offsetHeight}px`)
      const canvas = await withTimeout(captureElement(el, 2), 60000, `PNG page ${i + 1} capture`)
      const filename = pages.length === 1 ? 'shotlist.png' : `shotlist_page${i + 1}.png`
      console.log(`[Export] PNG page ${i + 1} captured — canvas: ${canvas.width}×${canvas.height}`)

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
    }
    console.log('[Export] PNG export complete')
  } catch (err) {
    console.error('[Export] PNG export failed:', err)
    let msg = 'PNG export failed.'
    const errMsg = err?.message || ''
    if (/memory|call stack|out of|heap/i.test(errMsg)) {
      msg += ' Not enough memory — try removing or resizing large shot images.'
    } else if (/timed out/i.test(errMsg)) {
      msg += ' Export timed out — try exporting fewer scenes at once.'
    } else if (errMsg) {
      msg += ` Details: ${errMsg}`
    } else {
      msg += ' Try removing or resizing large images attached to shots.'
    }
    alert(msg)
  } finally {
    if (wasHidden && container) {
      container.style.display = 'none'
      console.log('[Export] Storyboard container re-hidden')
    }
  }
}

export default function ExportModal({ isOpen, onClose, pageRefs, storyboardRef }) {
  const [exporting, setExporting] = useState(false)
  const [exportType, setExportType] = useState(null)

  if (!isOpen) return null

  const handleExport = async (type) => {
    setExporting(true)
    setExportType(type)
    try {
      if (type === 'pdf') {
        await exportToPDF(pageRefs, storyboardRef)
      } else {
        await exportToPNG(pageRefs, storyboardRef)
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
            {exporting && exportType === 'pdf' ? 'Exporting...' : 'Export PDF'}
            <div className="text-xs font-normal opacity-75">Separate page per scene</div>
          </button>
          <button
            onClick={() => handleExport('png')}
            disabled={exporting}
            className="flex-1 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {exporting && exportType === 'png' ? 'Exporting...' : 'Export PNG'}
            <div className="text-xs font-normal opacity-75">One PNG per page</div>
          </button>
        </div>
      </div>
    </div>
  )
}
