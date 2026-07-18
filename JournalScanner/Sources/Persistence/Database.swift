import Foundation
import SQLite3

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

enum DBError: Error {
    case open(String)
    case prepare(String, sql: String)
    case step(String, sql: String)
}

/// Minimal, dependency-free SQLite wrapper. All access is serialized on an
/// internal queue so it is safe to call from any thread.
final class Database {
    private var handle: OpaquePointer?
    private let queue = DispatchQueue(label: "com.jaidesai.journalscanner.db")

    init(path: String) {
        queue.sync {
            if sqlite3_open_v2(path, &handle,
                               SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX,
                               nil) != SQLITE_OK {
                fatalError("Unable to open database at \(path)")
            }
            sqlite3_exec(handle, "PRAGMA journal_mode=WAL;", nil, nil, nil)
            sqlite3_exec(handle, "PRAGMA foreign_keys=ON;", nil, nil, nil)
            migrateLocked()
        }
    }

    deinit {
        sqlite3_close(handle)
    }

    // MARK: - Schema

    private func migrateLocked() {
        let schema = """
        CREATE TABLE IF NOT EXISTS journals (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            createdAt REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS pages (
            id TEXT PRIMARY KEY,
            journalId TEXT NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
            pageIndex INTEGER NOT NULL,
            imageFile TEXT NOT NULL,
            thumbFile TEXT NOT NULL,
            text TEXT NOT NULL DEFAULT '',
            createdAt REAL NOT NULL,
            syncState INTEGER NOT NULL DEFAULT 0,
            dhash INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_pages_journal ON pages(journalId, pageIndex);
        CREATE TABLE IF NOT EXISTS words (
            id TEXT PRIMARY KEY,
            pageId TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            confidence REAL NOT NULL,
            x REAL NOT NULL, y REAL NOT NULL, w REAL NOT NULL, h REAL NOT NULL,
            lineIndex INTEGER NOT NULL,
            wordIndex INTEGER NOT NULL,
            needsReview INTEGER NOT NULL DEFAULT 0,
            resolved INTEGER NOT NULL DEFAULT 0,
            candidates TEXT NOT NULL DEFAULT '[]'
        );
        CREATE INDEX IF NOT EXISTS idx_words_page ON words(pageId, lineIndex, wordIndex);
        CREATE INDEX IF NOT EXISTS idx_words_review ON words(needsReview) WHERE needsReview = 1;
        CREATE TABLE IF NOT EXISTS lexicon (
            word TEXT PRIMARY KEY,
            count INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS bigrams (
            w1 TEXT NOT NULL,
            w2 TEXT NOT NULL,
            count INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (w1, w2)
        );
        CREATE TABLE IF NOT EXISTS corrections (
            wrong TEXT NOT NULL,
            right TEXT NOT NULL,
            count INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (wrong, right)
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
            pageId UNINDEXED,
            body,
            tokenize = 'unicode61 remove_diacritics 2'
        );
        """
        sqlite3_exec(handle, schema, nil, nil, nil)
    }

    // MARK: - Execution

    enum Value {
        case null
        case integer(Int64)
        case real(Double)
        case text(String)

        var int: Int64? { if case .integer(let v) = self { return v }; return nil }
        var double: Double? {
            switch self {
            case .real(let v): return v
            case .integer(let v): return Double(v)
            default: return nil
            }
        }
        var string: String? { if case .text(let v) = self { return v }; return nil }
    }

    typealias Row = [String: Value]

    @discardableResult
    func run(_ sql: String, _ params: [Any?] = []) throws -> Int {
        try queue.sync {
            let stmt = try prepareLocked(sql, params)
            defer { sqlite3_finalize(stmt) }
            let rc = sqlite3_step(stmt)
            guard rc == SQLITE_DONE || rc == SQLITE_ROW else {
                throw DBError.step(errorMessageLocked(), sql: sql)
            }
            return Int(sqlite3_changes(handle))
        }
    }

    func rows(_ sql: String, _ params: [Any?] = []) throws -> [Row] {
        try queue.sync {
            let stmt = try prepareLocked(sql, params)
            defer { sqlite3_finalize(stmt) }
            var result: [Row] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                var row: Row = [:]
                let count = sqlite3_column_count(stmt)
                for i in 0..<count {
                    let name = String(cString: sqlite3_column_name(stmt, i))
                    switch sqlite3_column_type(stmt, i) {
                    case SQLITE_INTEGER: row[name] = .integer(sqlite3_column_int64(stmt, i))
                    case SQLITE_FLOAT: row[name] = .real(sqlite3_column_double(stmt, i))
                    case SQLITE_TEXT: row[name] = .text(String(cString: sqlite3_column_text(stmt, i)))
                    default: row[name] = .null
                    }
                }
                result.append(row)
            }
            return result
        }
    }

    func transaction(_ block: () throws -> Void) throws {
        try run("BEGIN IMMEDIATE")
        do {
            try block()
            try run("COMMIT")
        } catch {
            try? run("ROLLBACK")
            throw error
        }
    }

    // MARK: - Private

    private func prepareLocked(_ sql: String, _ params: [Any?]) throws -> OpaquePointer {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(handle, sql, -1, &stmt, nil) == SQLITE_OK, let stmt else {
            throw DBError.prepare(errorMessageLocked(), sql: sql)
        }
        for (index, param) in params.enumerated() {
            let i = Int32(index + 1)
            switch param {
            case nil:
                sqlite3_bind_null(stmt, i)
            case let v as Int:
                sqlite3_bind_int64(stmt, i, Int64(v))
            case let v as Int64:
                sqlite3_bind_int64(stmt, i, v)
            case let v as Double:
                sqlite3_bind_double(stmt, i, v)
            case let v as Bool:
                sqlite3_bind_int64(stmt, i, v ? 1 : 0)
            case let v as String:
                sqlite3_bind_text(stmt, i, v, -1, SQLITE_TRANSIENT)
            case let v as Date:
                sqlite3_bind_double(stmt, i, v.timeIntervalSince1970)
            default:
                sqlite3_bind_text(stmt, i, String(describing: param!), -1, SQLITE_TRANSIENT)
            }
        }
        return stmt
    }

    private func errorMessageLocked() -> String {
        String(cString: sqlite3_errmsg(handle))
    }
}
