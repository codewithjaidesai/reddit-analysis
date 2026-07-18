import XCTest
@testable import JournalScanner

final class DatabaseTests: XCTestCase {
    private var db: Database!
    private var store: JournalStore!
    private var lexicon: LexiconManager!

    override func setUp() {
        super.setUp()
        let path = NSTemporaryDirectory() + "test-\(UUID().uuidString).sqlite"
        db = Database(path: path)
        store = JournalStore(db: db)
        lexicon = LexiconManager(db: db)
    }

    private func makePage(journalId: String, text: String, words: [String]) throws -> Page {
        let pageId = UUID().uuidString
        let page = Page(id: pageId, journalId: journalId,
                        pageIndex: try store.nextPageIndex(in: journalId),
                        imageFile: "x.jpg", thumbFile: "x_thumb.jpg",
                        text: text, createdAt: Date(), syncState: .pending, dhash: 0)
        let wordBoxes = words.enumerated().map { index, word in
            WordBox(id: UUID().uuidString, pageId: pageId, text: word,
                    confidence: 0.9,
                    rect: CGRect(x: 0.1 * Double(index), y: 0, width: 0.08, height: 0.03),
                    lineIndex: 0, wordIndex: index,
                    needsReview: false, resolved: false, candidates: [])
        }
        try store.savePage(page, words: wordBoxes)
        return page
    }

    func testJournalCRUD() throws {
        let journal = try store.createJournal(title: "Travel 2026")
        XCTAssertEqual(try store.journals().count, 1)
        try store.renameJournal(journal.id, title: "Travels")
        XCTAssertEqual(try store.journal(journal.id)?.title, "Travels")
        try store.deleteJournal(journal.id)
        XCTAssertTrue(try store.journals().isEmpty)
    }

    func testFullTextSearch() throws {
        let journal = try store.createJournal(title: "Diary")
        _ = try makePage(journalId: journal.id,
                         text: "walked along the seine in paris today",
                         words: ["walked", "along", "the", "seine", "in", "paris", "today"])
        _ = try makePage(journalId: journal.id,
                         text: "quiet morning with coffee",
                         words: ["quiet", "morning", "with", "coffee"])

        let hits = try store.search("paris")
        XCTAssertEqual(hits.count, 1)
        XCTAssertTrue(hits[0].snippet.contains("paris"))

        // Prefix search works too.
        XCTAssertEqual(try store.search("cof").count, 1)
        XCTAssertTrue(try store.search("berlin").isEmpty)
    }

    func testSearchHandlesQuotesInQuery() throws {
        let journal = try store.createJournal(title: "Diary")
        _ = try makePage(journalId: journal.id, text: "hello world", words: ["hello", "world"])
        XCTAssertNoThrow(try store.search("\"hello OR\" world("))
    }

    func testCorrectionRebuildsPageTextAndIndex() throws {
        let journal = try store.createJournal(title: "Diary")
        let page = try makePage(journalId: journal.id,
                                text: "meet me at the cafc",
                                words: ["meet", "me", "at", "the", "cafc"])
        let wrong = try store.words(in: page.id).first { $0.text == "cafc" }!

        try store.applyCorrection(word: wrong, newText: "cafe", lexicon: lexicon)

        XCTAssertEqual(try store.page(page.id)?.text, "meet me at the cafe")
        XCTAssertEqual(try store.search("cafe").count, 1)
        XCTAssertTrue(try store.search("cafc").isEmpty)
        // Page is marked for re-sync after correction.
        XCTAssertEqual(try store.page(page.id)?.syncState, .pending)
    }

    func testReviewQueue() throws {
        let journal = try store.createJournal(title: "Diary")
        let pageId = UUID().uuidString
        let page = Page(id: pageId, journalId: journal.id, pageIndex: 0,
                        imageFile: "x.jpg", thumbFile: "t.jpg", text: "hmm",
                        createdAt: Date(), syncState: .pending, dhash: 0)
        let uncertain = WordBox(id: UUID().uuidString, pageId: pageId, text: "hmm",
                                confidence: 0.2, rect: .zero, lineIndex: 0, wordIndex: 0,
                                needsReview: true, resolved: false, candidates: ["hmm", "him"])
        try store.savePage(page, words: [uncertain])

        XCTAssertEqual(try store.pendingReviewCount(), 1)
        let item = try store.reviewItems().first!
        XCTAssertEqual(item.word.candidates, ["hmm", "him"])

        try store.applyCorrection(word: item.word, newText: "him", lexicon: lexicon)
        XCTAssertEqual(try store.pendingReviewCount(), 0)
    }
}
