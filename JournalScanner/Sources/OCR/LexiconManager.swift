import Foundation

/// The personal language model. Tracks the user's vocabulary (unigram counts),
/// word-pair frequencies (bigrams), and remembered OCR corrections. This is
/// how the app "learns your handwriting": every confirmed word makes future
/// recognition of that word more likely, and every manual correction is
/// auto-applied the next time the same misread occurs.
final class LexiconManager {
    private let db: Database

    init(db: Database) {
        self.db = db
    }

    // MARK: - Learning

    /// Feed confidently recognized (or user-confirmed) words back into the model.
    func learn(words: [String]) {
        let cleaned = words.map(Self.normalize).filter { $0.count > 1 }
        guard !cleaned.isEmpty else { return }
        try? db.transaction {
            for word in cleaned {
                try db.run("""
                    INSERT INTO lexicon (word, count) VALUES (?, 1)
                    ON CONFLICT(word) DO UPDATE SET count = count + 1
                    """, [word])
            }
            for (a, b) in zip(cleaned, cleaned.dropFirst()) {
                try db.run("""
                    INSERT INTO bigrams (w1, w2, count) VALUES (?,?,1)
                    ON CONFLICT(w1, w2) DO UPDATE SET count = count + 1
                    """, [a, b])
            }
        }
    }

    func learn(text: String) {
        learn(words: text.split(whereSeparator: { $0.isWhitespace || $0.isNewline }).map(String.init))
    }

    // MARK: - Queries

    func frequency(of word: String) -> Int {
        let row = try? db.rows("SELECT count FROM lexicon WHERE word = ?", [Self.normalize(word)]).first
        return Int(row??["count"]?.int ?? 0)
    }

    func bigramCount(_ first: String, _ second: String) -> Int {
        let row = try? db.rows("SELECT count FROM bigrams WHERE w1 = ? AND w2 = ?",
                               [Self.normalize(first), Self.normalize(second)]).first
        return Int(row??["count"]?.int ?? 0)
    }

    /// Known substitution for a frequently corrected misread, if any.
    /// Requires the correction to have been made at least twice so a single
    /// one-off fix doesn't rewrite future pages.
    func knownCorrection(for word: String) -> String? {
        let row = try? db.rows("""
            SELECT right FROM corrections WHERE wrong = ? AND count >= 2
            ORDER BY count DESC LIMIT 1
            """, [word.lowercased()]).first
        return row??["right"]?.string
    }

    /// The user's most frequent words, passed to Vision as `customWords`
    /// so the recognizer is biased toward this person's vocabulary.
    func customWords(limit: Int = 300) -> [String] {
        let rows = (try? db.rows("SELECT word FROM lexicon WHERE count >= 2 ORDER BY count DESC LIMIT ?",
                                 [limit])) ?? []
        return rows.compactMap { $0["word"]?.string }
    }

    var vocabularySize: Int {
        let row = try? db.rows("SELECT COUNT(*) AS c FROM lexicon").first
        return Int(row??["c"]?.int ?? 0)
    }

    static func normalize(_ word: String) -> String {
        word.lowercased().trimmingCharacters(in: .punctuationCharacters.union(.whitespaces))
    }
}
