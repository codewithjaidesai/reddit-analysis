import Foundation
import UIKit

/// Owns on-disk storage of page images. Only file names are persisted in the
/// database; absolute paths are derived here so the app survives container
/// relocation between iOS updates.
enum FileStore {
    static var documentsDirectory: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    static var pagesDirectory: URL {
        let url = documentsDirectory.appendingPathComponent("Pages", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    static func url(forPageFile name: String) -> URL {
        pagesDirectory.appendingPathComponent(name)
    }

    /// Saves the full-resolution page image and a thumbnail.
    /// Returns (imageFile, thumbFile) names.
    static func savePageImage(_ image: UIImage, pageId: String) throws -> (String, String) {
        let imageFile = "\(pageId).jpg"
        let thumbFile = "\(pageId)_thumb.jpg"
        guard let data = image.jpegData(compressionQuality: 0.85) else {
            throw NSError(domain: "FileStore", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "JPEG encoding failed"])
        }
        try data.write(to: url(forPageFile: imageFile), options: .atomic)

        let thumb = image.resized(maxDimension: 400)
        if let thumbData = thumb.jpegData(compressionQuality: 0.7) {
            try thumbData.write(to: url(forPageFile: thumbFile), options: .atomic)
        }
        return (imageFile, thumbFile)
    }

    static func loadImage(named file: String) -> UIImage? {
        UIImage(contentsOfFile: url(forPageFile: file).path)
    }

    static func deletePageFiles(_ page: Page) {
        try? FileManager.default.removeItem(at: url(forPageFile: page.imageFile))
        try? FileManager.default.removeItem(at: url(forPageFile: page.thumbFile))
    }
}
