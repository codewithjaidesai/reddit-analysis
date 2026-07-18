import Foundation

/// Uploads captured pages to the user's Google Drive.
/// Layout: Drive root / Journal Scanner / <journal title> / page_0001.jpg + page_0001.json
/// With encryption ON (the default), both files are AES-GCM sealed and get an
/// `.enc` suffix; Drive only ever stores ciphertext.
final class SyncEngine: ObservableObject {
    @Published private(set) var isSyncing = false
    @Published private(set) var progressText = ""
    @Published var lastError: String?

    /// Client-side encryption toggle, persisted in UserDefaults. Default ON.
    @Published var encryptUploads: Bool {
        didSet { UserDefaults.standard.set(encryptUploads, forKey: "encryptUploads") }
    }

    private let store: JournalStore
    private let drive: GoogleDriveClient
    private let vault: CryptoVault
    private let auth: GoogleAuth
    private var folderCache: [String: String] = [:]

    init(store: JournalStore, drive: GoogleDriveClient, vault: CryptoVault, auth: GoogleAuth) {
        self.store = store
        self.drive = drive
        self.vault = vault
        self.auth = auth
        self.encryptUploads = (UserDefaults.standard.object(forKey: "encryptUploads") as? Bool) ?? true
    }

    @MainActor
    func syncNow() async {
        guard auth.isSignedIn, !isSyncing else { return }
        isSyncing = true
        lastError = nil
        defer {
            isSyncing = false
            progressText = ""
        }

        do {
            let pending = try store.pendingSyncPages()
            guard !pending.isEmpty else {
                progressText = "Everything is up to date"
                return
            }
            let rootFolder = try await drive.ensureFolder(named: "Journal Scanner", parent: nil)

            for (index, page) in pending.enumerated() {
                progressText = "Uploading page \(index + 1) of \(pending.count)…"
                do {
                    try await upload(page: page, rootFolder: rootFolder)
                    try store.setSyncState(.synced, pageId: page.id)
                } catch {
                    try? store.setSyncState(.failed, pageId: page.id)
                    throw error
                }
            }
            progressText = "Synced \(pending.count) page(s)"
        } catch {
            lastError = error.localizedDescription
        }
    }

    private func upload(page: Page, rootFolder: String) async throws {
        let journalTitle = (try? store.journal(page.journalId))?.title ?? "Journal"
        let journalFolder: String
        if let cached = folderCache[page.journalId] {
            journalFolder = cached
        } else {
            journalFolder = try await drive.ensureFolder(named: journalTitle, parent: rootFolder)
            folderCache[page.journalId] = journalFolder
        }

        let baseName = String(format: "page_%04d", page.pageIndex + 1)

        // 1. Page image (the original handwriting).
        let imageURL = FileStore.url(forPageFile: page.imageFile)
        var imageData = try Data(contentsOf: imageURL)
        var imageName = "\(baseName).jpg"
        var imageMime = "image/jpeg"
        if encryptUploads {
            imageData = try vault.seal(imageData)
            imageName += ".enc"
            imageMime = "application/octet-stream"
        }
        try await drive.uploadFile(name: imageName, data: imageData,
                                   mimeType: imageMime, parentFolder: journalFolder)

        // 2. Text sidecar (recognized words → searchable off-device too).
        let words = (try? store.words(in: page.id)) ?? []
        let sidecar: [String: Any] = [
            "pageId": page.id,
            "journal": journalTitle,
            "pageIndex": page.pageIndex,
            "capturedAt": ISO8601DateFormatter().string(from: page.createdAt),
            "text": page.text,
            "words": words.map { [
                "text": $0.text,
                "confidence": $0.confidence,
                "rect": [Double($0.rect.origin.x), Double($0.rect.origin.y),
                         Double($0.rect.width), Double($0.rect.height)]
            ] }
        ]
        var jsonData = try JSONSerialization.data(withJSONObject: sidecar, options: [.prettyPrinted])
        var jsonName = "\(baseName).json"
        var jsonMime = "application/json"
        if encryptUploads {
            jsonData = try vault.seal(jsonData)
            jsonName += ".enc"
            jsonMime = "application/octet-stream"
        }
        try await drive.uploadFile(name: jsonName, data: jsonData,
                                   mimeType: jsonMime, parentFolder: journalFolder)
    }
}
