import XCTest
@testable import JournalScanner

final class PerceptualHashTests: XCTestCase {
    func testIdenticalContentHashesEqual() {
        let luma: (Int, Int) -> UInt8 = { x, y in UInt8((x * 7 + y * 13) % 256) }
        let a = PerceptualHash.dHash(luma: luma, width: 640, height: 480)
        let b = PerceptualHash.dHash(luma: luma, width: 640, height: 480)
        XCTAssertEqual(a, b)
        XCTAssertEqual(PerceptualHash.hammingDistance(a, b), 0)
    }

    func testDifferentContentHashesDiffer() {
        let a = PerceptualHash.dHash(luma: { x, y in UInt8((x * 7 + y * 13) % 256) },
                                     width: 640, height: 480)
        let b = PerceptualHash.dHash(luma: { x, y in UInt8((x / 3 + y * 31) % 256) },
                                     width: 640, height: 480)
        XCTAssertGreaterThan(PerceptualHash.hammingDistance(a, b), 8)
    }

    func testSmallNoiseKeepsHashesClose() {
        let base: (Int, Int) -> UInt8 = { x, y in UInt8((x * 7 + y * 13) % 256) }
        let noisy: (Int, Int) -> UInt8 = { x, y in
            let v = Int(base(x, y)) + ((x + y) % 3 - 1)  // ±1 noise
            return UInt8(max(0, min(255, v)))
        }
        let a = PerceptualHash.dHash(luma: base, width: 640, height: 480)
        let b = PerceptualHash.dHash(luma: noisy, width: 640, height: 480)
        XCTAssertLessThanOrEqual(PerceptualHash.hammingDistance(a, b), 6)
    }

    func testDegenerateSizeReturnsZero() {
        XCTAssertEqual(PerceptualHash.dHash(luma: { _, _ in 0 }, width: 4, height: 4), 0)
    }
}
