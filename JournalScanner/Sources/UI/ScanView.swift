import SwiftUI
import AVFoundation

/// Full-screen scanning UI: live camera, detected-page outline, auto-capture
/// status, and a running count of captured pages. The user just films and
/// flips — no shutter button needed.
struct ScanView: View {
    @EnvironmentObject private var app: AppState
    @Environment(\.dismiss) private var dismiss
    let journalId: String

    @StateObject private var model: ScanViewModel

    init(journalId: String) {
        self.journalId = journalId
        _model = StateObject(wrappedValue: ScanViewModel(journalId: journalId))
    }

    var body: some View {
        ZStack {
            if model.cameraDenied {
                VStack(spacing: 16) {
                    Image(systemName: "video.slash")
                        .font(.system(size: 44))
                    Text("Camera access is required to scan.\nEnable it in Settings → Journal Scanner.")
                        .multilineTextAlignment(.center)
                }
                .foregroundStyle(.white)
            } else {
                CameraPreview(session: model.camera.session)
                    .ignoresSafeArea()
            }

            if let engine = model.engine {
                EngineOverlay(engine: engine,
                              processingCount: model.processingCount) {
                    model.stop()
                    dismiss()
                }
            }

            if model.showFlash {
                Color.white.ignoresSafeArea()
                    .transition(.opacity)
            }
        }
        .background(.black)
        .statusBarHidden()
        .task {
            await model.start(pipeline: app.pipeline, store: app.store)
        }
        .onDisappear {
            model.stop()
            app.refreshReviewCount()
        }
    }
}

/// HUD that observes the capture engine directly so state changes re-render.
private struct EngineOverlay: View {
    @ObservedObject var engine: AutoCaptureEngine
    let processingCount: Int
    let onDone: () -> Void

    var body: some View {
        ZStack {
            if let quad = engine.lastQuad {
                QuadOverlay(quad: quad)
                    .ignoresSafeArea()
            }

            VStack {
                HStack {
                    Button(action: onDone) {
                        Image(systemName: "xmark")
                            .font(.title3.bold())
                            .foregroundStyle(.white)
                            .padding(12)
                            .background(.black.opacity(0.5), in: Circle())
                    }
                    Spacer()
                    if processingCount > 0 {
                        Label("\(processingCount)", systemImage: "text.viewfinder")
                            .font(.subheadline.bold())
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(.black.opacity(0.5), in: Capsule())
                    }
                }
                .padding()

                Spacer()

                VStack(spacing: 10) {
                    if case .stabilizing(let progress) = engine.state {
                        ProgressView(value: progress)
                            .progressViewStyle(.linear)
                            .tint(.green)
                            .frame(width: 180)
                    }
                    Text(engine.statusText)
                        .font(.callout.weight(.medium))
                        .foregroundStyle(.white)

                    Text("\(engine.capturedCount) page(s) captured")
                        .font(.footnote)
                        .foregroundStyle(.white.opacity(0.75))

                    Button(action: onDone) {
                        Text("Done")
                            .font(.headline)
                            .foregroundStyle(.black)
                            .padding(.horizontal, 44)
                            .padding(.vertical, 12)
                            .background(.white, in: Capsule())
                    }
                }
                .padding(.vertical, 20)
                .frame(maxWidth: .infinity)
                .background(.black.opacity(0.45))
            }
        }
    }
}

@MainActor
final class ScanViewModel: ObservableObject {
    let journalId: String
    let camera = CameraSession()

    @Published var engine: AutoCaptureEngine?
    @Published var cameraDenied = false
    @Published var showFlash = false
    @Published var processingCount = 0

    init(journalId: String) {
        self.journalId = journalId
    }

    func start(pipeline: RecognitionPipeline, store: JournalStore) async {
        guard engine == nil else { return }

        guard await CameraSession.requestAccess() else {
            cameraDenied = true
            return
        }

        let hashes = (try? store.recentPageHashes(in: journalId, limit: 50)) ?? []
        let engine = AutoCaptureEngine(existingPageHashes: hashes)
        engine.onCapture = { [weak self] captured in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.flash()
                self.processingCount += 1
                let journalId = self.journalId
                Task.detached(priority: .userInitiated) {
                    let normalized = captured.image.normalizedOrientation()
                    _ = try? await pipeline.process(image: normalized,
                                                    journalId: journalId,
                                                    dhash: captured.dhash)
                    await MainActor.run { self.processingCount -= 1 }
                }
            }
        }
        self.engine = engine

        do {
            try camera.configure { [weak engine] pixelBuffer in
                engine?.ingest(pixelBuffer)
            }
            camera.start()
        } catch {
            cameraDenied = true
        }
    }

    func stop() {
        camera.stop()
    }

    private func flash() {
        withAnimation(.easeIn(duration: 0.08)) { showFlash = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
            withAnimation(.easeOut(duration: 0.25)) { self.showFlash = false }
        }
    }
}

// MARK: - Camera preview

struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession

    final class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
    }

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.previewLayer.session = session
        view.previewLayer.videoGravity = .resizeAspectFill
        return view
    }

    func updateUIView(_ view: PreviewView, context: Context) {}
}

// MARK: - Detected page outline

/// Draws the detected page quad. Camera frames are landscape with the sensor
/// rotated 90° relative to portrait UI, so Vision's normalized (x, y) maps to
/// screen as (x', y') = (1 - y, 1 - x). Approximate under aspect-fill; good
/// enough for a guidance overlay.
struct QuadOverlay: View {
    let quad: PageQuad

    var body: some View {
        GeometryReader { geo in
            Path { path in
                func point(_ p: CGPoint) -> CGPoint {
                    CGPoint(x: (1 - p.y) * geo.size.width,
                            y: (1 - p.x) * geo.size.height)
                }
                path.move(to: point(quad.topLeft))
                path.addLine(to: point(quad.topRight))
                path.addLine(to: point(quad.bottomRight))
                path.addLine(to: point(quad.bottomLeft))
                path.closeSubpath()
            }
            .stroke(Color.green.opacity(0.9), style: StrokeStyle(lineWidth: 3, lineJoin: .round))
        }
        .allowsHitTesting(false)
    }
}
