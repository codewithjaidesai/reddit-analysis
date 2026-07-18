import Foundation
import UIKit

/// End-to-end processing of one captured page:
/// save image → OCR → context correction → persist + index → learn.
final class RecognitionPipeline {
    private let store: JournalStore
    private let lexicon: LexiconManager
    private let recognizer = TextRecognizer()

    init(store: JournalStore, lexicon: LexiconManager) {
        self.store = store
        self.lexicon = lexicon
    }

    /// Processes a captured page image and returns the saved Page.
    @discardableResult
    func process(image: UIImage, journalId: String, dhash: Int64) async throws -> Page {
        let pageId = UUID().uuidString
        let (imageFile, thumbFile) = try FileStore.savePageImage(image, pageId: pageId)

        guard let cgImage = image.cgImage else {
            throw NSError(domain: "Pipeline", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Image has no CGImage backing"])
        }

        let recognized = try await recognizer.recognize(cgImage: cgImage,
                                                        customWords: lexicon.customWords())
        let corrector = ContextCorrector(lexicon: lexicon)
        let corrected = corrector.correct(recognized)

        var wordBoxes: [WordBox] = []
        var lines: [Int: [String]] = [:]
        var confidentWords: [String] = []

        for (raw, output) in zip(recognized, corrected) {
            wordBoxes.append(WordBox(id: UUID().uuidString,
                                     pageId: pageId,
                                     text: output.text,
                                     confidence: raw.confidence,
                                     rect: raw.rect,
                                     lineIndex: raw.lineIndex,
                                     wordIndex: raw.wordIndex,
                                     needsReview: output.needsReview,
                                     resolved: false,
                                     candidates: output.candidates))
            lines[raw.lineIndex, default: []].append(output.text)
            if raw.confidence >= ContextCorrector.trustThreshold && !output.needsReview {
                confidentWords.append(output.text)
            }
        }

        let text = lines.keys.sorted()
            .map { lines[$0]!.joined(separator: " ") }
            .joined(separator: "\n")

        let page = Page(id: pageId,
                        journalId: journalId,
                        pageIndex: try store.nextPageIndex(in: journalId),
                        imageFile: imageFile,
                        thumbFile: thumbFile,
                        text: text,
                        createdAt: Date(),
                        syncState: .pending,
                        dhash: dhash)

        try store.savePage(page, words: wordBoxes)

        // Only high-confidence words train the personal model — never guesses.
        lexicon.learn(words: confidentWords)
        return page
    }
}
