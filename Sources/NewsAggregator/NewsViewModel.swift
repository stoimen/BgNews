import Foundation
import Observation

@Observable
@MainActor
public final class NewsViewModel {
    public var newsItems: [NewsItem] = []
    public var isLoading: Bool = false
    public var errorMessage: String?
    public var searchText: String = ""
    public var selectedSource: NewsSource?
    
    private let newsService: NewsServiceProtocol
    
    public init(newsService: NewsServiceProtocol = NewsService()) {
        self.newsService = newsService
    }
    
    public var filteredNewsItems: [NewsItem] {
        newsItems.filter { item in
            let matchesSearch = searchText.isEmpty || 
                               item.title.localizedCaseInsensitiveContains(searchText) || 
                               item.summary.localizedCaseInsensitiveContains(searchText)
            let matchesSource = selectedSource == nil || item.source == selectedSource
            return matchesSearch && matchesSource
        }
    }
    
    public func fetchNews() async {
        isLoading = true
        errorMessage = nil

        newsItems = await newsService.fetchAllNews()

        isLoading = false

        if newsItems.isEmpty {
            errorMessage = "Could not load news. Check your internet connection and try again."
        }
    }
}
