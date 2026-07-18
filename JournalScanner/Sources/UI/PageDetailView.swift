import SwiftUI

/// One page: toggle between the original handwriting and the digitized text.
/// Uncertain words are listed for quick inline correction.
struct PageDetailView: View {
    @EnvironmentObject private var app: AppState
    let pageId: String
    var onChange: () -> Void = {}

    enum Mode: String, CaseIterable {
        case original = "Original"
        case text = "Text"
    }

    @State private var mode: Mode = .original
    @State private var page: Page?
    @State private var reviewWords: [WordBox] = []
    @State private var pageImage: UIImage?

    var body: some View {
        VStack(spacing: 0) {
            Picker("Mode", selection: $mode) {
                ForEach(Mode.allCases, id: \.self) { Text($0.rawValue) }
            }
            .pickerStyle(.segmented)
            .padding()

            ScrollView {
                switch mode {
                case .original:
                    if let pageImage {
                        Image(uiImage: pageImage)
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .padding(.horizontal)
                    }
                case .text:
                    VStack(alignment: .leading, spacing: 16) {
                        Text(page?.text.isEmpty == false ? page!.text : "No text was recognized on this page.")
                            .font(.body)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        if !reviewWords.isEmpty {
                            Divider()
                            Text("Needs review (\(reviewWords.count))")
                                .font(.headline)
                            ForEach(reviewWords) { word in
                                WordCorrectionRow(word: word, pageImage: pageImage) { corrected in
                                    apply(word: word, text: corrected)
                                }
                            }
                        }
                    }
                    .padding(.horizontal)
                }
            }
        }
        .navigationTitle(page.map { "Page \($0.pageIndex + 1)" } ?? "Page")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear(perform: reload)
    }

    private func reload() {
        page = try? app.store.page(pageId)
        reviewWords = ((try? app.store.words(in: pageId)) ?? []).filter { $0.needsReview }
        if let page {
            pageImage = FileStore.loadImage(named: page.imageFile)
        }
    }

    private func apply(word: WordBox, text: String) {
        try? app.store.applyCorrection(word: word, newText: text, lexicon: app.lexicon)
        reload()
        app.refreshReviewCount()
        onChange()
    }
}

/// One uncertain word: shows the handwriting crop, candidate buttons, and a
/// free-text field. Every answer teaches the recognizer.
struct WordCorrectionRow: View {
    let word: WordBox
    let pageImage: UIImage?
    let onCorrect: (String) -> Void

    @State private var customText = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let crop = pageImage?.crop(normalizedRect: word.rect) {
                Image(uiImage: crop)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(maxHeight: 64)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack {
                    ForEach(word.candidates, id: \.self) { candidate in
                        Button(candidate) { onCorrect(candidate) }
                            .buttonStyle(.bordered)
                            .font(.callout)
                    }
                }
            }

            HStack {
                TextField("Type the correct word", text: $customText)
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
                Button("Save") {
                    onCorrect(customText)
                }
                .buttonStyle(.borderedProminent)
                .disabled(customText.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(12)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
    }
}
