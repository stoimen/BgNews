// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "NewsAggregator",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "NewsAggregator",
            targets: ["NewsAggregator"]),
    ],
    dependencies: [
        .package(url: "https://github.com/nmdias/FeedKit.git", from: "9.1.2")
    ],
    targets: [
        .target(
            name: "NewsAggregator",
            dependencies: ["FeedKit"]),
        .testTarget(
            name: "NewsAggregatorTests",
            dependencies: ["NewsAggregator"]),
    ]
)
