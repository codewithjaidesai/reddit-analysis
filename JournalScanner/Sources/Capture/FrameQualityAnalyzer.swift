import Foundation
import CoreVideo

/// Cheap per-frame quality metrics computed on a sparse sample of the luma
/// plane, fast enough to run on every frame.
enum FrameQualityAnalyzer {
    /// Focus measure: mean squared horizontal gradient over a sampled grid.
    /// Sharp, in-focus handwriting produces strong local gradients; blur from
    /// motion or defocus flattens them.
    static func sharpness(of pixelBuffer: CVPixelBuffer) -> Double {
        CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }

        guard let base = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0) else { return 0 }
        let width = CVPixelBufferGetWidthOfPlane(pixelBuffer, 0)
        let height = CVPixelBufferGetHeightOfPlane(pixelBuffer, 0)
        let stride = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0)
        let pointer = base.assumingMemoryBound(to: UInt8.self)

        let stepX = max(1, width / 96)
        let stepY = max(1, height / 96)
        var sum: Double = 0
        var count = 0

        var y = height / 8
        while y < height - height / 8 {
            let rowOffset = y * stride
            var x = width / 8
            while x < width - width / 8 - stepX {
                let a = Double(pointer[rowOffset + x])
                let b = Double(pointer[rowOffset + x + stepX])
                let d = a - b
                sum += d * d
                count += 1
                x += stepX
            }
            y += stepY
        }
        return count > 0 ? sum / Double(count) : 0
    }
}
