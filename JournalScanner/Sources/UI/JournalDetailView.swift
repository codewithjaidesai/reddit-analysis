import SwiftUI

struct JournalDetailView: View {
    @EnvironmentObject private var app: AppState
    let journalId: String
    var onChange: () -> Void = {}

    @State private var journal: Journal?
    @State private var pages: [Page] = []
    @State private var showScanner = false
    @State private var exportURL: URL?
    @State private var exportError: String?

    private let columns = [GridItem(.adaptive(minimum: 110), spacing: 12)]

    var body: some View {
        ScrollView {
            if pages.isEmpty {
                ContentUnavailableCompatView(
                    title: "No pages yet",
                    systemImage: "camera.viewfinder",
                    description: "Tap Scan and slowly flip through your journal. Pages are captured automatically when they're sharp and steady.")
                .padding(.top, 80)
            } else {
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(pages) { page in
                        NavigationLink {
                            PageDetailView(pageId: page.id, onChange: reload)
                        } label: {
                            PageThumbView(page: page)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding()
            }
        }
        .navigationTitle(journal?.title ?? "Journal")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showScanner = true
                } label: {
                    Label("Scan", systemImage: "camera.viewfinder")
                }
            }
            ToolbarItem(placement: .secondaryAction) {
                Button {
                    exportPDF()
                } label: {
                    Label("Export searchable PDF", systemImage: "square.and.arrow.up")
                }
            }
        }
        .fullScreenCover(isPresented: $showScanner, onDismiss: reload) {
            ScanView(journalId: journalId)
        }
        .sheet(item: $exportURL) { url in
            ShareSheet(items: [url])
        }
        .alert("Export failed", isPresented: .constant(exportError != nil)) {
            Button("OK") { exportError = nil }
        } message: {
            Text(exportError ?? "")
        }
        .onAppear(perform: reload)
    }

    private func reload() {
        journal = try? app.store.journal(journalId)
        pages = (try? app.store.pages(in: journalId)) ?? []
        app.refreshReviewCount()
        onChange()
    }

    private func exportPDF() {
        guard let journal else { return }
        do {
            exportURL = try SearchablePDFExporter.export(journal: journal, store: app.store)
        } catch {
            exportError = error.localizedDescription
        }
    }
}

struct PageThumbView: View {
    let page: Page

    var body: some View {
        VStack(spacing: 4) {
            Group {
                if let image = FileStore.loadImage(named: page.thumbFile) {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } else {
                    Color.secondary.opacity(0.15)
                }
            }
            .frame(height: 140)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            HStack(spacing: 4) {
                Text("Page \(page.pageIndex + 1)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if page.syncState == .synced {
                    Image(systemName: "checkmark.icloud")
                        .font(.caption2)
                        .foregroundStyle(.green)
                }
            }
        }
    }
}

extension URL: Identifiable {
    public var id: String { absoluteString }
}

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
