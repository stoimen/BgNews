import Foundation
import SwiftUI

public enum NewsSource: String, CaseIterable, Identifiable, Sendable {
    case mediapool = "Mediapool"
    case boulevard = "Boulevard Bulgaria"
    case bnt = "BNT News"
    case dw = "DW Bulgarian"
    
    public var id: String { self.rawValue }
    
    public var feedURL: URL? {
        switch self {
        case .mediapool: return URL(string: "https://www.mediapool.bg/rss")
        case .boulevard: return URL(string: "https://boulevardbulgaria.bg/feed.atom")
        case .bnt: return URL(string: "http://news.bnt.bg/bg/rss/news.xml")
        case .dw: return URL(string: "https://rss.dw.com/rdf/rss-bg-all")
        }
    }
    
    public var shortName: String {
        switch self {
        case .mediapool: return "Mediapool"
        case .boulevard: return "Boulevard"
        case .bnt: return "BNT"
        case .dw: return "DW"
        }
    }

    public var color: Color {
        switch self {
        case .mediapool: return .blue
        case .boulevard: return .orange
        case .bnt: return .red
        case .dw: return Color(red: 0.0, green: 0.5, blue: 0.3)
        }
    }
}

public struct NewsItem: Identifiable, Sendable {
    public let id: String
    public let title: String
    public let summary: String
    public let link: URL
    public let pubDate: Date
    public let source: NewsSource
    public let imageURL: URL?

    public init(id: String, title: String, summary: String, link: URL, pubDate: Date, source: NewsSource, imageURL: URL? = nil) {
        self.id = id
        self.title = title
        self.summary = summary
        self.link = link
        self.pubDate = pubDate
        self.source = source
        self.imageURL = imageURL
    }
}
