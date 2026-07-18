import Foundation
import Vision
import CoreGraphics

/// One word as it came out of Vision, before context correction.
struct RecognizedWord {
    var text: String
    /// Alternative readings from Vision's lower-ranked candidates.
    var alternatives: [String]
    var confidence: Double
    /// Normalized rect in the page image, origin at TOP-LEFT.
    var rect: CGRect
    var lineIndex: Int
    var wordIndex: Int
}

/// On-device handwriting OCR via Apple Vision. Nothing leaves the phone.
final class TextRecognizer {
    /// Recognizes text, returning individual words with bounding boxes and
    /// alternative candidate readings for downstream context correction.
    func recognize(cgImage: CGImage, customWords: [String]) async throws -> [RecognizedWord] {
        try await withCheckedThrowingContinuation { continuation in
            let request = VNRecognizeTextRequest { request, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
                continuation.resume(returning: Self.words(from: observations))
            }
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            request.recognitionLanguages = ["en-US"]
            if !customWords.isEmpty {
                request.customWords = customWords
            }

            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    try handler.perform([request])
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private static func words(from observations: [VNRecognizedTextObservation]) -> [RecognizedWord] {
        // Vision observations are line-level for handwriting. Sort top-to-bottom
        // (Vision uses a bottom-left origin, so higher maxY means higher on page).
        let sorted = observations.sorted { $0.boundingBox.maxY > $1.boundingBox.maxY }
        var result: [RecognizedWord] = []

        for (lineIndex, observation) in sorted.enumerated() {
            let candidates = observation.topCandidates(5)
            guard let top = candidates.first, !top.string.isEmpty else { continue }

            let tokens = tokenRanges(in: top.string)
            let altTokenLists: [[Substring]] = candidates.dropFirst().map {
                $0.string.split(whereSeparator: { $0.isWhitespace })
            }

            for (wordIndex, range) in tokens.enumerated() {
                let wordText = String(top.string[range])
                var rect = observation.boundingBox
                if let box = try? top.boundingBox(for: range)?.boundingBox {
                    rect = box
                }
                // Convert bottom-left-origin normalized rect to top-left origin.
                let topLeftRect = CGRect(x: rect.origin.x,
                                         y: 1.0 - rect.origin.y - rect.height,
                                         width: rect.width,
                                         height: rect.height)

                // Alternatives: same word position in candidate strings that
                // tokenize to the same word count (a cheap but effective alignment).
                var alternatives: [String] = []
                for altTokens in altTokenLists where altTokens.count == tokens.count {
                    let alt = String(altTokens[wordIndex])
                    if alt.lowercased() != wordText.lowercased(), !alternatives.contains(alt) {
                        alternatives.append(alt)
                    }
                }

                result.append(RecognizedWord(text: wordText,
                                             alternatives: alternatives,
                                             confidence: Double(top.confidence),
                                             rect: topLeftRect,
                                             lineIndex: lineIndex,
                                             wordIndex: wordIndex))
            }
        }
        return result
    }

    private static func tokenRanges(in string: String) -> [Range<String.Index>] {
        var ranges: [Range<String.Index>] = []
        var start: String.Index?
        var index = string.startIndex
        while index < string.endIndex {
            if string[index].isWhitespace {
                if let s = start {
                    ranges.append(s..<index)
                    start = nil
                }
            } else if start == nil {
                start = index
            }
            index = string.index(after: index)
        }
        if let s = start {
            ranges.append(s..<string.endIndex)
        }
        return ranges
    }
}
