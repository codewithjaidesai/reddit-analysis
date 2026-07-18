import Foundation
import CoreVideo
import CoreGraphics

/// Difference-hash (dHash) utilities used for two things:
///  - frame-to-frame stability / page-flip detection during capture,
///  - duplicate-page suppression (so lingering on a page doesn't capture it twice).
enum PerceptualHash {
    /// 64-bit dHash from a 9x8 grid of luma samples.
    static func dHash(luma: (Int, Int) -> UInt8, width: Int, height: Int) -> UInt64 {
        guard width > 9, height > 8 else { return 0 }
        var hash: UInt64 = 0
        var bit: UInt64 = 1
        for row in 0..<8 {
            let y = (row * height) / 8 + height / 16
            for col in 0..<8 {
                let x1 = (col * width) / 9 + width / 18
                let x2 = ((col + 1) * width) / 9 + width / 18
                if luma(x1, y) > luma(x2, y) {
                    hash |= bit
                }
                bit <<= 1
            }
        }
        return hash
    }

    /// dHash of the luma plane of a 420f/420v pixel buffer.
    static func dHash(pixelBuffer: CVPixelBuffer) -> UInt64 {
        CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }

        guard let base = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0) else { return 0 }
        let width = CVPixelBufferGetWidthOfPlane(pixelBuffer, 0)
        let height = CVPixelBufferGetHeightOfPlane(pixelBuffer, 0)
        let stride = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0)
        let pointer = base.assumingMemoryBound(to: UInt8.self)

        return dHash(luma: { x, y in pointer[y * stride + x] }, width: width, height: height)
    }

    /// dHash of a CGImage (used for saved page images).
    static func dHash(cgImage: CGImage) -> UInt64 {
        let width = 72, height = 64
        var pixels = [UInt8](repeating: 0, count: width * height)
        let colorSpace = CGColorSpaceCreateDeviceGray()
        guard let context = CGContext(data: &pixels, width: width, height: height,
                                      bitsPerComponent: 8, bytesPerRow: width,
                                      space: colorSpace, bitmapInfo: CGImageAlphaInfo.none.rawValue) else {
            return 0
        }
        context.interpolationQuality = .low
        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
        return dHash(luma: { x, y in pixels[y * width + x] }, width: width, height: height)
    }

    static func hammingDistance(_ a: UInt64, _ b: UInt64) -> Int {
        (a ^ b).nonzeroBitCount
    }
}
