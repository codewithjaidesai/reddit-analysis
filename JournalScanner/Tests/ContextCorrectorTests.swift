import XCTest
@testable import JournalScanner

final class ContextCorrectorTests: XCTestCase {
    private var db: Database!
    private var lexicon: LexiconManager!
    private var corrector: ContextCorrector!

    override func setUp() {
        super.setUp()
        db = Database(path: NSTemporaryDirectory() + "lex-\(UUID().uuidString).sqlite")
        lexicon = LexiconManager(db: db)
        corrector = ContextCorrector(lexicon: lexicon)
    }

    private func word(_ text: String, alts: [String] = [], confidence: Double,
                      line: Int = 0, index: Int) -> RecognizedWord {
        RecognizedWord(text: text, alternatives: alts, confidence: confidence,
                       rect: .zero, lineIndex: line, wordIndex: index)
    }

    func testConfidentWordsPassThrough() {
        let output = corrector.correct([
            word("Dear", confidence: 0.95, index: 0),
            word("diary", confidence: 0.9, index: 1)
        ])
        XCTAssertEqual(output.map(\.text), ["Dear", "diary"])
        XCTAssertFalse(output.contains { $0.needsReview })
    }

    func testLowConfidenceUnknownWordFlagsReview() {
        let output = corrector.correct([word("zxqv", confidence: 0.2, index: 0)])
        XCTAssertTrue(output[0].needsReview)
    }

    func testBigramContextPicksBetterCandidate() {
        // Teach the model that this user often writes "morning coffee".
        for _ in 0..<10 {
            lexicon.learn(words: ["morning", "coffee"])
        }
        let output = corrector.correct([
            word("morning", confidence: 0.9, index: 0),
            word("coffec", alts: ["coffee"], confidence: 0.5, index: 1)
        ])
        XCTAssertEqual(output[1].text, "coffee")
    }

    func testRepeatedCorrectionIsAutoApplied() throws {
        // Simulate the user fixing the same misread twice.
        try db.run("INSERT INTO corrections (wrong, right, count) VALUES ('lernt', 'learnt', 2)")

        let output = corrector.correct([word("lernt", confidence: 0.6, index: 0)])
        XCTAssertEqual(output[0].text, "learnt")
        XCTAssertFalse(output[0].needsReview)

        // Capitalization pattern of the original is preserved.
        let capitalized = corrector.correct([word("Lernt", confidence: 0.6, index: 0)])
        XCTAssertEqual(capitalized[0].text, "Learnt")
    }

    func testSingleCorrectionIsNotAutoApplied() throws {
        try db.run("INSERT INTO corrections (wrong, right, count) VALUES ('teh', 'the', 1)")
        XCTAssertNil(lexicon.knownCorrection(for: "teh"))
    }

    func testLexiconLearningAndCustomWords() {
        lexicon.learn(text: "Sailing in Santorini was wonderful. Santorini sunsets!")
        XCTAssertEqual(lexicon.frequency(of: "santorini"), 2)
        XCTAssertGreaterThan(lexicon.bigramCount("santorini", "sunsets"), 0)

        lexicon.learn(words: ["Santorini"])
        XCTAssertTrue(lexicon.customWords().contains("santorini"))
    }
}
