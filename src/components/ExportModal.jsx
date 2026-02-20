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

async function captureElement(el, scale = 2) {
  const restore = prepareForCapture(el)
  try {
    return await html2canvas(el, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    })
  } finally {
    restore()
  }
}

export async function exportToPDF(pageRefs) {
  const pages = (pageRefs?.current || []).filter(Boolean)
  if (pages.length === 0) return

  try {
    let pdf = null

    for (let i = 0; i < pages.length; i++) {
      const canvas = await captureElement(pages[i], 2)
      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      const pxW = canvas.width / 2
      const pxH = canvas.height / 2

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
  } catch (err) {
    console.error('PDF export failed:', err)
    alert('PDF export failed. Try reducing image sizes.')
  }
}

export async function exportToPNG(pageRefs) {
  const pages = (pageRefs?.current || []).filter(Boolean)
  if (pages.length === 0) return

  try {
    for (let i = 0; i < pages.length; i++) {
      const canvas = await captureElement(pages[i], 3)
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
    }
  } catch (err) {
    console.error('PNG export failed:', err)
    alert('PNG export failed. Try reducing image sizes.')
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
