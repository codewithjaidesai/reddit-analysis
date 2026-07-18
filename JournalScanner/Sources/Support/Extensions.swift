import UIKit

extension UIImage {
    /// Aspect-fit resize with the longest side capped at `maxDimension`.
    func resized(maxDimension: CGFloat) -> UIImage {
        let longest = max(size.width, size.height)
        guard longest > maxDimension else { return self }
        let scale = maxDimension / longest
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        return UIGraphicsImageRenderer(size: newSize, format: format).image { _ in
            draw(in: CGRect(origin: .zero, size: newSize))
        }
    }

    /// Crops a normalized top-left-origin rect out of the image, with a little
    /// padding so review crops show surrounding context.
    func crop(normalizedRect: CGRect, padding: CGFloat = 0.35) -> UIImage? {
        guard let cgImage else { return nil }
        let width = CGFloat(cgImage.width)
        let height = CGFloat(cgImage.height)

        let padX = normalizedRect.width * padding
        let padY = normalizedRect.height * padding
        let rect = CGRect(x: max(0, (normalizedRect.origin.x - padX)) * width,
                          y: max(0, (normalizedRect.origin.y - padY)) * height,
                          width: min(1, normalizedRect.width + 2 * padX) * width,
                          height: min(1, normalizedRect.height + 2 * padY) * height)
            .intersection(CGRect(x: 0, y: 0, width: width, height: height))

        guard !rect.isNull, let cropped = cgImage.cropping(to: rect) else { return nil }
        return UIImage(cgImage: cropped, scale: 1, orientation: imageOrientation)
    }

    /// Renders the image with orientation baked in, so `cgImage` matches what
    /// the user sees (needed before OCR and hashing).
    func normalizedOrientation() -> UIImage {
        guard imageOrientation != .up else { return self }
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            draw(in: CGRect(origin: .zero, size: size))
        }
    }
}
