'use client'

import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface ExportSheet {
  name: string
  head: string[]
  body: (string | number)[][]
}

// Excel eksport — bir nechta varaq bilan
export function exportToExcel(sheets: ExportSheet[], filename: string) {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([s.head, ...s.body])
    const widths = s.head.map((h, i) =>
      Math.max(h.length, ...s.body.map((r) => String(r[i] ?? '').length)) + 3
    )
    ws['!cols'] = widths.map((w) => ({ wch: Math.min(Math.max(w, 9), 55) }))
    // Excel varaq nomida taqiqlangan belgilar: : \ / ? * [ ] — ularni bo'shliqqa almashtiramiz
    const safeName =
      s.name.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Varaq'
    XLSX.utils.book_append_sheet(wb, ws, safeName)
  }
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

// PDF eksport — sarlavha + bir nechta jadval
export function exportToPDF(opts: {
  title: string
  subtitle?: string
  company?: string
  sheets: { title?: string; head: string[]; body: (string | number)[][] }[]
  filename: string
  landscape?: boolean
}) {
  const doc = new jsPDF({
    orientation: opts.landscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  })
  const pageWidth = doc.internal.pageSize.getWidth()

  // Sarlavha bloki
  let y = 40
  if (opts.company) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(61, 122, 134)
    doc.text(opts.company.toUpperCase(), pageWidth / 2, y, { align: 'center' })
    y += 18
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(30, 30, 30)
  doc.text(opts.title, pageWidth / 2, y, { align: 'center' })

  if (opts.subtitle) {
    y += 20
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(90, 90, 90)
    doc.text(opts.subtitle, pageWidth / 2, y, { align: 'center' })
  }

  y += 14
  doc.setDrawColor(61, 138, 150)
  doc.setLineWidth(1.5)
  doc.line(40, y, pageWidth - 40, y)

  let first = true
  for (const sheet of opts.sheets) {
    let startY = y + 24
    if (sheet.title) {
      if (!first) startY += 8
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(60, 60, 60)
      // yangi sahifada jadval sarlavhasini chizish
      autoTable(doc, {
        head: [[sheet.title]],
        body: [],
        startY,
        theme: 'plain',
        styles: { fontStyle: 'bold', fontSize: 11, textColor: [60, 60, 60] },
        margin: { left: 40, right: 40 },
      })
      const ty = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
      startY = ty + 4
    }
    autoTable(doc, {
      head: [sheet.head],
      body: sheet.body.length ? sheet.body : [sheet.head.map(() => '-')],
      startY,
      theme: 'grid',
      headStyles: { fillColor: [61, 138, 150], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      styles: { fontSize: 8.5, cellPadding: 4, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: [245, 250, 251] },
      margin: { left: 40, right: 40 },
      didDrawPage: () => {
        if (!first) return
      },
    })
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    y = finalY
    first = false
  }

  // Har bir sahifaga footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const h = doc.internal.pageSize.getHeight()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140, 140, 140)
    doc.text(
      [opts.company ? `${opts.company}` : '', 'QurilPro', new Date().toLocaleDateString('ru-RU')]
        .filter(Boolean)
        .join(' · '),
      40,
      h - 18
    )
    doc.text(`${i} / ${pageCount}`, pageWidth - 40, h - 18, { align: 'right' })
  }

  doc.save(opts.filename.endsWith('.pdf') ? opts.filename : `${opts.filename}.pdf`)
}
