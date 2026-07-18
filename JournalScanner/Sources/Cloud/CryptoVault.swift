import Foundation
import CryptoKit

/// Client-side encryption for cloud uploads. AES-256-GCM with a device-local
/// key that never leaves the Keychain — Google (or any cloud provider) only
/// ever sees ciphertext when encryption is enabled.
final class CryptoVault {
    private static let keyName = "vault_key_v1"

    private var key: SymmetricKey {
        if let data = Keychain.get(Self.keyName) {
            return SymmetricKey(data: data)
        }
        let newKey = SymmetricKey(size: .bits256)
        let data = newKey.withUnsafeBytes { Data($0) }
        Keychain.set(data, forKey: Self.keyName)
        return newKey
    }

    func seal(_ plaintext: Data) throws -> Data {
        let box = try AES.GCM.seal(plaintext, using: key)
        guard let combined = box.combined else {
            throw NSError(domain: "CryptoVault", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Sealing produced no combined box"])
        }
        return combined
    }

    func open(_ ciphertext: Data) throws -> Data {
        let box = try AES.GCM.SealedBox(combined: ciphertext)
        return try AES.GCM.open(box, using: key)
    }

    /// Base64 export of the key so users can decrypt their backup off-device.
    /// Shown once in Settings behind an explicit user action.
    func exportKeyBase64() -> String {
        key.withUnsafeBytes { Data($0) }.base64EncodedString()
    }
}
