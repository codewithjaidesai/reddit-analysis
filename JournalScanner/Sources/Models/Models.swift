import Foundation
import CoreGraphics

struct Journal: Identifiable, Hashable {
    let id: String
    var title: String
    var createdAt: Date
    var pageCount: Int
}

enum SyncState: Int {
    case pending = 0
    case uploading = 1
    case synced = 2
    case failed = 3
}

struct Page: Identifiable, Hashable {
    let id: String
    let journalId: String
    var pageIndex: Int
    /// File names relative to the app's Pages directory (stable across container moves).
    var imageFile: String
    var thumbFile: String
    var text: String
    var createdAt: Date
    var syncState: SyncState
    var dhash: Int64
}

/// A single recognized word with its position on the page.
/// `rect` is normalized to the page image, origin at TOP-LEFT.
struct WordBox: Identifiable, Hashable {
    let id: String
    let pageId: String
    var text: String
    var confidence: Double
    var rect: CGRect
    var lineIndex: Int
    var wordIndex: Int
    var needsReview: Bool
    var resolved: Bool
    var candidates: [String]
}

struct SearchHit: Identifiable, Hashable {
    var id: String { pageId }
    let pageId: String
    let journalId: String
    let journalTitle: String
    let pageIndex: Int
    let snippet: String
}

struct ReviewItem: Identifiable, Hashable {
    var id: String { word.id }
    let word: WordBox
    let pageImageFile: String
    let journalTitle: String
    let pageIndex: Int
}
