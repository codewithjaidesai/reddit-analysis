import Foundation
import SwiftUI

/// Root dependency container. Owns every long-lived service in the app.
@MainActor
final class AppState: ObservableObject {
    let db: Database
    let store: JournalStore
    let lexicon: LexiconManager
    let pipeline: RecognitionPipeline
    let auth: GoogleAuth
    let drive: GoogleDriveClient
    let vault: CryptoVault
    let sync: SyncEngine

    @Published var reviewCount: Int = 0

    init() {
        let dbURL = FileStore.documentsDirectory.appendingPathComponent("journal.sqlite")
        let db = Database(path: dbURL.path)
        self.db = db
        self.store = JournalStore(db: db)
        self.lexicon = LexiconManager(db: db)
        self.pipeline = RecognitionPipeline(store: store, lexicon: lexicon)
        self.auth = GoogleAuth()
        self.drive = GoogleDriveClient(auth: auth)
        self.vault = CryptoVault()
        self.sync = SyncEngine(store: store, drive: drive, vault: vault, auth: auth)
    }

    func refreshReviewCount() {
        reviewCount = (try? store.pendingReviewCount()) ?? 0
    }
}
