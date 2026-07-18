import Foundation

/// Picks the best reading for each word using context, and decides which
/// words are uncertain enough to ask the user about.
///
/// Scoring blends four signals:
///  1. Vision's own confidence for the candidate,
///  2. how often this user writes the word (personal lexicon),
///  3. how often it follows the previous word / precedes the next word (bigrams),
///  4. remembered manual corrections (auto-applied when seen repeatedly).
struct ContextCorrector {
    struct Output {
        var text: String
        var needsReview: Bool
        var candidates: [String]
    }

    /// Below this Vision confidence a word is flagged for review unless
    /// context strongly vouches for it.
    static let reviewThreshold = 0.42
    /// Above this the word is trusted outright and fed back into the lexicon.
    static let trustThreshold = 0.75

    let lexicon: LexiconManager

    func correct(_ words: [RecognizedWord]) -> [Output] {
        var outputs: [Output] = []
        outputs.reserveCapacity(words.count)

        for (index, word) in words.enumerated() {
            // A previously learned correction wins outright.
            if let known = lexicon.knownCorrection(for: word.text) {
                outputs.append(Output(text: matchCase(of: word.text, to: known),
                                      needsReview: false,
                                      candidates: [word.text] + word.alternatives))
                continue
            }

            let previous = outputs.last?.text
            let next = index + 1 < words.count ? words[index + 1].text : nil

            var candidateSet = [word.text] + word.alternatives
            var bestText = word.text
            var bestScore = -Double.infinity
            var topScore = -Double.infinity
            var runnerUpScore = -Double.infinity

            for (rank, candidate) in candidateSet.enumerated() {
                let visionConfidence = rank == 0 ? word.confidence : max(0.05, word.confidence - 0.15)
                let score = self.score(candidate: candidate,
                                       visionConfidence: visionConfidence,
                                       previous: previous,
                                       next: next)
                if score > bestScore {
                    runnerUpScore = topScore
                    bestScore = score
                    topScore = score
                    bestText = candidate
                } else if score > runnerUpScore {
                    runnerUpScore = score
                }
            }

            let contextSupport = Double(lexicon.frequency(of: bestText))
                + Double(previous.map { lexicon.bigramCount($0, bestText) } ?? 0)
            let lowConfidence = word.confidence < Self.reviewThreshold
            let ambiguous = !word.alternatives.isEmpty
                && (bestScore - runnerUpScore) < 0.15
                && word.confidence < Self.trustThreshold
            let needsReview = (lowConfidence && contextSupport < 3) || ambiguous

            if candidateSet.count > 4 {
                candidateSet = Array(candidateSet.prefix(4))
            }
            outputs.append(Output(text: bestText, needsReview: needsReview, candidates: candidateSet))
        }
        return outputs
    }

    private func score(candidate: String, visionConfidence: Double,
                       previous: String?, next: String?) -> Double {
        var score = 2.0 * visionConfidence
        score += 0.5 * log(1.0 + Double(lexicon.frequency(of: candidate)))
        if let previous {
            score += 0.8 * log(1.0 + Double(lexicon.bigramCount(previous, candidate)))
        }
        if let next {
            score += 0.8 * log(1.0 + Double(lexicon.bigramCount(candidate, next)))
        }
        return score
    }

    /// Preserve the original capitalization pattern when substituting a learned
    /// correction (corrections are stored lowercased).
    private func matchCase(of original: String, to replacement: String) -> String {
        guard let first = original.first, first.isUppercase else { return replacement }
        if original.allSatisfy({ !$0.isLowercase }) && original.count > 1 {
            return replacement.uppercased()
        }
        return replacement.prefix(1).uppercased() + replacement.dropFirst()
    }
}
