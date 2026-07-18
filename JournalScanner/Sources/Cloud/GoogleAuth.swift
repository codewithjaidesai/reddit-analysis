import Foundation
import AuthenticationServices
import CryptoKit
import UIKit

/// Google OAuth 2.0 with PKCE — no SDK dependency, no client secret on device.
/// Scope is `drive.file` only: the app can touch files it created and nothing
/// else in the user's Drive. Tokens live in the Keychain.
final class GoogleAuth: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    enum Config {
        /// iOS OAuth client ID from Google Cloud Console → Credentials.
        static let clientID = "REPLACE_ME.apps.googleusercontent.com"
        /// Reversed client ID; must match the URL scheme in Info.plist.
        static var redirectScheme: String {
            clientID.split(separator: ".").reversed().joined(separator: ".")
        }
        static var redirectURI: String { "\(redirectScheme):/oauth2redirect" }
        static let scope = "https://www.googleapis.com/auth/drive.file"
    }

    @Published private(set) var isSignedIn: Bool

    override init() {
        isSignedIn = Keychain.getString("google_refresh_token") != nil
        super.init()
    }

    // MARK: - Sign in

    @MainActor
    func signIn() async throws {
        let verifier = Self.randomURLSafeString(length: 64)
        let challenge = Self.codeChallenge(for: verifier)

        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: Config.clientID),
            URLQueryItem(name: "redirect_uri", value: Config.redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: Config.scope),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "access_type", value: "offline")
        ]

        let callbackURL: URL = try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: components.url!,
                                                     callbackURLScheme: Config.redirectScheme) { url, error in
                if let url {
                    continuation.resume(returning: url)
                } else {
                    continuation.resume(throwing: error ?? URLError(.userCancelledAuthentication))
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }

        guard let code = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?
            .queryItems?.first(where: { $0.name == "code" })?.value else {
            throw URLError(.badServerResponse)
        }

        try await exchangeToken(params: [
            "client_id": Config.clientID,
            "code": code,
            "code_verifier": verifier,
            "grant_type": "authorization_code",
            "redirect_uri": Config.redirectURI
        ])
        isSignedIn = true
    }

    func signOut() {
        Keychain.delete("google_access_token")
        Keychain.delete("google_refresh_token")
        Keychain.delete("google_token_expiry")
        DispatchQueue.main.async { self.isSignedIn = false }
    }

    // MARK: - Token access

    /// Returns a valid access token, refreshing if necessary.
    func accessToken() async throws -> String {
        if let token = Keychain.getString("google_access_token"),
           let expiryString = Keychain.getString("google_token_expiry"),
           let expiry = Double(expiryString),
           Date(timeIntervalSince1970: expiry) > Date().addingTimeInterval(60) {
            return token
        }
        guard let refreshToken = Keychain.getString("google_refresh_token") else {
            throw URLError(.userAuthenticationRequired)
        }
        try await exchangeToken(params: [
            "client_id": Config.clientID,
            "refresh_token": refreshToken,
            "grant_type": "refresh_token"
        ])
        guard let token = Keychain.getString("google_access_token") else {
            throw URLError(.userAuthenticationRequired)
        }
        return token
    }

    private func exchangeToken(params: [String: String]) async throws {
        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = params
            .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? $0.value)" }
            .joined(separator: "&")
            .data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }

        struct TokenResponse: Decodable {
            let access_token: String
            let expires_in: Double
            let refresh_token: String?
        }
        let token = try JSONDecoder().decode(TokenResponse.self, from: data)
        Keychain.setString(token.access_token, forKey: "google_access_token")
        Keychain.setString(String(Date().timeIntervalSince1970 + token.expires_in),
                           forKey: "google_token_expiry")
        if let refresh = token.refresh_token {
            Keychain.setString(refresh, forKey: "google_refresh_token")
        }
    }

    // MARK: - PKCE helpers

    private static func randomURLSafeString(length: Int) -> String {
        var bytes = [UInt8](repeating: 0, count: length)
        _ = SecRandomCopyBytes(kSecRandomDefault, length, &bytes)
        return Data(bytes).base64URLEncoded()
    }

    private static func codeChallenge(for verifier: String) -> String {
        let digest = SHA256.hash(data: Data(verifier.utf8))
        return Data(digest).base64URLEncoded()
    }

    // MARK: - ASWebAuthenticationPresentationContextProviding

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
}

extension Data {
    func base64URLEncoded() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
