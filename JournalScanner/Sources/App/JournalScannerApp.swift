import SwiftUI

@main
struct JournalScannerApp: App {
    @StateObject private var app = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(app)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var app: AppState

    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Journals", systemImage: "book.closed") }

            SearchView()
                .tabItem { Label("Search", systemImage: "magnifyingglass") }

            ReviewQueueView()
                .tabItem { Label("Review", systemImage: "checkmark.circle") }
                .badge(app.reviewCount)

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
        .onAppear { app.refreshReviewCount() }
    }
}
