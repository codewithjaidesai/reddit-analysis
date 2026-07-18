import SwiftUI

/// The global "teach me your handwriting" queue: every word the recognizer
/// wasn't sure about, across all journals. Each answer improves future
/// recognition (lexicon + remembered corrections).
struct ReviewQueueView: View {
    @EnvironmentObject private var app: AppState
    @State private var items: [ReviewItem] = []

    var body: some View {
        NavigationStack {
            Group {
                if items.isEmpty {
                    ContentUnavailableCompatView(
                        title: "All caught up",
                        systemImage: "checkmark.circle",
                        description: "When the recognizer isn't sure about a word, it appears here. Your answers teach it your handwriting.")
                } else {
                    List(items) { item in
                        VStack(alignment: .leading, spacing: 8) {
                            Text("\(item.journalTitle) · Page \(item.pageIndex + 1)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            WordCorrectionRow(word: item.word,
                                              pageImage: FileStore.loadImage(named: item.pageImageFile)) { text in
                                apply(item: item, text: text)
                            }
                        }
                        .listRowSeparator(.hidden)
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Review")
            .toolbar {
                if !items.isEmpty {
                    Button("Accept all") { acceptAll() }
                }
            }
            .onAppear(perform: reload)
        }
    }

    private func reload() {
        items = (try? app.store.reviewItems()) ?? []
        app.refreshReviewCount()
    }

    private func apply(item: ReviewItem, text: String) {
        try? app.store.applyCorrection(word: item.word, newText: text, lexicon: app.lexicon)
        reload()
    }

    /// Accept the recognizer's current best guess for everything in the queue.
    private func acceptAll() {
        for item in items {
            try? app.store.applyCorrection(word: item.word, newText: item.word.text,
                                           lexicon: app.lexicon)
        }
        reload()
    }
}
