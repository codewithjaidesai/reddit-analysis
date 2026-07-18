import Foundation

/// Thin Google Drive v3 REST client. Only uses the `drive.file` scope surface:
/// create folders, upload files, list files the app created.
final class GoogleDriveClient {
    private let auth: GoogleAuth

    init(auth: GoogleAuth) {
        self.auth = auth
    }

    struct DriveFile: Decodable {
        let id: String
        let name: String
    }

    // MARK: - Folders

    /// Finds or creates a folder with the given name under `parent`
    /// (nil = Drive root).
    func ensureFolder(named name: String, parent: String?) async throws -> String {
        if let existing = try await findFolder(named: name, parent: parent) {
            return existing
        }
        return try await createFolder(named: name, parent: parent)
    }

    private func findFolder(named name: String, parent: String?) async throws -> String? {
        let escaped = name.replacingOccurrences(of: "'", with: "\\'")
        var query = "name = '\(escaped)' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        if let parent {
            query += " and '\(parent)' in parents"
        }
        var components = URLComponents(string: "https://www.googleapis.com/drive/v3/files")!
        components.queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "fields", value: "files(id,name)"),
            URLQueryItem(name: "pageSize", value: "1")
        ]
        let data = try await get(components.url!)
        struct ListResponse: Decodable { let files: [DriveFile] }
        return try JSONDecoder().decode(ListResponse.self, from: data).files.first?.id
    }

    private func createFolder(named name: String, parent: String?) async throws -> String {
        var metadata: [String: Any] = [
            "name": name,
            "mimeType": "application/vnd.google-apps.folder"
        ]
        if let parent {
            metadata["parents"] = [parent]
        }
        var request = URLRequest(url: URL(string: "https://www.googleapis.com/drive/v3/files?fields=id")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: metadata)
        let data = try await send(request)
        struct CreateResponse: Decodable { let id: String }
        return try JSONDecoder().decode(CreateResponse.self, from: data).id
    }

    // MARK: - Upload

    /// Multipart upload of file bytes plus metadata in a single request.
    @discardableResult
    func uploadFile(name: String, data fileData: Data, mimeType: String,
                    parentFolder: String) async throws -> String {
        let boundary = "journalscanner-\(UUID().uuidString)"
        let metadata: [String: Any] = ["name": name, "parents": [parentFolder]]
        let metadataData = try JSONSerialization.data(withJSONObject: metadata)

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Type: application/json; charset=UTF-8\r\n\r\n".data(using: .utf8)!)
        body.append(metadataData)
        body.append("\r\n--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

        var request = URLRequest(
            url: URL(string: "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id")!)
        request.httpMethod = "POST"
        request.setValue("multipart/related; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        let responseData = try await send(request)
        struct UploadResponse: Decodable { let id: String }
        return try JSONDecoder().decode(UploadResponse.self, from: responseData).id
    }

    // MARK: - Transport

    private func get(_ url: URL) async throws -> Data {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        return try await send(request)
    }

    private func send(_ request: URLRequest) async throws -> Data {
        var authorized = request
        let token = try await auth.accessToken()
        authorized.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: authorized)
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        guard (200..<300).contains(http.statusCode) else {
            let bodyText = String(data: data, encoding: .utf8) ?? ""
            throw NSError(domain: "GoogleDrive", code: http.statusCode,
                          userInfo: [NSLocalizedDescriptionKey: "Drive API \(http.statusCode): \(bodyText.prefix(300))"])
        }
        return data
    }
}
