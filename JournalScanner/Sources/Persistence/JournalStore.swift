import Foundation
import CoreGraphics

/// All domain reads/writes. Thin typed layer over `Database`.
final class JournalStore {
    let db: Database

    init(db: Database) {
        self.db = db
    }

    // MARK: - Journals

    @discardableResult
    func createJournal(title: String) throws -> Journal {
        let journal = Journal(id: UUID().uuidString, title: title, createdAt: Date(), pageCount: 0)
        try db.run("INSERT INTO journals (id, title, createdAt) VALUES (?,?,?)",
                   [journal.id, journal.title, journal.createdAt])
        return journal
    }

    func renameJournal(_ id: String, title: String) throws {
        try db.run("UPDATE journals SET title = ? WHERE id = ?", [title, id])
    }

    func deleteJournal(_ id: String) throws {
        for page in try pages(in: id) {
            FileStore.deletePageFiles(page)
            try db.run("DELETE FROM pages_fts WHERE pageId = ?", [page.id])
        }
        try db.run("DELETE FROM journals WHERE id = ?", [id])
    }

    func journals() throws -> [Journal] {
        try db.rows("""
            SELECT j.id, j.title, j.createdAt,
                   (SELECT COUNT(*) FROM pages p WHERE p.journalId = j.id) AS pageCount
            FROM journals j ORDER BY j.createdAt DESC
            """).map { row in
            Journal(id: row["id"]?.string ?? "",
                    title: row["title"]?.string ?? "",
                    createdAt: Date(timeIntervalSince1970: row["createdAt"]?.double ?? 0),
                    pageCount: Int(row["pageCount"]?.int ?? 0))
        }
    }

    func journal(_ id: String) throws -> Journal? {
        try journals().first { $0.id == id }
    }

    // MARK: - Pages

    func nextPageIndex(in journalId: String) throws -> Int {
        let row = try db.rows("SELECT COALESCE(MAX(pageIndex), -1) + 1 AS next FROM pages WHERE journalId = ?",
                              [journalId]).first
        return Int(row?["next"]?.int ?? 0)
    }

    func recentPageHashes(in journalId: String, limit: Int = 12) throws -> [Int64] {
        try db.rows("SELECT dhash FROM pages WHERE journalId = ? ORDER BY pageIndex DESC LIMIT ?",
                    [journalId, limit]).compactMap { $0["dhash"]?.int }
    }

    func savePage(_ page: Page, words: [WordBox]) throws {
        try db.transaction {
            try db.run("""
                INSERT INTO pages (id, journalId, pageIndex, imageFile, thumbFile, text, createdAt, syncState, dhash)
                VALUES (?,?,?,?,?,?,?,?,?)
                """, [page.id, page.journalId, page.pageIndex, page.imageFile, page.thumbFile,
                      page.text, page.createdAt, page.syncState.rawValue, page.dhash])
            for word in words {
                try insertWord(word)
            }
            try db.run("INSERT INTO pages_fts (pageId, body) VALUES (?,?)", [page.id, page.text])
        }
    }

    private func insertWord(_ w: WordBox) throws {
        let candidatesJSON = (try? JSONEncoder().encode(w.candidates))
            .flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
        try db.run("""
            INSERT INTO words (id, pageId, text, confidence, x, y, w, h, lineIndex, wordIndex, needsReview, resolved, candidates)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, [w.id, w.pageId, w.text, w.confidence,
                  Double(w.rect.origin.x), Double(w.rect.origin.y),
                  Double(w.rect.width), Double(w.rect.height),
                  w.lineIndex, w.wordIndex, w.needsReview, w.resolved, candidatesJSON])
    }

    func pages(in journalId: String) throws -> [Page] {
        try db.rows("SELECT * FROM pages WHERE journalId = ? ORDER BY pageIndex ASC", [journalId])
            .map(Self.pageFrom)
    }

    func page(_ id: String) throws -> Page? {
        try db.rows("SELECT * FROM pages WHERE id = ?", [id]).first.map(Self.pageFrom)
    }

    func pendingSyncPages() throws -> [Page] {
        try db.rows("SELECT * FROM pages WHERE syncState IN (0, 3) ORDER BY createdAt ASC")
            .map(Self.pageFrom)
    }

    func setSyncState(_ state: SyncState, pageId: String) throws {
        try db.run("UPDATE pages SET syncState = ? WHERE id = ?", [state.rawValue, pageId])
    }

    func deletePage(_ page: Page) throws {
        FileStore.deletePageFiles(page)
        try db.run("DELETE FROM pages_fts WHERE pageId = ?", [page.id])
        try db.run("DELETE FROM pages WHERE id = ?", [page.id])
    }

    private static func pageFrom(_ row: Database.Row) -> Page {
        Page(id: row["id"]?.string ?? "",
             journalId: row["journalId"]?.string ?? "",
             pageIndex: Int(row["pageIndex"]?.int ?? 0),
             imageFile: row["imageFile"]?.string ?? "",
             thumbFile: row["thumbFile"]?.string ?? "",
             text: row["text"]?.string ?? "",
             createdAt: Date(timeIntervalSince1970: row["createdAt"]?.double ?? 0),
             syncState: SyncState(rawValue: Int(row["syncState"]?.int ?? 0)) ?? .pending,
             dhash: row["dhash"]?.int ?? 0)
    }

    // MARK: - Words

    func words(in pageId: String) throws -> [WordBox] {
        try db.rows("SELECT * FROM words WHERE pageId = ? ORDER BY lineIndex, wordIndex", [pageId])
            .map(Self.wordFrom)
    }

    private static func wordFrom(_ row: Database.Row) -> WordBox {
        let candidates: [String]
        if let json = row["candidates"]?.string?.data(using: .utf8),
           let decoded = try? JSONDecoder().decode([String].self, from: json) {
            candidates = decoded
        } else {
            candidates = []
        }
        return WordBox(id: row["id"]?.string ?? "",
                       pageId: row["pageId"]?.string ?? "",
                       text: row["text"]?.string ?? "",
                       confidence: row["confidence"]?.double ?? 0,
                       rect: CGRect(x: row["x"]?.double ?? 0, y: row["y"]?.double ?? 0,
                                    width: row["w"]?.double ?? 0, height: row["h"]?.double ?? 0),
                       lineIndex: Int(row["lineIndex"]?.int ?? 0),
                       wordIndex: Int(row["wordIndex"]?.int ?? 0),
                       needsReview: (row["needsReview"]?.int ?? 0) == 1,
                       resolved: (row["resolved"]?.int ?? 0) == 1,
                       candidates: candidates)
    }

    // MARK: - Review queue

    func pendingReviewCount() throws -> Int {
        let row = try db.rows("SELECT COUNT(*) AS c FROM words WHERE needsReview = 1").first
        return Int(row?["c"]?.int ?? 0)
    }

    func reviewItems(limit: Int = 100) throws -> [ReviewItem] {
        let rows = try db.rows("""
            SELECT w.*, p.imageFile AS pageImageFile, p.pageIndex AS pIndex, j.title AS jTitle
            FROM words w
            JOIN pages p ON p.id = w.pageId
            JOIN journals j ON j.id = p.journalId
            WHERE w.needsReview = 1
            ORDER BY p.createdAt DESC, w.lineIndex, w.wordIndex
            LIMIT ?
            """, [limit])
        return rows.map { row in
            ReviewItem(word: Self.wordFrom(row),
                       pageImageFile: row["pageImageFile"]?.string ?? "",
                       journalTitle: row["jTitle"]?.string ?? "",
                       pageIndex: Int(row["pIndex"]?.int ?? 0))
        }
    }

    /// Applies a user correction (or confirmation) to a word: updates the word,
    /// rebuilds the page text from its words, refreshes the FTS index, and
    /// records the substitution so it is auto-applied in the future.
    func applyCorrection(word: WordBox, newText: String, lexicon: LexiconManager) throws {
        let trimmed = newText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            try db.run("UPDATE words SET needsReview = 0, resolved = 1 WHERE id = ?", [word.id])
            return
        }
        try db.transaction {
            try db.run("UPDATE words SET text = ?, needsReview = 0, resolved = 1, confidence = 1.0 WHERE id = ?",
                       [trimmed, word.id])
            if trimmed.lowercased() != word.text.lowercased() {
                try db.run("""
                    INSERT INTO corrections (wrong, right, count) VALUES (?,?,1)
                    ON CONFLICT(wrong, right) DO UPDATE SET count = count + 1
                    """, [word.text.lowercased(), trimmed])
            }
            try rebuildPageText(pageId: word.pageId)
        }
        lexicon.learn(words: [trimmed])
    }

    private func rebuildPageText(pageId: String) throws {
        let rows = try db.rows("SELECT text, lineIndex FROM words WHERE pageId = ? ORDER BY lineIndex, wordIndex",
                               [pageId])
        var lines: [Int: [String]] = [:]
        for row in rows {
            let line = Int(row["lineIndex"]?.int ?? 0)
            lines[line, default: []].append(row["text"]?.string ?? "")
        }
        let text = lines.keys.sorted()
            .map { lines[$0]!.joined(separator: " ") }
            .joined(separator: "\n")
        try db.run("UPDATE pages SET text = ?, syncState = 0 WHERE id = ?", [text, pageId])
        try db.run("DELETE FROM pages_fts WHERE pageId = ?", [pageId])
        try db.run("INSERT INTO pages_fts (pageId, body) VALUES (?,?)", [pageId, text])
    }

    // MARK: - Search

    func search(_ query: String) throws -> [SearchHit] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }
        // Quote each term so user input can't break FTS query syntax; add * for prefix search.
        let ftsQuery = trimmed
            .split(separator: " ")
            .map { "\"\($0.replacingOccurrences(of: "\"", with: ""))\"*" }
            .joined(separator: " ")
        let rows = try db.rows("""
            SELECT f.pageId,
                   snippet(pages_fts, 1, '[', ']', '…', 12) AS snip,
                   p.journalId, p.pageIndex, j.title AS jTitle
            FROM pages_fts f
            JOIN pages p ON p.id = f.pageId
            JOIN journals j ON j.id = p.journalId
            WHERE pages_fts MATCH ?
            ORDER BY rank
            LIMIT 200
            """, [ftsQuery])
        return rows.map { row in
            SearchHit(pageId: row["pageId"]?.string ?? "",
                      journalId: row["journalId"]?.string ?? "",
                      journalTitle: row["jTitle"]?.string ?? "",
                      pageIndex: Int(row["pageIndex"]?.int ?? 0),
                      snippet: row["snip"]?.string ?? "")
        }
    }
}
