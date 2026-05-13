import Foundation
import FeedKit

public protocol NewsServiceProtocol: Sendable {
    func fetchAllNews() async -> [NewsItem]
    func fetchNews(from source: NewsSource) async throws -> [NewsItem]
}

public final class NewsService: NewsServiceProtocol {
    public init() {}
    
    public func fetchAllNews() async -> [NewsItem] {
        await withTaskGroup(of: [NewsItem].self) { group in
            for source in NewsSource.allCases {
                group.addTask {
                    (try? await self.fetchNews(from: source)) ?? []
                }
            }

            var allItems: [NewsItem] = []
            for await items in group {
                allItems.append(contentsOf: items)
            }
            return allItems.sorted { $0.pubDate > $1.pubDate }
        }
    }
    
    public func fetchNews(from source: NewsSource) async throws -> [NewsItem] {
        guard let url = source.feedURL else { return [] }
        
        let parser = FeedParser(URL: url)
        return try await withCheckedThrowingContinuation { continuation in
            parser.parseAsync { result in
                switch result {
                case .success(let feed):
                    let items = self.mapFeed(feed, source: source)
                    continuation.resume(returning: items)
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }
    
    private func mapFeed(_ feed: Feed, source: NewsSource) -> [NewsItem] {
        switch feed {
        case .atom(let atomFeed):
            return atomFeed.entries?.compactMap { entry in
                guard let title = entry.title,
                      let linkString = entry.links?.first?.attributes?.href,
                      let link = URL(string: linkString),
                      let date = entry.published ?? entry.updated else {
                    return nil
                }
                let summary = entry.summary?.value ?? entry.content?.value ?? ""
                return NewsItem(
                    id: entry.id ?? link.absoluteString,
                    title: title,
                    summary: summary.strippingHTML(),
                    link: link,
                    pubDate: date,
                    source: source,
                    imageURL: mediaImageURL(entry.media)
                )
            } ?? []

        case .rss(let rssFeed):
            return rssFeed.items?.compactMap { item in
                guard let title = item.title,
                      let linkString = item.link,
                      let link = URL(string: linkString),
                      let date = item.pubDate ?? item.dublinCore?.dcDate else {
                    return nil
                }
                var imageURL = mediaImageURL(item.media)
                if imageURL == nil,
                   let attrs = item.enclosure?.attributes,
                   let urlStr = attrs.url,
                   attrs.type?.hasPrefix("image/") == true {
                    imageURL = URL(string: urlStr)
                }
                if imageURL == nil {
                    imageURL = firstImageURL(in: item.description ?? "")
                }
                return NewsItem(
                    id: item.guid?.value ?? link.absoluteString,
                    title: title,
                    summary: (item.description ?? "").strippingHTML(),
                    link: link,
                    pubDate: date,
                    source: source,
                    imageURL: imageURL
                )
            } ?? []
        @unknown default:
            return []
        }
    }

    private func firstImageURL(in html: String) -> URL? {
        guard let regex = try? NSRegularExpression(pattern: #"<img[^>]+src=["']([^"']+)["']"#, options: .caseInsensitive),
              let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
              let range = Range(match.range(at: 1), in: html) else { return nil }
        return URL(string: String(html[range]))
    }

    private func mediaImageURL(_ media: MediaNamespace?) -> URL? {
        if let urlStr = media?.mediaThumbnails?.first?.attributes?.url {
            return URL(string: urlStr)
        }
        if let urlStr = media?.mediaContents?.first?.attributes?.url {
            return URL(string: urlStr)
        }
        return nil
    }
}

extension String {
    func strippingHTML() -> String {
        guard let data = self.data(using: .utf8) else { return self }
        let options: [NSAttributedString.DocumentReadingOptionKey: Any] = [
            .documentType: NSAttributedString.DocumentType.html,
            .characterEncoding: String.Encoding.utf8.rawValue
        ]
        if let attributedString = try? NSAttributedString(data: data, options: options, documentAttributes: nil) {
            return attributedString.string.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return self
    }
}
