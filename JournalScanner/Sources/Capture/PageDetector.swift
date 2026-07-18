import Foundation
import Vision
import CoreImage
import UIKit

/// A detected page quadrilateral in normalized coordinates (bottom-left origin,
/// as Vision and Core Image both use).
struct PageQuad {
    var topLeft: CGPoint
    var topRight: CGPoint
    var bottomLeft: CGPoint
    var bottomRight: CGPoint
    var confidence: Float

    var normalizedArea: CGFloat {
        // Shoelace formula over the quad.
        let points = [topLeft, topRight, bottomRight, bottomLeft]
        var area: CGFloat = 0
        for i in 0..<points.count {
            let j = (i + 1) % points.count
            area += points[i].x * points[j].y - points[j].x * points[i].y
        }
        return abs(area) / 2
    }

    func center() -> CGPoint {
        CGPoint(x: (topLeft.x + topRight.x + bottomLeft.x + bottomRight.x) / 4,
                y: (topLeft.y + topRight.y + bottomLeft.y + bottomRight.y) / 4)
    }
}

/// Finds the journal page in a frame and produces a perspective-corrected crop.
final class PageDetector {
    private let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    /// Runs Vision document segmentation on a frame.
    func detectPage(in pixelBuffer: CVPixelBuffer) -> PageQuad? {
        let request = VNDetectDocumentSegmentationRequest()
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, options: [:])
        try? handler.perform([request])
        guard let observation = request.results?.first, observation.confidence > 0.7 else {
            return nil
        }
        let quad = PageQuad(topLeft: observation.topLeft,
                            topRight: observation.topRight,
                            bottomLeft: observation.bottomLeft,
                            bottomRight: observation.bottomRight,
                            confidence: observation.confidence)
        // Ignore tiny detections (a page should fill a meaningful part of frame).
        guard quad.normalizedArea > 0.12 else { return nil }
        return quad
    }

    /// Perspective-corrects and crops the page out of a full-resolution frame.
    func correctedPageImage(from pixelBuffer: CVPixelBuffer, quad: PageQuad) -> UIImage? {
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        let extent = ciImage.extent

        func scaled(_ point: CGPoint) -> CIVector {
            CIVector(x: point.x * extent.width, y: point.y * extent.height)
        }

        guard let filter = CIFilter(name: "CIPerspectiveCorrection") else { return nil }
        filter.setValue(ciImage, forKey: kCIInputImageKey)
        filter.setValue(scaled(quad.topLeft), forKey: "inputTopLeft")
        filter.setValue(scaled(quad.topRight), forKey: "inputTopRight")
        filter.setValue(scaled(quad.bottomLeft), forKey: "inputBottomLeft")
        filter.setValue(scaled(quad.bottomRight), forKey: "inputBottomRight")

        guard let output = filter.outputImage,
              let cgImage = ciContext.createCGImage(output, from: output.extent) else {
            return nil
        }
        // Camera frames arrive rotated 90° (landscape sensor, portrait UI).
        return UIImage(cgImage: cgImage, scale: 1.0, orientation: .right)
    }
}
