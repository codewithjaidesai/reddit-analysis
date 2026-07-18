import Foundation
import CoreVideo
import UIKit

/// The brain of hands-free scanning. Watches the frame stream and decides
/// when a page is ready to capture, captures it once, then waits for the
/// user to flip before arming again.
///
/// State machine:
///   searching   — no page detected yet
///   stabilizing — page detected; waiting for N consecutive stable+sharp frames
///   capturing   — best frame is being cropped/processed
///   flipWait    — page captured; waiting for large frame change (the flip)
final class AutoCaptureEngine: ObservableObject {
    enum State: Equatable {
        case searching
        case stabilizing(progress: Double)
        case capturing
        case flipWait
    }

    struct CapturedPage {
        let image: UIImage
        let dhash: Int64
    }

    // Tunables — calibrated on-device; see README "Field tuning".
    private let requiredStableFrames = 8
    private let stabilityHashThreshold = 6      // max hamming distance between consecutive frames
    private let flipHashThreshold = 16          // min hamming distance that counts as a flip
    private let flipFramesRequired = 3
    private let minSharpness: Double = 60
    private let duplicateHashThreshold = 10     // vs already-captured pages

    @Published private(set) var state: State = .searching
    @Published private(set) var lastQuad: PageQuad?
    @Published private(set) var capturedCount = 0
    @Published var statusText = "Point the camera at a page"

    private let detector = PageDetector()
    private var stableFrames = 0
    private var flipFrames = 0
    private var lastFrameHash: UInt64 = 0
    private var capturedHashes: [UInt64]
    private var frameCounter = 0
    private var isProcessing = false

    /// Called with the perspective-corrected page when a capture fires.
    var onCapture: ((CapturedPage) -> Void)?

    init(existingPageHashes: [Int64]) {
        self.capturedHashes = existingPageHashes.map { UInt64(bitPattern: $0) }
    }

    /// Feed every camera frame here (called on the camera frame queue).
    func ingest(_ pixelBuffer: CVPixelBuffer) {
        guard !isProcessing else { return }
        frameCounter += 1

        let hash = PerceptualHash.dHash(pixelBuffer: pixelBuffer)
        let hashDelta = PerceptualHash.hammingDistance(hash, lastFrameHash)
        lastFrameHash = hash

        // Document segmentation is the expensive step — run it every other frame.
        let quad: PageQuad?
        if frameCounter % 2 == 0 || lastQuadCache == nil {
            quad = detector.detectPage(in: pixelBuffer)
            lastQuadCache = quad
        } else {
            quad = lastQuadCache
        }

        publish { self.lastQuad = quad }

        switch currentState {
        case .searching:
            guard quad != nil else {
                setStatus("Point the camera at a page")
                return
            }
            stableFrames = 0
            transition(to: .stabilizing(progress: 0))

        case .stabilizing:
            guard let quad else {
                transition(to: .searching)
                return
            }
            let sharp = FrameQualityAnalyzer.sharpness(of: pixelBuffer)
            let stable = hashDelta <= stabilityHashThreshold

            if stable && sharp >= minSharpness {
                stableFrames += 1
                let progress = Double(stableFrames) / Double(requiredStableFrames)
                transition(to: .stabilizing(progress: min(1, progress)))
                setStatus("Hold steady…")
                if stableFrames >= requiredStableFrames {
                    capture(pixelBuffer: pixelBuffer, quad: quad)
                }
            } else {
                stableFrames = max(0, stableFrames - 2)
                setStatus(sharp < minSharpness ? "Move closer or improve lighting" : "Hold steady…")
            }

        case .capturing:
            break

        case .flipWait:
            if hashDelta >= flipHashThreshold {
                flipFrames += 1
                if flipFrames >= flipFramesRequired {
                    flipFrames = 0
                    transition(to: .searching)
                    setStatus("Looking for next page…")
                }
            } else {
                flipFrames = 0
                setStatus("Flip to the next page")
            }
        }
    }

    private var lastQuadCache: PageQuad?
    private var currentState: State = .searching

    private func capture(pixelBuffer: CVPixelBuffer, quad: PageQuad) {
        isProcessing = true
        transition(to: .capturing)
        setStatus("Capturing…")

        guard let image = detector.correctedPageImage(from: pixelBuffer, quad: quad),
              let cgImage = image.cgImage else {
            isProcessing = false
            transition(to: .searching)
            return
        }

        let pageHash = PerceptualHash.dHash(cgImage: cgImage)
        let isDuplicate = capturedHashes.contains {
            PerceptualHash.hammingDistance($0, pageHash) <= duplicateHashThreshold
        }

        if isDuplicate {
            setStatus("Already captured — flip to the next page")
        } else {
            capturedHashes.append(pageHash)
            let captured = CapturedPage(image: image, dhash: Int64(bitPattern: pageHash))
            publish {
                self.capturedCount += 1
                self.onCapture?(captured)
            }
            setStatus("Captured page — flip to the next one")
        }

        isProcessing = false
        transition(to: .flipWait)
    }

    private func transition(to newState: State) {
        currentState = newState
        publish { self.state = newState }
    }

    private func setStatus(_ text: String) {
        publish {
            if self.statusText != text { self.statusText = text }
        }
    }

    private func publish(_ block: @escaping () -> Void) {
        DispatchQueue.main.async(execute: block)
    }
}
