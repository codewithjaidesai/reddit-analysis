import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var app: AppState

    var body: some View {
        NavigationStack {
            Form {
                CloudBackupSection(auth: app.auth, sync: app.sync, vault: app.vault)

                Section("Handwriting model") {
                    LabeledContent("Words learned", value: "\(app.lexicon.vocabularySize)")
                    Text("The recognizer adapts to your handwriting: frequent words, word pairs, and your corrections all feed back into recognition. All of it stays on this device.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Privacy") {
                    Text("Handwriting recognition runs entirely on-device (Apple Vision). No page, image, or word ever reaches a server other than your own connected cloud storage — encrypted by default.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Settings")
        }
    }
}

/// Observes auth and sync directly so connection state, progress, and errors
/// update live.
private struct CloudBackupSection: View {
    @ObservedObject var auth: GoogleAuth
    @ObservedObject var sync: SyncEngine
    let vault: CryptoVault

    @State private var signInError: String?
    @State private var showKeyExport = false

    var body: some View {
        Section("Cloud backup") {
            if auth.isSignedIn {
                Label("Google Drive connected", systemImage: "checkmark.icloud")
                    .foregroundStyle(.green)

                Toggle("Encrypt uploads", isOn: $sync.encryptUploads)

                Button {
                    Task { await sync.syncNow() }
                } label: {
                    if sync.isSyncing {
                        HStack {
                            ProgressView()
                            Text(sync.progressText.isEmpty ? "Syncing…" : sync.progressText)
                        }
                    } else {
                        Text("Sync now")
                    }
                }
                .disabled(sync.isSyncing)

                Button("Disconnect", role: .destructive) {
                    auth.signOut()
                }
            } else {
                Button {
                    Task {
                        do {
                            try await auth.signIn()
                        } catch {
                            signInError = error.localizedDescription
                        }
                    }
                } label: {
                    Label("Connect Google Drive", systemImage: "icloud.and.arrow.up")
                }
                Text("Pages upload to a “Journal Scanner” folder in your Drive. The app can only see files it created (drive.file scope).")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let error = sync.lastError {
                Text(error).font(.caption).foregroundStyle(.red)
            }
        }
        .alert("Sign-in failed", isPresented: .constant(signInError != nil)) {
            Button("OK") { signInError = nil }
        } message: {
            Text(signInError ?? "")
        }

        if sync.encryptUploads {
            Section("Encryption") {
                Text("Uploads are encrypted on-device with AES-256-GCM. Google only stores ciphertext. Keep a copy of your key — without it, cloud backups can't be decrypted if you lose this phone.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button("Show recovery key") { showKeyExport = true }
            }
            .alert("Recovery key", isPresented: $showKeyExport) {
                Button("Copy") {
                    UIPasteboard.general.string = vault.exportKeyBase64()
                }
                Button("Close", role: .cancel) {}
            } message: {
                Text(vault.exportKeyBase64())
            }
        }
    }
}
