import Foundation
import UIKit
import CoreText

/// Exports a journal as a searchable PDF: each page shows the ORIGINAL
/// handwriting image, with the recognized text drawn invisibly on top at the
/// exact word positions — so Preview, Drive, Spotlight, etc. can select and
/// search the text while the reader sees only the handwriting.
enum SearchablePDFExporter {
    static func export(journal: Journal, store: JournalStore) throws -> URL {
        let pages = try store.pages(in: journal.id)
        guard !pages.isEmpty else {
            throw NSError(domain: "PDFExport", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "This journal has no pages yet"])
        }

        let safeTitle = journal.title.replacingOccurrences(of: "/", with: "-")
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(safeTitle).pdf")

        let firstImage = FileStore.loadImage(named: pages[0].imageFile)
        let pageSize = firstImage.map { fitted(size: $0.size) } ?? CGSize(width: 612, height: 792)

        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = [
            kCGPDFContextTitle as String: journal.title,
            kCGPDFContextCreator as String: "Journal Scanner"
        ]
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: pageSize),
                                             format: format)

        try renderer.writePDF(to: url) { context in
            for page in pages {
                guard let image = FileStore.loadImage(named: page.imageFile) else { continue }
                let bounds = CGRect(origin: .zero, size: fitted(size: image.size))
                context.beginPage(withBounds: bounds, pageInfo: [:])

                image.draw(in: bounds)
                drawInvisibleText(for: page, store: store, in: bounds,
                                  cgContext: context.cgContext)
            }
        }
        return url
    }

    private static func fitted(size: CGSize, maxDimension: CGFloat = 792) -> CGSize {
        let scale = min(1, maxDimension / max(size.width, size.height))
        return CGSize(width: size.width * scale, height: size.height * scale)
    }

    private static func drawInvisibleText(for page: Page, store: JournalStore,
                                          in bounds: CGRect, cgContext: CGContext) {
        guard let words = try? store.words(in: page.id) else { return }

        cgContext.saveGState()
        cgContext.setTextDrawingMode(.invisible)
        // UIKit PDF contexts have a flipped CTM; flip the text matrix back so
        // glyph geometry (and thus text selection) is upright.
        cgContext.textMatrix = CGAffineTransform(scaleX: 1, y: -1)

        for word in words where !word.text.isEmpty {
            // Word rects are normalized with top-left origin; UIKit PDF context
            // also uses top-left, so scale directly.
            let rect = CGRect(x: word.rect.origin.x * bounds.width,
                              y: word.rect.origin.y * bounds.height,
                              width: word.rect.width * bounds.width,
                              height: word.rect.height * bounds.height)
            let fontSize = max(4, rect.height * 0.85)
            let font = UIFont.systemFont(ofSize: fontSize)
            let attributed = NSAttributedString(string: word.text, attributes: [.font: font])
            let line = CTLineCreateWithAttributedString(attributed)

            cgContext.textPosition = CGPoint(x: rect.minX, y: rect.maxY - fontSize * 0.2)
            CTLineDraw(line, cgContext)
        }
        cgContext.restoreGState()
    }
}
