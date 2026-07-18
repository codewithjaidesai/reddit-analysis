import SwiftUI

/// Full-text search across every scanned page, powered by SQLite FTS5.
struct SearchView: View {
    @EnvironmentObject private var app: AppState
    @State private var query = ""
    @State private var hits: [SearchHit] = []

    var body: some View {
        NavigationStack {
            Group {
                if query.isEmpty {
                    ContentUnavailableCompatView(
                        title: "Search your journals",
                        systemImage: "magnifyingglass",
                        description: "Every word recognized from your handwriting is searchable. Try a name, a place, a feeling.")
                } else if hits.isEmpty {
                    ContentUnavailableCompatView(
                        title: "No matches",
                        systemImage: "text.page.slash",
                        description: "No pages contain “\(query)”.")
                } else {
                    List(hits) { hit in
                        NavigationLink {
                            PageDetailView(pageId: hit.pageId)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("\(hit.journalTitle) · Page \(hit.pageIndex + 1)")
                                    .font(.subheadline.bold())
                                Text(hit.snippet)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(3)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Search")
            .searchable(text: $query, prompt: "Search all journals")
            .onChange(of: query) { newValue in
                hits = (try? app.store.search(newValue)) ?? []
            }
        }
    }
}
