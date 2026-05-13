import SwiftUI
import SafariServices

public struct NewsListView: View {
    @State private var viewModel = NewsViewModel()
    @State private var selectedURL: URL?

    public init() {}

    public var body: some View {
        NavigationStack {
            List {
                SourceFilterView(selectedSource: $viewModel.selectedSource)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color(.systemGroupedBackground))
                    .listRowSeparator(.hidden)

                if viewModel.isLoading && viewModel.newsItems.isEmpty {
                    NewsLoadingView()
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                } else if let error = viewModel.errorMessage, viewModel.newsItems.isEmpty {
                    NewsErrorView(message: error) {
                        Task { await viewModel.fetchNews() }
                    }
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                } else if viewModel.filteredNewsItems.isEmpty {
                    NewsEmptyView()
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                } else {
                    ForEach(viewModel.filteredNewsItems) { item in
                        Button { selectedURL = item.link } label: {
                            NewsCard(item: item)
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                    }
                }
            }
            .listStyle(.plain)
            .background(Color(.systemGroupedBackground))
            .toolbar(.hidden, for: .navigationBar)
            .refreshable { await viewModel.fetchNews() }
            .task { await viewModel.fetchNews() }
            .sheet(item: $selectedURL) { url in
                SafariView(url: url).ignoresSafeArea()
            }
        }
    }
}

// MARK: - Filter Bar

struct SourceFilterView: View {
    @Binding var selectedSource: NewsSource?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(title: "All", color: .accentColor, isSelected: selectedSource == nil) {
                    withAnimation(.spring(duration: 0.2)) { selectedSource = nil }
                }
                ForEach(NewsSource.allCases) { source in
                    FilterChip(title: source.shortName, color: source.color, isSelected: selectedSource == source) {
                        withAnimation(.spring(duration: 0.2)) { selectedSource = source }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
    }
}

struct FilterChip: View {
    let title: String
    let color: Color
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(isSelected ? .semibold : .regular))
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? color : Color(.secondarySystemBackground))
                .foregroundStyle(isSelected ? .white : Color(.label))
                .clipShape(Capsule())
                .shadow(color: isSelected ? color.opacity(0.35) : .clear, radius: 6, y: 3)
        }
        .animation(.spring(duration: 0.2), value: isSelected)
    }
}

// MARK: - News Card

struct NewsCard: View {
    let item: NewsItem

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 8) {
                SourceBadge(source: item.source)
                Spacer()
                Text(item.pubDate.newsRelativeString)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }

            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(item.title)
                        .font(.system(.headline, design: .default, weight: .semibold))
                        .lineLimit(3)
                        .foregroundStyle(.primary)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    if !item.summary.isEmpty {
                        Text(item.summary)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                }

                if let imageURL = item.imageURL {
                    AsyncImage(url: imageURL) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().aspectRatio(contentMode: .fill)
                        default:
                            Color(.secondarySystemBackground)
                        }
                    }
                    .frame(width: 80, height: 80)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
        }
        .padding(16)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color(.label).opacity(0.07), radius: 10, x: 0, y: 3)
    }
}

struct SourceBadge: View {
    let source: NewsSource

    var body: some View {
        Text(source.shortName.uppercased())
            .font(.system(size: 10, weight: .bold))
            .tracking(0.5)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(source.color.opacity(0.12))
            .foregroundStyle(source.color)
            .clipShape(Capsule())
    }
}

// MARK: - State Views

struct NewsLoadingView: View {
    var body: some View {
        VStack(spacing: 20) {
            ProgressView()
                .scaleEffect(1.4)
                .tint(.accentColor)
            Text("Loading news...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 100)
    }
}

struct NewsErrorView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 52))
                .foregroundStyle(.quaternary)

            VStack(spacing: 6) {
                Text("Could not load news")
                    .font(.headline)
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            Button(action: retry) {
                Label("Try Again", systemImage: "arrow.clockwise")
                    .font(.subheadline.weight(.medium))
                    .padding(.horizontal, 24)
                    .padding(.vertical, 11)
                    .background(Color.accentColor)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 100)
    }
}

struct NewsEmptyView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "newspaper")
                .font(.system(size: 52))
                .foregroundStyle(.quaternary)
            Text("No results")
                .font(.headline)
            Text("Try a different search or filter.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 100)
    }
}

// MARK: - Safari

struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}

// MARK: - Extensions

extension Date {
    var newsRelativeString: String {
        let diff = Date().timeIntervalSince(self)
        if diff < 60 { return "Just now" }
        if diff < 3600 { return "\(Int(diff / 60))m ago" }
        if diff < 86400 { return "\(Int(diff / 3600))h ago" }
        if diff < 604800 { return "\(Int(diff / 86400))d ago" }
        let f = DateFormatter()
        f.dateFormat = "d MMM"
        return f.string(from: self)
    }
}

extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}
