import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var app: AppState
    @State private var journals: [Journal] = []
    @State private var showNewJournal = false
    @State private var newTitle = ""

    var body: some View {
        NavigationStack {
            Group {
                if journals.isEmpty {
                    ContentUnavailableCompatView(
                        title: "No journals yet",
                        systemImage: "book.closed",
                        description: "Create a journal, then film yourself flipping through its pages — every page is captured and digitized automatically.")
                } else {
                    List {
                        ForEach(journals) { journal in
                            NavigationLink(value: journal.id) {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(journal.title).font(.headline)
                                    Text("\(journal.pageCount) page\(journal.pageCount == 1 ? "" : "s")")
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .onDelete(perform: deleteJournals)
                    }
                }
            }
            .navigationTitle("Journals")
            .navigationDestination(for: String.self) { journalId in
                JournalDetailView(journalId: journalId, onChange: reload)
            }
            .toolbar {
                Button {
                    newTitle = ""
                    showNewJournal = true
                } label: {
                    Image(systemName: "plus")
                }
            }
            .alert("New Journal", isPresented: $showNewJournal) {
                TextField("Title", text: $newTitle)
                Button("Create") {
                    let title = newTitle.trimmingCharacters(in: .whitespaces)
                    if !title.isEmpty {
                        _ = try? app.store.createJournal(title: title)
                        reload()
                    }
                }
                Button("Cancel", role: .cancel) {}
            }
            .onAppear(perform: reload)
        }
    }

    private func reload() {
        journals = (try? app.store.journals()) ?? []
        app.refreshReviewCount()
    }

    private func deleteJournals(at offsets: IndexSet) {
        for index in offsets {
            try? app.store.deleteJournal(journals[index].id)
        }
        reload()
    }
}

/// iOS 16-compatible stand-in for ContentUnavailableView (iOS 17+).
struct ContentUnavailableCompatView: View {
    let title: String
    let systemImage: String
    let description: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text(title).font(.title3).bold()
            Text(description)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
    }
}
